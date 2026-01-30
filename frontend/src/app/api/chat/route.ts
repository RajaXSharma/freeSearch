import { db } from "@/lib/db";
import { chatModelWithTools, tools, SYSTEM_PROMPT, chatModel, rewriteQuery } from "@/lib/llm";
import { getSearchResultsStructured, SearchResult } from "@/lib/searxng";
import { toUIMessageStream } from "@ai-sdk/langchain";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { type BaseMessage } from "@langchain/core/messages";

/** Type for custom sources data part sent to the client */
type SourcesDataPart = {
  type: "data-sources";
  data: Array<{ title: string; url: string; snippet: string; index: number }>;
};

/** Extract text content from a UIMessage */
function extractTextFromMessage(message: any): string {
  if (message.parts && Array.isArray(message.parts)) {
    const textParts = message.parts.filter((part: any) => part.type === "text");
    return textParts.map((part: any) => part.text).join("");
  } else if (typeof message.content === "string") {
    return message.content;
  } else if (Array.isArray(message.content)) {
    const textContent = message.content.find((c: any) => c.type === "text");
    return textContent?.text || "";
  }
  return "";
}

/** Convert UI messages to LangChain message objects */
function toLangChainMessages(messages: any[]): BaseMessage[] {
  return messages.map((msg) => {
    const content = extractTextFromMessage(msg);
    if (msg.role === "user") {
      return new HumanMessage(content);
    } else {
      return new AIMessage(content);
    }
  });
}

