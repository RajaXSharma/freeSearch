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

  const [sourcesMap, setSourcesMap] = React.useState<Record<string, Source[]>>({})
  const [currentSources, setCurrentSources] = React.useState<Source[]>([])
  const [selectedMessageId, setSelectedMessageId] = React.useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = React.useState(true)
  const [hasLoadedHistory, setHasLoadedHistory] = React.useState(false)
  const [hasSubmittedInitialQuery, setHasSubmittedInitialQuery] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [historyMessageIds, setHistoryMessageIds] = React.useState<Set<string>>(new Set())
  const [isRightSidebarOpen, setIsRightSidebarOpen] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const currentSourcesRef = React.useRef<Source[]>([])

 
  const {
    messages,
    status,
    error,
    sendMessage,
    setMessages,
    stop,
  } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { chatId },
    }),
    onData: (dataPart) => {
      if (dataPart.type === 'data-sources' && Array.isArray(dataPart.data)) {
        const sources = dataPart.data as Source[]
        currentSourcesRef.current = sources
        setCurrentSources(sources)
      }
    },
    onFinish: ({ message }) => {
      if (currentSourcesRef.current.length > 0 && message?.id) {
        setSourcesMap(prev => ({
          ...prev,
          [message.id]: currentSourcesRef.current
        }))
      }
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  React.useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await fetch(`/api/chats/${chatId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.messages && data.messages.length > 0) {
            const formattedMessages: UIMessage[] = data.messages.map((msg: { id: string; role: string; content: string }) => ({
              id: msg.id,
              role: msg.role as "user" | "assistant",
              content: msg.content,
              parts: [{ type: 'text' as const, text: msg.content }],
            }))
            setHistoryMessageIds(new Set(formattedMessages.map(m => m.id)))
            setMessages(formattedMessages)

            const newSourcesMap: Record<string, Source[]> = {}
            data.messages.forEach((msg: { id: string; role: string; sources?: string }) => {
              if (msg.role === "assistant" && msg.sources) {
                try {
                  const parsedSources = JSON.parse(msg.sources);
                  if (Array.isArray(parsedSources) && parsedSources.length > 0) {
                    newSourcesMap[msg.id] = parsedSources.map((s: { title?: string; url: string; content: string }, idx: number) => ({
                      title: s.title || s.url,
                      url: s.url,
                      snippet: s.content,
                      index: idx + 1,
                    }));
                  }
                } catch (e) {
                  console.error("Failed to parse sources for message:", msg.id, e);
                }
              }
            })
            setSourcesMap(newSourcesMap)
          }
        } else if (response.status === 404) {
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

  React.useEffect(() => {
    if (!hasLoadedHistory || hasSubmittedInitialQuery) return

    const urlParams = new URLSearchParams(window.location.search)
    const initialQuery = urlParams.get('q')
    
    if (initialQuery && messages.length === 0) {
      setHasSubmittedInitialQuery(true)
      sendMessage({ text: initialQuery })
    }
  }, [hasLoadedHistory, hasSubmittedInitialQuery, messages.length, sendMessage])

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (input.trim() && !isLoading) {
      setCurrentSources([])
      currentSourcesRef.current = []
      sendMessage({ text: input })
      setInput("")
    }
  }

  const handleSearchInput = async (query: string) => {
    if (!query.trim() || isLoading) return
    setCurrentSources([])
    currentSourcesRef.current = []
    sendMessage({ text: query })
    setInput("")
  }

  const getMessageContent = (message: UIMessage): string => {
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

  const getSourcesForMessage = (messageId: string, isLastMessage: boolean): Source[] => {
    if (isLastMessage && currentSources.length > 0) {
      return currentSources
    }
    if (sourcesMap[messageId]?.length > 0) {
      return sourcesMap[messageId]
    }
    return []
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0f0f0f] text-foreground font-sans selection:bg-teal-500/30">
      <Sidebar />

      <main className="flex-1 flex flex-col relative h-full overflow-hidden bg-[#0f0f0f]">
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
                      <section>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <span className="text-lg">✤</span> Answer
                        </h3>
                          {(() => {
                            const isLastMessage = idx === messages.length - 1
                            const messageSources = getSourcesForMessage(message.id, isLastMessage)
                            return (
                              <AnswerSection
                                content={getMessageContent(message)}
                                isLoading={isLoading && isLastMessage}
                                skipAnimation={historyMessageIds.has(message.id)}
                                onToggleSources={
                                  messageSources.length > 0
                                    ? () => {
                                        if (selectedMessageId === message.id) {
                                          setIsRightSidebarOpen(prev => !prev)
                                        } else {
                                          setSelectedMessageId(message.id)
                                          setIsRightSidebarOpen(true)
                                        }
                                      }
                                    : undefined
                                }
                                sourceCount={messageSources.length}
                              />
                            )
                          })()}
                      </section>
                    </div>
                  )}
                </div>
              ))
            )}

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

            {error && (
              <div className="text-red-500 text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                Error: {error.message}
              </div>
            )}

            <div ref={messagesEndRef} />
            <div className="h-40 w-full" aria-hidden="true" />
          </div>
        </div>

        <div className="absolute bottom-4 left-0 right-0 p-4 flex justify-center z-10 pointer-events-none">
          <div className="w-full max-w-2xl pointer-events-auto">
            <form onSubmit={handleFormSubmit} className="relative">
              <SearchInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onSearch={handleSearchInput}
                onStop={stop}
                placeholder="Ask a follow up..."
                className="shadow-2xl border-white/5 bg-[#0a0a0a]"
                isLoading={isLoading}
              />
            </form>
          </div>
        </div>
      </main>

      <SourceCitations
        isOpen={isRightSidebarOpen}
        onClose={() => setIsRightSidebarOpen(false)}
        sources={
          selectedMessageId
            ? (sourcesMap[selectedMessageId]?.length > 0 ? sourcesMap[selectedMessageId] : currentSources)
            : []
        }
      />
    </div>
  )
}
