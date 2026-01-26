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

    // Parse the string result from SearXNG tool
    let results: SearchResult[] = [];

    // The tool returns a string, try to parse it
    if (typeof rawResults === "string") {
      try {
        const parsed = JSON.parse(rawResults);
        if (Array.isArray(parsed)) {
          results = parsed.slice(0, limit).map((r: { title?: string; link?: string; url?: string; snippet?: string; content?: string; engine?: string }) => ({
            title: r.title || "Untitled",
            url: r.link || r.url || "",
            content: r.snippet || r.content || "",
            engine: r.engine || "searxng",
          }));
        }
      } catch {
        // If parsing fails, return the raw string as a single result
        results = [{
          title: "Search Results",
          url: "",
          content: rawResults,
          engine: "searxng",
        }];
      }
    }

    return results;
  } catch (error) {
    console.error("SearXNG search failed:", error);
    // Fallback to direct API call if LangChain tool fails
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
