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
