import { db } from "@/lib/db";
import {
  chatModel,
  classifyQueryHeuristic,
  classifyAndRewrite,
  getSystemPromptWithSources,
} from "@/lib/llm";
import { getSearchResultsStructured, SearchResult } from "@/lib/searxng";
import { toUIMessageStream } from "@ai-sdk/langchain";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { type BaseMessage } from "@langchain/core/messages";

type SourcesDataPart = {
  type: "data-sources";
  data: Array<{ title: string; url: string; snippet: string; index: number }>;
};

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

function buildConversationHistory(messages: any[]): Array<[string, string]> {
  return messages.slice(-4).map((msg: any) => {
    const content = extractTextFromMessage(msg);
    const truncated = content.length > 300 ? content.substring(0, 297) + "..." : content;
    return [msg.role === "user" ? "human" : "assistant", truncated] as [string, string];
  });
}

function formatSearchResultsForLLM(sources: SearchResult[]): string {
  return sources
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
    .join("\n\n");
}

export async function POST(request: Request) {
  try {
    const { messages, chatId } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("Messages are required", { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];

    if (lastMessage.role !== "user") {
      return new Response("Last message must be from user", { status: 400 });
    }

    const userQuery = extractTextFromMessage(lastMessage);
    console.log("[Chat API] User query:", userQuery);

    if (!userQuery.trim()) {
      return new Response("Message content is empty", { status: 400 });
    }

    const heuristicDecision = classifyQueryHeuristic(userQuery);
    console.log(`[Optimize] Heuristic decision: ${heuristicDecision}`);

    const conversationHistory = buildConversationHistory(messages.slice(0, -1));
    const hasHistory = conversationHistory.length > 0;

    let needsSearch = false;
    let searchQuery = userQuery;

    if (heuristicDecision === "NO_SEARCH") {
      needsSearch = false;
      console.log("[Optimize] Fast path: NO_SEARCH (heuristic)");
    } else if (heuristicDecision === "SEARCH") {
      needsSearch = true;
      if (hasHistory) {
        console.log("[Optimize] SEARCH with history - rewriting query");
        const result = await classifyAndRewrite(conversationHistory, userQuery);
        searchQuery = result.query;
      }
      console.log(`[Optimize] Fast path: SEARCH, query: "${searchQuery}"`);
    } else {
      console.log("[Optimize] Ambiguous - calling LLM classifier");
      const result = await classifyAndRewrite(conversationHistory, userQuery);
      needsSearch = result.decision === "SEARCH";
      searchQuery = result.query;
      console.log(`[Optimize] LLM decision: ${result.decision}, query: "${searchQuery}"`);
    }

    let collectedSources: SearchResult[] = [];

    const [sources, _] = await Promise.all([
      needsSearch ? getSearchResultsStructured(searchQuery) : Promise.resolve([]),
      chatId
        ? db.message.create({
            data: {
              chatId,
              role: "user",
              content: userQuery,
            },
          })
        : Promise.resolve(null),
    ]);

    collectedSources = sources;
    console.log(`[Optimize] Search results: ${collectedSources.length} sources`);

    if (chatId) {
      db.chat
        .findUnique({
          where: { id: chatId },
          include: { messages: { select: { id: true }, take: 2 } },
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

    const MAX_HISTORY_MESSAGES = 6;
    const recentMessages = messages.slice(0, -1).slice(-MAX_HISTORY_MESSAGES);
    const previousMessages = toLangChainMessages(recentMessages);
    const hasSearchResults = collectedSources.length > 0;

    console.log(`[Context] Using ${recentMessages.length}/${messages.length - 1} history messages`);

    const langChainMessages: BaseMessage[] = [
      new SystemMessage(getSystemPromptWithSources(hasSearchResults)),
      ...previousMessages,
    ];

    if (hasSearchResults) {
      const searchContext = formatSearchResultsForLLM(collectedSources);
      langChainMessages.push(
        new HumanMessage(`Search results:\n${searchContext}\n\nUser question: ${userQuery}`)
      );
    } else {
      langChainMessages.push(new HumanMessage(userQuery));
    }

    const capturedSources = collectedSources;
    const capturedChatId = chatId;

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
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

        console.log("[Optimize] Streaming LLM response");
        const langchainStream = await chatModel.stream(langChainMessages);

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
