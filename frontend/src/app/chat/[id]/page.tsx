"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useChat, type UIMessage } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Sidebar } from "@/components/sidebar"
import { SearchInput } from "@/components/search-input"
import { type Source } from "@/components/source-card"
import { AnswerSection } from "@/components/answer-section"
import { Button } from "@/components/ui/button"
import { SourceCitations } from "@/components/source-citations"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const chatId = params.id as string

  const [currentSources, setCurrentSources] = React.useState<Source[]>([])
  const [isInitialLoad, setIsInitialLoad] = React.useState(true)
  const [hasLoadedHistory, setHasLoadedHistory] = React.useState(false)
  const [hasSubmittedInitialQuery, setHasSubmittedInitialQuery] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [historyMessageIds, setHistoryMessageIds] = React.useState<Set<string>>(new Set())
  const [isRightSidebarOpen, setIsRightSidebarOpen] = React.useState(false) // State for right sidebar
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

 
  const {
    messages,
    status,
    error,
    sendMessage,
    setMessages,
  } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { chatId },
    }),
    // Handle custom data parts (sources) from the stream
    onData: (dataPart) => {
      if (dataPart.type === 'data-sources' && Array.isArray(dataPart.data)) {
        setCurrentSources(dataPart.data as Source[])
      }
    },
  })

  // Derive loading state from status
  const isLoading = status === 'submitted' || status === 'streaming'

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load existing chat messages on mount
  React.useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await fetch(`/api/chats/${chatId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.messages && data.messages.length > 0) {
            // Convert DB messages to AI SDK UIMessage format
            const formattedMessages: UIMessage[] = data.messages.map((msg: { id: string; role: string; content: string }) => ({
              id: msg.id,
              role: msg.role as "user" | "assistant",
              content: msg.content,
              parts: [{ type: 'text' as const, text: msg.content }],
            }))
            // Track which messages came from history (skip animation for these)
            setHistoryMessageIds(new Set(formattedMessages.map(m => m.id)))
            setMessages(formattedMessages)
          }
        } else if (response.status === 404) {
          // Chat not found - redirect to home
          console.warn("Chat not found, redirecting to home")
          router.push("/")
          return
        }
      } catch (err) {
        console.error("Failed to load chat history:", err)
      } finally {
        setIsInitialLoad(false)
        setHasLoadedHistory(true)
      }
    }

    if (chatId) {
      loadChatHistory()
    }
  }, [chatId, setMessages, router])

  // Handle initial query from URL after history is loaded
  React.useEffect(() => {
    if (!hasLoadedHistory || hasSubmittedInitialQuery) return

    const urlParams = new URLSearchParams(window.location.search)
    const initialQuery = urlParams.get('q')
    
    if (initialQuery && messages.length === 0) {
      setHasSubmittedInitialQuery(true)
      // Clear sources before new query
      setCurrentSources([])
      sendMessage({ text: initialQuery })
    }
  }, [hasLoadedHistory, hasSubmittedInitialQuery, messages.length, sendMessage])

  // Handle form submission
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (input.trim() && !isLoading) {
      setCurrentSources([]) // Clear sources for new query
      sendMessage({ text: input })
      setInput("")
    }
  }

  // Handle search from SearchInput component
  const handleSearchInput = async (query: string) => {
    if (!query.trim() || isLoading) return
    setCurrentSources([]) // Clear sources for new query
    sendMessage({ text: query })
    setInput("") // Clear the input after sending
  }

  // Helper to extract text content from message
  const getMessageContent = (message: UIMessage): string => {
    // AI SDK UIMessage uses parts array format
    if (message.parts && message.parts.length > 0) {
      return message.parts
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map(part => part.text)
        .join('')
    }
    return ''
  }

  const userMessages = messages.filter((m) => m.role === "user")
  const currentQuery = userMessages.length > 0 ? getMessageContent(userMessages[userMessages.length - 1]) : ""

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0f0f0f] text-foreground font-sans selection:bg-teal-500/30">
      <Sidebar />

      <main className="flex-1 flex flex-col relative h-full overflow-hidden bg-[#0f0f0f]">
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
                        {getMessageContent(message)}
                      </h2>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* 
                        For the most recent message, if we have sources, show the header but not the inline cards.
                        The user can toggle them via the button in AnswerSection. 
                        Actually, we can just hide the Sources section entirely here since it will be in the sidebar.
                      */}

                      {/* Answer */}
                      <section>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <span className="text-lg">✤</span> Answer
                        </h3>
                          <AnswerSection
                            content={getMessageContent(message)}
                            isLoading={isLoading && idx === messages.length - 1}
                            skipAnimation={historyMessageIds.has(message.id)}
                            onToggleSources={
                              // Only show sources button for the last message if we have sources
                              (idx === messages.length - 1 && currentSources.length > 0)
                                ? () => setIsRightSidebarOpen(prev => !prev) 
                                : undefined
                            }
                            sourceCount={idx === messages.length - 1 ? currentSources.length : 0}
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

            {/* Error display */}
            {error && (
              <div className="text-red-500 text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                Error: {error.message}
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
                className="shadow-2xl border-white/5 bg-[#0a0a0a]"
                isLoading={isLoading}
                disabled={isLoading}
              />
            </form>
          </div>
        </div>
      </main>

      {/* Source Citations Sidebar */}
      <SourceCitations 
        isOpen={isRightSidebarOpen} 
        onClose={() => setIsRightSidebarOpen(false)} 
        sources={currentSources}
      />
    </div>
  )
}
