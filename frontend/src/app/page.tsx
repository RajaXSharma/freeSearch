"use client"

import * as React from "react"
import { Sidebar } from "@/components/sidebar"
import { SearchInput } from "@/components/search-input"
import { SourceCard, type Source } from "@/components/source-card"
import { AnswerSection } from "@/components/answer-section"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

const MOCK_SOURCES: Source[] = [
  { title: "Wikipedia", url: "https://wikipedia.org", index: 1 },
  { title: "MDN Web Docs", url: "https://developer.mozilla.org", index: 2 },
  { title: "StackOverflow", url: "https://stackoverflow.com", index: 3 },
  { title: "TechCrunch", url: "https://techcrunch.com", index: 4 },
]

const MOCK_ANSWER = `Here is a summary based on the search results:

**FreeSearch** is a concept for a minimalist, AI-powered search engine designed to provide direct answers with source citations. 

### Key Features:
1. **Clean Interface:** Uses a distraction-free layout with ample whitespace.
2. **Dark Mode:** Supports system preferences or manual toggling.
3. **Citations:** Every claim is backed by a clickable source card.
4. **Context Awareness:** Maintains history and allows follow-up questions.

\`\`\`tsx
// Example of how the SearchInput component might look
function SearchInput({ onSearch }) {
  return (
    <input 
      type="text" 
      placeholder="Ask anything..." 
      onChange={(e) => onSearch(e.target.value)} 
    />
  )
}
\`\`\`

Unlike traditional search engines that return a list of links, this interface synthesizes information into a coherent narrative while remaining transparent about its sources.

---

### Extended Analysis

The implementation of FreeSearch relies heavily on **Next.js 15**, taking advantage of Server Components for initial rendering and Client Components for interactive elements like the streaming answer section. The specific choice to use **Tailwind CSS** allows for rapid prototyping of the visual hierarchy, ensuring that the "premium" feel is achieved through consistent spacing (\`p-4\`, \`p-8\`) and typography (\`font-serif\` for headings).

Furthermore, the **streaming architecture** is crucial. By delivering chunks of text as they are generated, the user feels engaged immediately, rather than waiting for a full response. This mimics the cognitive process of a human answering a question—pausing to think, then articulating.

#### Performance Considerations

1. **Memoization:** As seen in the recent updates, components like \`ReactMarkdown\` are memoized to prevent expensive re-renders during the high-frequency updates of the streaming text.
2. **Layout Stability:** Pre-allocating space for code blocks prevents "layout thrashing" where the page content jumps around as syntax highlighting loads.
3. **Lazy Loading:** The sidebar history and other non-critical elements can be lazy-loaded or virtualized if the list grows too large.

### Future Directions

In the future, FreeSearch could integrate **multimodal capabilities**, allowing users to search with images or voice. The modular design of the \`AnswerSection\` means that embedding images or video clips alongside the text response would be straightforward.

* "Simplicity is the ultimate sophistication." - Leonardo da Vinci
* The goal is not just to find, but to understand.`

export default function Page() {
  const [view, setView] = React.useState<"home" | "result">("home")
  const [query, setQuery] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [answer, setAnswer] = React.useState("")
  const [sources, setSources] = React.useState<Source[]>([])

  const handleSearch = (newQuery: string) => {
    if (!newQuery.trim()) return

    setQuery(newQuery)
    setView("result")
    setIsLoading(true)
    setAnswer("")
    setSources([])

    // Simulate Network Delay
    setTimeout(() => {
      setSources(MOCK_SOURCES)
      setAnswer(MOCK_ANSWER)
      setIsLoading(false)
    }, 1500)
  }

  const handleReset = () => {
    setView("home")
    setQuery("")
    setAnswer("")
    setSources([])
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      <Sidebar />
      
      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        {view === "home" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
            <h1 className="text-4xl md:text-5xl font-light mb-8 font-serif text-center">
              Where knowledge begins
            </h1>
            <SearchInput onSearch={handleSearch} autoFocus />
            
            <div className="mt-8 flex flex-wrap justify-center gap-2">
               {["Plan a trip to Kyoto", "Explain Quantum Entanglement", "Best React patterns"].map((q) => (
                   <Button key={q} variant="secondary" className="text-xs rounded-full" onClick={() => handleSearch(q)}>
                       {q}
                   </Button>
               ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
             <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                {/* Query Header */}
                <h1 className="text-3xl font-serif border-b pb-4">{query}</h1>

                {/* Sources */}
                {sources.length > 0 && (
                   <section>
                      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <span className="text-lg">✦</span> Sources
                      </h2>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {sources.map(s => <SourceCard key={s.index} source={s} />)}
                      </div>
                   </section>
                )}

                {/* Answer */}
                <section>
                    <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <span className="text-lg">✤</span> Answer
                    </h2>
                    <AnswerSection content={answer} isLoading={isLoading} />
                </section>

                {/* Spacer for bottom search bar */}
                <div className="h-40 w-full" aria-hidden="true" />
             </div>
          </div>
        )}

        {/* Sticky Bottom Search (Result View) */}
        {view === "result" && (
            <div className="absolute bottom-4 left-0 right-0 p-4 flex justify-center z-10 pointer-events-none">
                 <div className="w-full max-w-2xl pointer-events-auto">
                    <SearchInput 
                        onSearch={handleSearch} 
                        placeholder="Ask a follow up..." 
                        className="shadow-lg border-primary/10 bg-background" 
                    />
                 </div>
            </div>
        )}
      </main>
    </div>
  )
}
