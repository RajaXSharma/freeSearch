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

Unlike traditional search engines that return a list of links, this interface synthesizes information into a coherent narrative while remaining transparent about its sources.`

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
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <Sidebar />
      
      <main className="flex-1 flex flex-col relative h-screen overflow-hidden">
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
          <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 scroll-smooth">
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


             </div>
          </div>
        )}

        {/* Sticky Bottom Search (Result View) */}
        {view === "result" && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent p-4 pb-8 flex justify-center z-10">
                 <div className="w-full max-w-2xl relative">
                    <SearchInput 
                        onSearch={handleSearch} 
                        placeholder="Ask a follow up..." 
                        className="shadow-lg border-primary/10 bg-background/80 backdrop-blur-md" 
                    />
                 </div>
            </div>
        )}
      </main>
    </div>
  )
}
