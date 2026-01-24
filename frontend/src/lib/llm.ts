import { ChatOpenAI } from "@langchain/openai";

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
 * System prompt for the search assistant
 */
export const SYSTEM_PROMPT = `You are a helpful AI search assistant. Your task is to provide accurate, well-structured answers based on the search results provided to you.

Guidelines:
- Use the provided search results to answer the user's question
- Cite sources using [1], [2], etc. when referencing information
- If the search results don't contain relevant information, say so honestly
- Format your response using Markdown for better readability
- Be concise but comprehensive
- If asked a follow-up question, use context from the conversation`;

/**
 * Convert chat history to LangChain message format
 * Uses tuple format [role, content] which is compatible with BaseMessageLike
 */
export function convertToLangChainMessages(
  messages: Array<{ role: string; content: string }>
): Array<[string, string]> {
  return messages.map((msg) => {
    const role = msg.role === "user" ? "human" : "assistant";
    return [role, msg.content] as [string, string];
  });
}

/**
 * Build a RAG prompt with search results as context (for simple use)
 */
export function buildRAGPrompt(query: string, sources: string): string {
  if (!sources) {
    return query;
  }

  return `Based on the following search results, answer the user's question.

Search Results:
${sources}

User Question: ${query}`;
}

// Re-export for backwards compatibility
export const DEFAULT_MODEL = "qwen3-4b";

// Export model for direct use with Vercel AI SDK adapter
export { chatModel as llm };
