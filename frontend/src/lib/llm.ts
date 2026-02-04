import { ChatOpenAI } from "@langchain/openai";

const LLAMA_API_URL = process.env.LLAMA_API_URL || "http://localhost:8080/v1";

// Types

export type SearchDecision = 'SEARCH' | 'NO_SEARCH' | 'AMBIGUOUS';

export interface ClassificationResult {
  decision: SearchDecision;
  query: string; // Original or rewritten query
}


// Models


/**
 * Main chat model for streaming responses
 */
export const chatModel = new ChatOpenAI({
  apiKey: "not-needed",
  configuration: {
    baseURL: LLAMA_API_URL,
  },
  model: "qwen3-4b",
  temperature: 0.7,
  streaming: true,
});

/**
 * Ultra-fast model for classification (minimal tokens)
 */
const classifierModel = new ChatOpenAI({
  apiKey: "not-needed",
  configuration: {
    baseURL: LLAMA_API_URL,
  },
  model: "qwen3-4b",
  temperature: 0.6,
  streaming: false,
  maxTokens: 150,
  timeout: 8000,
});


// Heuristic Classification (No LLM - Instant)

/**
 * Fast pattern-based classification (no LLM call)
 * Returns SEARCH, NO_SEARCH, or AMBIGUOUS
 */
export function classifyQueryHeuristic(query: string): SearchDecision {
  const q = query.toLowerCase().trim();

  // NO_SEARCH patterns - greetings, meta questions, simple math
  const noSearchPatterns = [
    /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening))[\s!.,?]*$/i,
    /^(thanks|thank\s*you|thx|ty)[\s!.,?]*$/i,
    /^(bye|goodbye|see\s*you|later)[\s!.,?]*$/i,
    /^what\s*(can|do)\s*you\s*do/i,
    /^who\s*are\s*you/i,
    /^how\s*are\s*you/i,
    /^help\s*$/i,
    /^\d+\s*[\+\-\*\/\%\^]\s*\d+/, // Math: "5 + 3"
    /^(calculate|compute|solve)\s+\d/i,
  ];

  for (const pattern of noSearchPatterns) {
    if (pattern.test(q)) return 'NO_SEARCH';
  }

  // SEARCH patterns - factual queries that need web search
  const searchPatterns = [
    /^(who|what|when|where|why|how)\s+(is|are|was|were|did|does|do|will|would|can|could)\s/i,
    /\b(latest|recent|current|today|yesterday|now|this\s*(week|month|year))\b/i,
    /\b(news|update|announcement|release|launched)\b/i,
    /\b(price|cost|weather|stock|score|rate)\b/i,
    /\b(born|died|age|height|net\s*worth|salary)\b/i,
    /\b(how\s+to|tutorial|guide|steps|install)\b/i,
    /\b(best|top|review|comparison|vs|versus)\b/i,
    /\b(20\d{2})\b/, // Years like 2024, 2025, 2026
    /\b(president|ceo|founder|minister|leader)\b/i,
    /\b(population|capital|currency|country)\b/i,
  ];

  for (const pattern of searchPatterns) {
    if (pattern.test(q)) return 'SEARCH';
  }

  // Check for proper nouns (capitalized words not at sentence start)
  const words = query.split(/\s+/);
  const hasProperNoun = words.slice(1).some(w => /^[A-Z][a-z]+/.test(w));
  if (hasProperNoun) return 'SEARCH';

  return 'AMBIGUOUS';
}


// Combined Classification + Query Rewriting (Single LLM Call)

// Insert current date dynamically
const CURRENT_DATE = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

const CLASSIFY_REWRITE_PROMPT = `/no_think You are a query optimization AI. Your task is to decide if a user query requires a Google Search and, if so, rewrite it into the best possible keyword string.

Current Date: ${CURRENT_DATE}

Input:
1. Conversation History (for context)
2. Current User Query

Instructions:
1. Analyze if the query needs external data (facts, news, prices, code docs, "who is").
   - If it is conversational (hi, thanks, how are you), output NO_SEARCH.
   - If it requires knowledge, output SEARCH.
2. If SEARCH, rewrite the query:
   - **Resolve Pronouns:** Replace "it", "he", "she", "that" with the specific entity from History.
   - **Add Temporality:** If the user asks for "latest", "news", or "current", append the current year (${new Date().getFullYear()}).
   - **Keyword Focus:** Remove filler words ("please tell me about", "I want to know"). Keep only search keywords.

Output Format (Strictly one line):
SEARCH: <optimized_query_string>
OR
NO_SEARCH

### Examples:

History: User: "Who is the CEO of Tesla?" Assistant: "Elon Musk."
Query: "How old is he?"
Output: SEARCH: Elon Musk age

History: User: "I want to buy a phone." Assistant: "Which OS?"
Query: "The latest iPhone."
Output: SEARCH: iPhone 16 pro max price specs ${new Date().getFullYear()}

History: None
Query: "Python requests library tutorial"
Output: SEARCH: python requests library tutorial

History: None
Query: "Hi there"
Output: NO_SEARCH
`;

