import { SearxngSearch } from "@langchain/community/tools/searxng_search";
import { unstable_cache } from "next/cache";

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  engine: string;
}

const SEARXNG_URL = process.env.SEARXNG_URL || "http://localhost:8888";

// Create SearXNG tool using LangChain
const searxngTool = new SearxngSearch({
  apiBase: SEARXNG_URL,
  params: {
    format: "json",
    categories: "general",
  },
});

/**
 * Parse a single result object into SearchResult format
 */
function parseResultItem(r: Record<string, unknown>): SearchResult {
  return {
    title: (r.title as string) || "Untitled",
    url: (r.link as string) || (r.url as string) || "",
    content: (r.snippet as string) || (r.content as string) || "",
    engine: (r.engine as string) || "searxng",
  };
}

/**
 * Search using SearXNG via LangChain (internal implementation)
 * @param query - The search query
 * @param limit - Maximum number of results (default: 5)
 */
async function searchWebInternal(
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  try {
    const rawResults = await searxngTool.invoke(query);

    console.log("[SearXNG] Raw results type:", typeof rawResults);
    console.log("[SearXNG] Raw results:", rawResults?.toString().substring(0, 500));

    let results: SearchResult[] = [];

    if (typeof rawResults === "string") {
      try {
        const parsed = JSON.parse(rawResults);

        // Case 1: Direct array of results
        if (Array.isArray(parsed)) {
          results = parsed.slice(0, limit).map(parseResultItem);
        }
        // Case 2: Object with 'results' array (SearXNG API format)
        else if (parsed && typeof parsed === "object" && Array.isArray(parsed.results)) {
          results = parsed.results.slice(0, limit).map(parseResultItem);
        }
        // Case 3: Single result object
        else if (parsed && typeof parsed === "object" && (parsed.title || parsed.url)) {
          results = [parseResultItem(parsed)];
        }
      } catch {
        // Try parsing as newline-separated JSON objects
        try {
          const lines = rawResults.split("\n").filter((line: string) => line.trim());
          const parsedResults: SearchResult[] = [];

          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              if (obj && (obj.title || obj.url || obj.link)) {
                parsedResults.push(parseResultItem(obj));
              }
            } catch {
              // Skip invalid lines
            }
          }

          if (parsedResults.length > 0) {
            results = parsedResults.slice(0, limit);
          }
        } catch {
          // Final fallback: use direct API
          console.log("[SearXNG] Parsing failed, falling back to direct API");
          return await searchWebDirect(query, limit);
        }
      }
    }

    // If no results from LangChain tool, try direct API
    if (results.length === 0) {
      console.log("[SearXNG] No results from LangChain tool, trying direct API");
      return await searchWebDirect(query, limit);
    }

    return results;
  } catch (error) {
    console.error("SearXNG search failed:", error);
    return await searchWebDirect(query, limit);
  }
}

/**
 * Cached search function - caches results for 5 minutes
 */
export const searchWeb = unstable_cache(
  searchWebInternal,
  ["searxng-search"],
  { revalidate: 300 } // 5 minute cache
);

/**
 * Direct SearXNG API call as fallback
 */
async function searchWebDirect(
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  try {
    const url = new URL("/search", SEARXNG_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("categories", "general");

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.error(`SearXNG error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    return data.results.slice(0, limit).map((result: { title?: string; url?: string; content?: string; engine?: string }) => ({
      title: result.title || "Untitled",
      url: result.url || "",
      content: result.content || "",
      engine: result.engine || "unknown",
    }));
  } catch (error) {
    console.error("Direct SearXNG search failed:", error);
    return [];
  }
}

/**
 * Format search results for LLM context
 */
export function formatSourcesForPrompt(sources: SearchResult[]): string {
  if (sources.length === 0) return "";

  return sources
    .map(
      (source, index) =>
        `[${index + 1}] ${source.title}\nURL: ${source.url}\n${source.content}`
    )
    .join("\n\n");
}

/**
 * Get the SearXNG tool for use in LangChain agents
 */
export function getSearxngTool() {
  return searxngTool;
}
