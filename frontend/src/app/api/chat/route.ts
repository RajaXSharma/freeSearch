import { db } from "@/lib/db";
import { chatModel, SYSTEM_PROMPT } from "@/lib/llm";
import { searchWeb, formatSourcesForPrompt, SearchResult } from "@/lib/searxng";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { toUIMessageStream } from "@ai-sdk/langchain";
import { createUIMessageStreamResponse } from "ai";

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

    const userQuery = lastMessage.content;

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

    // Convert previous messages to LangChain format
    const previousMessages = messages.slice(0, -1).map((msg: { role: string; content: string }) => {
      if (msg.role === 'user') return new HumanMessage(msg.content);
      return new AIMessage(msg.content);
    });

    // Build the full message array for LangChain
    const langChainMessages = [
      new SystemMessage(SYSTEM_PROMPT),
      ...previousMessages,
      new HumanMessage(augmentedQuery),
    ];

    // Stream the response using LangChain
    const stream = await chatModel.stream(langChainMessages);

    // Use AI SDK's toUIMessageStream with onFinal callback for DB saving
    return createUIMessageStreamResponse({
      stream: toUIMessageStream(stream, {
        onFinal: async (completion) => {
          // Save assistant message to database after streaming completes
          if (chatId && completion) {
            await db.message.create({
              data: {
                chatId,
                role: "assistant",
                content: completion,
                sources: JSON.stringify(sources),
              },
            });
          }
        },
      }),
      headers: {
        "X-Sources": encodeURIComponent(JSON.stringify(sources)),
      },
    });
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
