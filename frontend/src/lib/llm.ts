import { ChatOpenAI } from "@langchain/openai";
import { webSearchTool } from "./searxng";

const LLAMA_API_URL = process.env.LLAMA_API_URL || "http://localhost:8080/v1";

export const chatModel = new ChatOpenAI({
  apiKey: "not-needed", // llama.cpp doesn't require an API key
  configuration: {
    baseURL: LLAMA_API_URL,
  },
  model: "qwen3-4b", // Model name (informational, llama.cpp uses loaded model)
  temperature: 0.7,
  streaming: true,
});

/**
 * Chat model for tool calling - non-streaming with timeout
 * Note: llama.cpp requires --jinja flag for tool calling to work
 */
const toolCallingModel = new ChatOpenAI({
  apiKey: "not-needed",
  configuration: {
    baseURL: LLAMA_API_URL,
  },
  model: "qwen3-4b",
  temperature: 0.7,
  streaming: false,
  timeout: 30000, // 30 second timeout
});

/**
 * Chat model with tools bound - use this for agent-style interactions
 */
export const chatModelWithTools = toolCallingModel.bindTools([webSearchTool], {
  tool_choice: "auto", // Let the model decide whether to use tools
});

/**
 * Available tools for the agent
 */
export const tools = [webSearchTool];

/**
 * Non-streaming model for quick tasks like query rewriting
 */
const queryRewriteModel = new ChatOpenAI({
  apiKey: "not-needed",
  configuration: {
    baseURL: LLAMA_API_URL,
  },
  model: "qwen3-4b",
  temperature: 0,
  streaming: false,
  maxTokens: 150,
});

const QUERY_REWRITE_PROMPT = `You are a query rewriter. Given a conversation history and a follow-up question, rewrite the follow-up question to be a standalone search query that includes all necessary context.

Rules:
- Output ONLY the rewritten search query, nothing else
- Replace pronouns (he, she, it, they, this, that) with their actual referents from the conversation
- Keep the query concise and search-engine friendly
- If the question is already standalone, return it as-is
- Do not add explanations or prefixes`;

/**
 * Rewrite a follow-up query to be standalone using conversation context
 * @param conversationHistory - Previous messages as [role, content] tuples
 * @param currentQuery - The user's current query
 * @returns Rewritten standalone query
 */
export async function rewriteQuery(
  conversationHistory: Array<[string, string]>,
  currentQuery: string
): Promise<string> {
  // If no history, return query as-is
  if (conversationHistory.length === 0) {
    return currentQuery;
  }

  // Format conversation for the prompt
  const historyText = conversationHistory
    .map(([role, content]) => `${role === 'human' ? 'User' : 'Assistant'}: ${content}`)
    .join('\n');

  const messages: Array<[string, string]> = [
    ['system', QUERY_REWRITE_PROMPT],
    ['human', `Conversation history:\n${historyText}\n\nFollow-up question: ${currentQuery}\n\nRewritten query:`],
  ];

  try {
    const response = await queryRewriteModel.invoke(messages as unknown as Parameters<typeof queryRewriteModel.invoke>[0]);
    const rewritten = typeof response.content === 'string'
      ? response.content.trim()
      : String(response.content).trim();

    console.log('[Query Rewrite] Original:', currentQuery);
    console.log('[Query Rewrite] Rewritten:', rewritten);

    return rewritten || currentQuery;
  } catch (error) {
    console.error('[Query Rewrite] Failed, using original query:', error);
    return currentQuery;
  }
}

/**
 * System prompt for the search assistant with tool use
 */
export const SYSTEM_PROMPT = `You are a helpful AI search assistant with access to a web_search tool.

IMPORTANT: You MUST use the web_search tool for:
- Any factual questions about people, places, events, or current information
- Questions about ages, dates, statistics, or specific facts
- Questions you are not 100% certain about
- News or recent events

Only skip web_search for:
- Simple greetings like "hi" or "hello"
- Basic math calculations
- Questions about your own capabilities

Rules:
- After using web_search, cite sources using [1], [2], etc.
- Format responses in Markdown for readability
- NEVER mention whether you used web search or not in your response
- Just answer the question directly without explaining your tool usage`;
