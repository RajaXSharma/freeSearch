import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

const LLAMA_API_URL = process.env.LLAMA_API_URL || "http://localhost:8080/v1";

/**
 * LangChain ChatOpenAI model connected to llama.cpp
 * llama.cpp exposes an OpenAI-compatible API
 */
export const chatModel = new ChatOpenAI({
  openAIApiKey: "not-needed",
  configuration: {
    baseURL: LLAMA_API_URL,
  },
  modelName: "qwen3-4b", // Ignored by llama.cpp, uses loaded model
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
 * RAG prompt template
 */
export const ragPromptTemplate = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM_PROMPT],
  new MessagesPlaceholder("history"),
  ["human", `Based on the following search results, answer the user's question.

Search Results:
{sources}

User Question: {question}`],
]);

/**
 * Create a RAG chain for processing queries with search results
 */
export function createRAGChain() {
  return RunnableSequence.from([
    ragPromptTemplate,
    chatModel,
    new StringOutputParser(),
  ]);
}

/**
 * Convert chat history to LangChain message format
 */
export function convertToLangChainMessages(
  messages: Array<{ role: string; content: string }>
): Array<HumanMessage | AIMessage> {
  return messages.map((msg) => {
    if (msg.role === "user") {
      return new HumanMessage(msg.content);
    } else {
      return new AIMessage(msg.content);
    }
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
