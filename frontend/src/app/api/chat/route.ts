import { db } from "@/lib/db";
import { chatModel, SYSTEM_PROMPT } from "@/lib/llm";
import { searchWeb, formatSourcesForPrompt, SearchResult } from "@/lib/searxng";
import { toUIMessageStream } from "@ai-sdk/langchain";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

export const maxDuration = 60; // Allow streaming for up to 60 seconds

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

    // Extract user query from UIMessage format (parts array)
    let userQuery = '';
    
    if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
      // AI SDK 6.x format: message has parts array
      const textParts = lastMessage.parts.filter((part: any) => part.type === 'text');
      userQuery = textParts.map((part: any) => part.text).join('');
    } else if (typeof lastMessage.content === 'string') {
      // Fallback: plain string content
      userQuery = lastMessage.content;
    } else if (Array.isArray(lastMessage.content)) {
      // Alternative format: content as array
      const textContent = lastMessage.content.find((c: any) => c.type === 'text');
      userQuery = textContent?.text || '';
    }

    console.log('[Chat API] User query:', userQuery);

    if (!userQuery.trim()) {
      return new Response("Message content is empty", { status: 400 });
    }

    // Search the web using SearXNG (via LangChain)
    let sources: SearchResult[] = [];
    let sourcesContext = "";

    try {
      sources = await searchWeb(userQuery, 5);
      sourcesContext = formatSourcesForPrompt(sources);
    } catch (error) {
      console.error("Search failed, continuing without sources:", error);
    }

    // Save user message to database if chatId is provided
    if (chatId) {
      await db.message.create({
        data: {
          chatId,
          role: "user",
          content: userQuery,
        },
      });

      // Update chat title if this is the first message
      const chat = await db.chat.findUnique({
        where: { id: chatId },
        include: { messages: true },
      });

      if (chat && chat.messages.length <= 1) {
        const title =
          userQuery.length > 50 ? userQuery.substring(0, 47) + "..." : userQuery;
        await db.chat.update({
          where: { id: chatId },
          data: { title },
        });
      }
    }

    // Build the augmented prompt with search results
    const augmentedQuery = sourcesContext
      ? `Based on the following search results, answer the user's question.

Search Results:
${sourcesContext}

User Question: ${userQuery}`
      : userQuery;

    // Convert previous messages to LangChain format (using tuple format)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const previousMessages: Array<[string, string]> = messages.slice(0, -1).map((msg: any) => {
      let content = '';
      
      if (msg.parts && Array.isArray(msg.parts)) {
        // AI SDK 6.x format
        const textParts = msg.parts.filter((part: any) => part.type === 'text');
        content = textParts.map((part: any) => part.text).join('');
      } else if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        const textContent = msg.content.find((c: any) => c.type === 'text');
        content = textContent?.text || '';
      }
      
      // Use tuple format: [role, content] which LangChain accepts
      return [msg.role === 'user' ? 'human' : 'assistant', content] as [string, string];
    });

    // Build the full message array for LangChain using tuple format
    // Type assertion needed due to pnpm hoisting creating multiple @langchain/core versions
    const langChainMessages: Array<[string, string]> = [
      ['system', SYSTEM_PROMPT],
      ...previousMessages,
      ['human', augmentedQuery],
    ];

    // Capture for closure
    const capturedSources = sources;
    const capturedChatId = chatId;

    /**
     * Use createUIMessageStream for advanced streaming with custom data
     * This allows us to send sources as data parts alongside the LLM response
     * @see https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data
     */
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // First, send sources as custom data
        if (capturedSources.length > 0) {
          writer.write({
            type: 'data-sources',
            data: capturedSources.map((s, idx) => ({
              title: s.title || s.url,
              url: s.url,
              snippet: s.content,
              index: idx + 1,
            })),
          });
        }

        // Stream the LLM response using LangChain
        // Cast to any to avoid type conflicts from duplicate @langchain/core versions in pnpm
        const langchainStream = await chatModel.stream(langChainMessages as unknown as Parameters<typeof chatModel.stream>[0]);
        
        // Merge the LangChain stream with our UI message stream
        writer.merge(toUIMessageStream(langchainStream, {
          onFinal: async (completion: string) => {
            // Save assistant message to database after streaming completes
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
        }));
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