/**
 * Combined classifier and query rewriter (single LLM call for ambiguous cases)
 * @param conversationHistory - Previous messages as [role, content] tuples
 * @param currentQuery - The user's current query
 * @returns Classification result with decision and (possibly rewritten) query
 */
export async function classifyAndRewrite(
  conversationHistory: Array<[string, string]>,
  currentQuery: string
): Promise<ClassificationResult> {
  // Build context prompt
  let prompt = currentQuery;
  if (conversationHistory.length > 0) {
    const history = conversationHistory
      .slice(-4) // Last 4 messages for context (keep it short)
      .map(([role, content]) => `${role === 'human' ? 'User' : 'Assistant'}: ${content.substring(0, 200)}`)
      .join('\n');
    prompt = `Context:\n${history}\n\nQuery: ${currentQuery}`;
  }

  try {
    const response = await classifierModel.invoke([
      ['system', CLASSIFY_REWRITE_PROMPT],
      ['human', prompt],
    ] as unknown as Parameters<typeof classifierModel.invoke>[0]);

    let rawOutput = typeof response.content === 'string'
      ? response.content
      : String(response.content);

    console.log('[Classifier] Raw response:', rawOutput.substring(0, 300));

    // Try to extract answer - first outside think tags, then inside as fallback
    let output = rawOutput.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // If empty after stripping, try to find SEARCH/NO_SEARCH inside think tags
    if (!output) {
      const thinkMatch = rawOutput.match(/<think>([\s\S]*?)<\/think>/i);
      if (thinkMatch) {
        const thinkContent = thinkMatch[1];
        // Look for the classification inside thinking
        const searchMatch = thinkContent.match(/SEARCH:\s*(.+)/i);
        const noSearchMatch = thinkContent.match(/NO_SEARCH/i);
        if (searchMatch) {
          output = `SEARCH: ${searchMatch[1].trim()}`;
        } else if (noSearchMatch) {
          output = 'NO_SEARCH';
        }
      }
    }

    console.log('[Classifier] Parsed output:', output);

    // Parse response
    if (output.toUpperCase().startsWith('SEARCH:')) {
      const rewritten = output.slice(7).trim() || currentQuery;
      console.log('[Classifier] Decision: SEARCH, Query:', rewritten);
      return { decision: 'SEARCH', query: rewritten };
    }

    if (output.toUpperCase().includes('NO_SEARCH')) {
      console.log('[Classifier] Decision: NO_SEARCH');
      return { decision: 'NO_SEARCH', query: currentQuery };
    }

    // Fallback: assume search needed for safety (better to search than miss info)
    console.log('[Classifier] Fallback: SEARCH (unparseable output)');
    return { decision: 'SEARCH', query: currentQuery };
  } catch (error) {
    console.error('[Classifier] Failed, defaulting to SEARCH:', error);
    return { decision: 'SEARCH', query: currentQuery };
  }
}


/**
 * System prompt with search context
 */
export function getSystemPromptWithSources(hasSearchResults: boolean): string {
  if (hasSearchResults) {
    return `You are a knowledgeable AI research assistant. Your goal is to answer the user's question using the provided Search Results.

Context:
- Current Date: ${CURRENT_DATE}
- Search Results are provided below in the format: [Source ID] Title: Snippet...

Instructions:
1. **Synthesize, Don't List:** Do not just list the search results. Combine information from multiple sources to write a coherent, natural answer.
2. **Cite Everything:** You MUST cite your sources using numbers in brackets like [1], [2]. Place the citation immediately after the fact it supports.
   - Example: "Python 3.12 was released in late 2023 [1], introducing better error messages [3]."
3. **Be Objective:** If sources disagree, mention the conflict.
4. **Stay Grounded:** Answer ONLY based on the provided results. If the results do not contain the answer, state that you couldn't find the information.
5. **Formatting:** Use Markdown (bolding key terms, lists) for readability.`;
  }

  return `You are a helpful AI assistant. Answer the user's question directly and concisely.
Current Date: ${CURRENT_DATE}.`;
}
