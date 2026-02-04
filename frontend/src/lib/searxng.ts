import { SearxngSearch } from "@langchain/community/tools/searxng_search";
import { unstable_cache } from "next/cache";

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  engine: string;
}

const SEARXNG_URL = process.env.SEARXNG_URL || "http://localhost:8888";

const searxngTool = new SearxngSearch({
  apiBase: SEARXNG_URL,
  params: {
    format: "json",
    categories: "general",
  },
});

function parseResultItem(r: Record<string, unknown>): SearchResult {
  return {
    title: (r.title as string) || "Untitled",
    url: (r.link as string) || (r.url as string) || "",
    content: (r.snippet as string) || (r.content as string) || "",
    engine: (r.engine as string) || "searxng",
  };
}

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
      if (rawResults === "No good results found.") {
        console.log("[SearXNG] No results found for query");
        return await searchWebDirect(query, limit);
      }

      try {
        const jsonString = rawResults.startsWith("[") ? rawResults : `[${rawResults}]`;
        const parsed = JSON.parse(jsonString);

        if (Array.isArray(parsed)) {
          results = parsed.slice(0, limit).map(parseResultItem);
        } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.results)) {
          results = parsed.results.slice(0, limit).map(parseResultItem);
        } else if (parsed && typeof parsed === "object" && (parsed.title || parsed.url)) {
          results = [parseResultItem(parsed)];
        }
      } catch (parseError) {
        console.error("[SearXNG] JSON parse error:", parseError);
        console.log("[SearXNG] Falling back to direct API");
        return await searchWebDirect(query, limit);
      }
    }

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

const searchWeb = unstable_cache(
  searchWebInternal,
  ["searxng-search"],
  { revalidate: 300 }
);

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

export async function getSearchResultsStructured(query: string): Promise<SearchResult[]> {
  return searchWeb(query, 5);
}
