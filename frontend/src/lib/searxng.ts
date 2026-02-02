import { SearxngSearch } from "@langchain/community/tools/searxng_search";
import { unstable_cache } from "next/cache";

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  engine: string;
}

const SEARXNG_URL = process.env.SEARXNG_URL || "http://localhost:8888";

// Create SearXNG tool using LangChain (internal)
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
      // Handle "No good results found." response
      if (rawResults === "No good results found.") {
        console.log("[SearXNG] No results found for query");
        return await searchWebDirect(query, limit);
      }

      try {
        // LangChain SearxngSearch returns comma-separated JSON objects (not valid JSON array)
        // e.g., {"title":"A",...},{"title":"B",...}
        // We need to wrap it in brackets to make it a valid JSON array
        const jsonString = rawResults.startsWith("[") ? rawResults : `[${rawResults}]`;
        const parsed = JSON.parse(jsonString);

        // Case 1: Array of results (expected format after wrapping)
        if (Array.isArray(parsed)) {
          results = parsed.slice(0, limit).map(parseResultItem);
        }
        // Case 2: Object with 'results' array (SearXNG direct API format)
        else if (parsed && typeof parsed === "object" && Array.isArray(parsed.results)) {
          results = parsed.results.slice(0, limit).map(parseResultItem);
        }
        // Case 3: Single result object
        else if (parsed && typeof parsed === "object" && (parsed.title || parsed.url)) {
          results = [parseResultItem(parsed)];
        }
      } catch (parseError) {
        console.error("[SearXNG] JSON parse error:", parseError);
        console.log("[SearXNG] Falling back to direct API");
        return await searchWebDirect(query, limit);
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
 * Cached search function - caches results for 5 minutes (internal)
 */
const searchWeb = unstable_cache(
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
 * Get search results as structured data (for sources display)
 * Uses cached version for better performance
 */
export async function getSearchResultsStructured(query: string): Promise<SearchResult[]> {
  return searchWeb(query, 5);
}
