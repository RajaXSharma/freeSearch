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


const CLASSIFY_REWRITE_PROMPT = `/no_think
Decide if query needs web search. If yes, rewrite it as an optimal search engine query.

Output format (ONE line only):
- SEARCH: <optimized search query>
- NO_SEARCH

Rewriting rules for SEARCH:
- Replace pronouns (his/her/he/she/it/they/this/that) with actual names from context
- Make it keyword-focused and search-engine friendly
- Remove filler words, keep essential terms
- Add context from conversation if needed

Examples:
Context: "User: who is Rohit Sharma" → Query: "what is his wife name" → SEARCH: Rohit Sharma wife name
Context: "User: tell me about React" → Query: "how do I install it" → SEARCH: how to install React
Query: "latest iPhone price" → SEARCH: iPhone 16 price 2024
Query: "hello there" → NO_SEARCH`;

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

// System Prompt

/**
 * System prompt for the search assistant (no tool mentions - we handle search externally)
 */
export const SYSTEM_PROMPT = `You are a helpful AI search assistant.

When search results are provided, use them to answer accurately and cite sources using [1], [2], etc.

Rules:
- Be concise and direct
- Format responses in Markdown for readability
- If search results are provided, base your answer on them and cite sources
- If no search results are provided, answer from your knowledge or say you don't know
- Never mention whether you searched or not - just answer naturally`;

/**
 * System prompt with search context
 */
export function getSystemPromptWithSources(hasSearchResults: boolean): string {
  if (hasSearchResults) {
    return `You are a helpful AI search assistant.

Search results have been provided below. Use them to answer the user's question accurately.

Rules:
- Cite sources using [1], [2], etc. based on the search result numbers
- Be concise and direct
- Format responses in Markdown
- Base your answer on the provided search results
- If the search results don't contain the answer, say so`;
  }

  return `You are a helpful AI assistant.

Rules:
- Be concise and direct
- Format responses in Markdown
- Answer from your knowledge
- If you're not sure about something, say so`;
}
