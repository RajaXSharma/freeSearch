"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useChat, type UIMessage } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Sidebar } from "@/components/sidebar"
import { SearchInput } from "@/components/search-input"
import { SourceCard, type Source } from "@/components/source-card"
import { AnswerSection } from "@/components/answer-section"
import { SourceCitations } from "@/components/source-citations"
import { Loader2, BookOpen, AlignLeft } from "lucide-react"

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
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[760px] mx-auto px-6 py-8 pb-40">
            {isInitialLoad && messages.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-muted-foreground">Start a conversation</p>
              </div>
            ) : (
              messages.map((message, idx) => {
                const isLastMessage = idx === messages.length - 1
                const messageSources = message.role === "assistant"
                  ? getSourcesForMessage(message.id, isLastMessage)
                  : []

                return (
                  <div key={message.id} className="mb-8">
                    {message.role === "user" ? (
                      <h1 className="text-[2rem] font-medium tracking-tight leading-tight mb-8">
                        {getMessageContent(message)}
                      </h1>
                    ) : (
                      <div className="space-y-8 animate-[fade-up_0.6s_ease-out]">
                        {/* Sources Section */}
                        {messageSources.length > 0 && (
                          <section>
                            <h3 className="flex items-center gap-2 text-lg font-medium mb-4">
                              <BookOpen className="h-[18px] w-[18px]" />
                              Sources
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {messageSources.slice(0, 3).map((source) => (
                                <SourceCard key={source.index} source={source} />
                              ))}
                            </div>
                            {messageSources.length > 3 && (
                              <button
                                onClick={() => {
                                  setSelectedMessageId(message.id)
                                  setIsRightSidebarOpen(true)
                                }}
                                className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                              >
                                +{messageSources.length - 3} more sources
                              </button>
                            )}
                          </section>
                        )}

                        {/* Answer Section */}
                        <section>
                          <h3 className="flex items-center gap-2 text-lg font-medium mb-4">
                            <AlignLeft className="h-[18px] w-[18px]" />
                            Answer
                          </h3>
                          <AnswerSection
                            content={getMessageContent(message)}
                            isLoading={isLoading && isLastMessage}
                            skipAnimation={historyMessageIds.has(message.id)}
                            onToggleSources={
                              messageSources.length > 0
                                ? () => {
                                    setSelectedMessageId(message.id)
                                    setIsRightSidebarOpen(true)
                                  }
                                : undefined
                            }
                            sourceCount={messageSources.length}
                          />
                        </section>
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="space-y-8 animate-[fade-up_0.6s_ease-out]">
                {currentSources.length > 0 && (
                  <section>
                    <h3 className="flex items-center gap-2 text-lg font-medium mb-4">
                      <BookOpen className="h-[18px] w-[18px]" />
                      Sources
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentSources.slice(0, 3).map((source) => (
                        <SourceCard key={source.index} source={source} />
                      ))}
                    </div>
                  </section>
                )}
                <section>
                  <h3 className="flex items-center gap-2 text-lg font-medium mb-4">
                    <AlignLeft className="h-[18px] w-[18px]" />
                    Answer
                  </h3>
                  <AnswerSection content="" isLoading={true} />
                </section>
              </div>
            )}

            {error && (
              <div className="text-destructive text-center p-4 bg-destructive/10 rounded-lg">
                Error: {error.message}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom Search */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
          <div className="max-w-[760px] mx-auto pointer-events-auto">
            <form onSubmit={handleFormSubmit}>
              <SearchInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onSearch={handleSearchInput}
                onStop={stop}
                placeholder="Ask a follow-up..."
                variant="compact"
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