/** Execute a tool by name */
async function executeTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
  rewrittenQuery: string // Pre-rewritten query with context
): Promise<{ result: string; sources: SearchResult[] }> {
  console.log(`[Agent] Executing tool: ${toolName}`, toolArgs);

  // For web_search, use the pre-rewritten query (already has context)
  if (toolName === "web_search") {
    // Use the rewritten query instead of the tool's query
    console.log(`[Agent] Searching with rewritten query: "${rewrittenQuery}"`);

    const sources = await getSearchResultsStructured(rewrittenQuery);

    if (sources.length === 0) {
      return { result: "No search results found for this query.", sources: [] };
    }

    // Format results for the LLM
    const result = sources
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
      .join("\n\n");

    return { result, sources };
  }

  // For other tools, use the tool directly
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    return { result: `Tool ${toolName} not found`, sources: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await tool.invoke(toolArgs as any);
  return { result: String(result), sources: [] };
}

export async function POST(request: Request) {
  try {
    const { messages, chatId } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("Messages are required", { status: 400 });
    }

    // Get the latest user message
    const lastMessage = messages[messages.length - 1];

    if (lastMessage.role !== "user") {
      return new Response("Last message must be from user", { status: 400 });
    }

    const userQuery = extractTextFromMessage(lastMessage);
    console.log("[Chat API] User query:", userQuery);

    if (!userQuery.trim()) {
      return new Response("Message content is empty", { status: 400 });
    }

    // Save user message to database
    if (chatId) {
      await db.message.create({
        data: {
          chatId,
          role: "user",
          content: userQuery,
        },
      });

      // Update chat title if first message
      db.chat
        .findUnique({
          where: { id: chatId },
          include: { messages: true },
        })
        .then((chat) => {
          if (chat && chat.messages.length <= 1) {
            const title =
              userQuery.length > 50
                ? userQuery.substring(0, 47) + "..."
                : userQuery;
            db.chat
              .update({
                where: { id: chatId },
                data: { title },
              })
              .catch((err) =>
                console.error("Failed to update chat title:", err)
              );
          }
        })
        .catch((err) =>
          console.error("Failed to check chat for title update:", err)
        );
    }

    // Build conversation history for query rewriting (excluding current message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conversationHistory: Array<[string, string]> = messages.slice(0, -1).map((msg: any) => {
      const content = extractTextFromMessage(msg);
      return [msg.role === 'user' ? 'human' : 'assistant', content] as [string, string];
    });

    // STEP 1: Rewrite query with conversation context (for better search)
    const rewrittenQuery = await rewriteQuery(conversationHistory, userQuery);
    console.log(`[Chat API] Original query: "${userQuery}"`);
    console.log(`[Chat API] Rewritten query: "${rewrittenQuery}"`);

    // Build LangChain messages with the REWRITTEN query
    const previousMessages = toLangChainMessages(messages.slice(0, -1));
    const langChainMessages: BaseMessage[] = [
      new SystemMessage(SYSTEM_PROMPT),
      ...previousMessages,
      new HumanMessage(rewrittenQuery), // Use rewritten query for LLM
    ];

    // Agent loop - handle tool calls
    let currentMessages = [...langChainMessages];
    let collectedSources: SearchResult[] = [];
    const MAX_ITERATIONS = 5;
    let toolCallingFailed = false;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      console.log(`[Agent] Iteration ${i + 1}`);

      try {
        // Call LLM with tools (non-streaming to check for tool calls)
        console.log("[Agent] Calling LLM with tools...");
        const response = await chatModelWithTools.invoke(currentMessages);
        console.log("[Agent] LLM response received");
        console.log("[Agent] Response content:", typeof response.content === 'string'
          ? response.content.substring(0, 200)
          : JSON.stringify(response.content).substring(0, 200));

        // Check if the LLM wants to call tools
        const toolCalls = response.tool_calls;
        console.log("[Agent] Tool calls:", toolCalls);

        if (!toolCalls || toolCalls.length === 0) {
          // No tool calls - LLM is ready to respond
          console.log("[Agent] No tool calls, ready to stream response");
          // Don't add response to messages - we'll stream fresh from the original messages
          break;
        }

        // Execute each tool call
        console.log(`[Agent] Tool calls:`, toolCalls.map((tc) => tc.name));

        // Add AI message with tool calls to history
        currentMessages.push(response);

        for (const toolCall of toolCalls) {
          const { result, sources } = await executeTool(
            toolCall.name,
            toolCall.args as Record<string, unknown>,
            rewrittenQuery // Pass the pre-rewritten query
          );

          // Collect sources from search
          if (sources.length > 0) {
            collectedSources = [...collectedSources, ...sources];
          }

          // Add tool result to messages
          currentMessages.push(
            new ToolMessage({
              content: result,
              tool_call_id: toolCall.id || toolCall.name,
            })
          );
        }
      } catch (error) {
        console.error("[Agent] Tool calling failed:", error);
        toolCallingFailed = true;
        break;
      }
    }

    // If tool calling failed, fall back to regular chat without tools
    if (toolCallingFailed) {
      console.log("[Agent] Falling back to regular chat without tools");
      currentMessages = [...langChainMessages];
    }

    // Capture for closure
    const capturedSources = collectedSources;
    const capturedChatId = chatId;
    const finalMessages = currentMessages;

    // Stream the final response
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Send sources if we collected any from tool calls
        if (capturedSources.length > 0) {
          const sourcesDataPart: SourcesDataPart = {
            type: "data-sources",
            data: capturedSources.map((s, idx) => ({
              title: s.title || s.url,
              url: s.url,
              snippet: s.content,
              index: idx + 1,
            })),
          };
          writer.write(sourcesDataPart);
        }

        // Stream the LLM response
        const langchainStream = await chatModel.stream(finalMessages);

        writer.merge(
          toUIMessageStream(langchainStream, {
            onFinal: async (completion: string) => {
              if (capturedChatId && completion) {
                try {
                  await db.message.create({
                    data: {
                      chatId: capturedChatId,
                      role: "assistant",
                      content: completion,
                      sources: JSON.stringify(capturedSources),
                    },
                  });
                } catch (dbError) {
                  console.error("Failed to save assistant message:", dbError);
                }
              }
            },
          })
        );
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
