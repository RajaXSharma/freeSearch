"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { SearchInput } from "@/components/search-input"
import { SourceCard, type Source } from "@/components/source-card"
import { AnswerSection } from "@/components/answer-section"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: Source[]
}

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const chatId = params.id as string

  const [messages, setMessages] = React.useState<Message[]>([])
  const [currentSources, setCurrentSources] = React.useState<Source[]>([])
  const [isInitialLoad, setIsInitialLoad] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasSubmittedInitialQuery, setHasSubmittedInitialQuery] = React.useState(false)
  const [input, setInput] = React.useState("")
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load existing chat messages on mount and handle initial query from URL
  React.useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await fetch(`/api/chats/${chatId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages)
          }
        }
      } catch (err) {
        console.error("Failed to load chat history:", err)
      } finally {
        setIsInitialLoad(false)
      }
    }

    const handleInitialQuery = () => {
      // Check if there's a query parameter from the homepage
      const urlParams = new URLSearchParams(window.location.search)
      const initialQuery = urlParams.get('q')
      
      if (initialQuery && !hasSubmittedInitialQuery && messages.length === 0) {
        setHasSubmittedInitialQuery(true)
        handleSearchInput(initialQuery)
      }
    }

    if (chatId) {
      loadChatHistory().then(() => {
        handleInitialQuery()
      })
    }
  }, [chatId]) // Only run on mount

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setCurrentSources([])

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          chatId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      // Extract sources from headers
      const sourcesHeader = response.headers.get("X-Sources")
      if (sourcesHeader) {
        try {
          const decodedSources = JSON.parse(decodeURIComponent(sourcesHeader))
          const formattedSources: Source[] = decodedSources.map((s: any, idx: number) => ({
            title: s.title || s.url,
            url: s.url,
            snippet: s.snippet,
            index: idx + 1,
          }))
          setCurrentSources(formattedSources)
        } catch (e) {
          console.error("Failed to parse sources:", e)
        }
      }

      // Stream the response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (reader) {
        let done = false
        while (!done) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone

          if (value) {
            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split("\n")

            for (const line of lines) {
              if (line.startsWith("0:")) {
                try {
                  const jsonStr = line.slice(2).trim()
                  if (jsonStr) {
                    const parsed = JSON.parse(jsonStr)
                    if (parsed.text) {
                      setMessages((prev) => {
                        const newMessages = [...prev]
                        const lastMessage = newMessages[newMessages.length - 1]
                        if (lastMessage && lastMessage.role === "assistant") {
                          lastMessage.content += parsed.text
                        }
                        return newMessages
                      })
                    }
                  }
                } catch (e) {
                  // Ignore parse errors for partial chunks
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (input.trim()) {
      await sendMessage(input)
      setInput("")
    }
  }

  const handleSearchInput = async (query: string) => {
    if (!query.trim()) return
    await sendMessage(query)
  }

  const userMessages = messages.filter((m) => m.role === "user")
  const currentQuery = userMessages[userMessages.length - 1]?.content || ""

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/")}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-medium truncate">
            {currentQuery || "New Chat"}
          </h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-8">
            {isInitialLoad && messages.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-muted-foreground mb-4">Start a conversation</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    "What is quantum computing?",
                    "Explain neural networks",
                    "Best practices for React",
                  ].map((q) => (
                    <Button
                      key={q}
                      variant="secondary"
                      className="text-xs rounded-full"
                      onClick={() => handleSearchInput(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, idx) => (
                <div
                  key={message.id}
                  className="animate-in slide-in-from-bottom-4 duration-500"
                >
                  {message.role === "user" ? (
                    <div className="mb-6">
                      <h2 className="text-2xl md:text-3xl font-serif border-b pb-4">
                        {message.content}
                      </h2>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Sources (only show for the most recent response or if sources exist) */}
                      {idx === messages.length - 1 && currentSources.length > 0 && (
                        <section>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <span className="text-lg">✦</span> Sources
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {currentSources.map((source) => (
                              <SourceCard key={source.index} source={source} />
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Answer */}
                      <section>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <span className="text-lg">✤</span> Answer
                        </h3>
                        <AnswerSection
                          content={message.content}
                          isLoading={isLoading && idx === messages.length - 1}
                        />
                      </section>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Loading indicator for new response */}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="animate-in slide-in-from-bottom-4 duration-500">
                <section>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <span className="text-lg">✤</span> Answer
                  </h3>
                  <AnswerSection content="" isLoading={true} />
                </section>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />

            {/* Spacer for bottom search bar */}
            <div className="h-40 w-full" aria-hidden="true" />
          </div>
        </div>

        {/* Sticky Bottom Search */}
        <div className="absolute bottom-4 left-0 right-0 p-4 flex justify-center z-10 pointer-events-none">
          <div className="w-full max-w-2xl pointer-events-auto">
            <form onSubmit={handleFormSubmit} className="relative">
              <SearchInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onSearch={handleSearchInput}
                placeholder="Ask a follow up..."
                className="shadow-lg border-primary/10 bg-background"
                isLoading={isLoading}
                disabled={isLoading}
              />
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
