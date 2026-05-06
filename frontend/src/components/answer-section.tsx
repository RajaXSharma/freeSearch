"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import { createHighlighter } from "shiki"
import { useTheme } from "next-themes"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Copy, Check, RefreshCw, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

interface AnswerSectionProps {
  content: string
  isLoading: boolean
  skipAnimation?: boolean
  onToggleSources?: () => void
  sourceCount?: number
}

const MemoizedReactMarkdown = React.memo(
  ReactMarkdown,
  (prevProps: any, nextProps: any) =>
    prevProps.children === nextProps.children &&
    prevProps.className === nextProps.className
)

export function AnswerSection({ content, isLoading, skipAnimation = false, ...props }: AnswerSectionProps) {
  const [displayedContent, setDisplayedContent] = React.useState(skipAnimation ? content : "")
  const [isDoneTyping, setIsDoneTyping] = React.useState(skipAnimation)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (skipAnimation) {
      setDisplayedContent(content)
      setIsDoneTyping(true)
      return
    }

    if (isLoading && !content) {
      setDisplayedContent("")
      setIsDoneTyping(false)
      return
    }

    let mounted = true
    let currentIndex = displayedContent.length
    let animationFrameId: number
    let lastTime = 0
    const CHARS_PER_FRAME = 3
    const FRAME_DELAY = 16

    function animate(timestamp: number) {
      if (!mounted) return

      if (timestamp - lastTime >= FRAME_DELAY) {
        lastTime = timestamp
        currentIndex = Math.min(currentIndex + CHARS_PER_FRAME, content.length)
        setDisplayedContent(content.slice(0, currentIndex))

        if (currentIndex >= content.length) {
          setIsDoneTyping(true)
          return
        }
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    if (content.length > displayedContent.length) {
      animationFrameId = requestAnimationFrame(animate)
    } else if (content.length === displayedContent.length && content.length > 0) {
      setIsDoneTyping(true)
    }

    return () => {
      mounted = false
      cancelAnimationFrame(animationFrameId)
    }
  }, [content, isLoading, skipAnimation, displayedContent.length])

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const showCursor = isLoading || (!isDoneTyping && displayedContent.length < content.length)

  return (
    <div className="w-full">
      {isLoading && !content ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[80%]" />
        </div>
      ) : (
        <>
          <div className="prose prose-zinc dark:prose-invert max-w-none text-base leading-[1.7]">
            <MemoizedReactMarkdown
              components={{
                p({ children, ...componentProps }: any) {
                  return (
                    <p className="mb-[1.2em] last:mb-0" {...componentProps}>
                      {children}
                    </p>
                  )
                },
                strong({ children, ...componentProps }: any) {
                  return (
                    <strong className="font-semibold" {...componentProps}>
                      {children}
                    </strong>
                  )
                },
                ul({ children, ...componentProps }: any) {
                  return (
                    <ul className="my-4 space-y-2 list-disc list-outside pl-5" {...componentProps}>
                      {children}
                    </ul>
                  )
                },
                ol({ children, ...componentProps }: any) {
                  return (
                    <ol className="my-4 space-y-2 list-decimal list-outside pl-5" {...componentProps}>
                      {children}
                    </ol>
                  )
                },
                li({ children, ...componentProps }: any) {
                  return (
                    <li className="leading-7" {...componentProps}>
                      {children}
                    </li>
                  )
                },
                code({ inline, className, children, ...componentProps }: any) {
                  const match = /language-(\w+)/.exec(className || "")
                  return !inline && match ? (
                    <CodeBlock language={match[1]} value={String(children).replace(/\n$/, "")} />
                  ) : (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-medium" {...componentProps}>
                      {children}
                    </code>
                  )
                },
                a({ children, href, ...componentProps }: any) {
                  const isCitation = /^\[\d+\]$/.test(String(children))
                  if (isCitation) {
                    return (
                      <a
                        href={href}
                        className="citation"
                        target="_blank"
                        rel="noopener noreferrer"
                        {...componentProps}
                      >
                        {String(children).replace(/[\[\]]/g, '')}
                      </a>
                    )
                  }
                  return (
                    <a
                      href={href}
                      className="text-primary hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...componentProps}
                    >
                      {children}
                    </a>
                  )
                },
              }}
            >
              {displayedContent}
            </MemoizedReactMarkdown>
            {showCursor && (
              <span className="streaming-cursor" />
            )}
          </div>

          {/* Action Bar */}
          {isDoneTyping && content && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <button
                onClick={handleCopy}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                  "text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                )}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              {props.onToggleSources && (
                <button
                  onClick={props.onToggleSources}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                    "text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Sources {props.sourceCount ? `(${props.sourceCount})` : ''}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

let highlighterPromise: Promise<any> | null = null;

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: ["typescript", "javascript", "tsx", "jsx", "json", "html", "css", "bash", "python", "markdown"],
    });
  }
  return highlighterPromise;
}

const CodeBlock = React.memo(function CodeBlock({ language, value }: { language: string; value: string }) {
  const [html, setHtml] = React.useState<string>("")
  const [copied, setCopied] = React.useState(false)
  const { theme } = useTheme()

  React.useEffect(() => {
    let mounted = true
    async function highlight() {
      try {
        const highlighter = await getHighlighter()

        if (!highlighter.getLoadedLanguages().includes(language)) {
          try {
            await highlighter.loadLanguage(language)
          } catch (e) {
            return
          }
        }

        const shikiTheme = theme === "light" ? "github-light" : "github-dark"
        const generatedHtml = highlighter.codeToHtml(value, {
          lang: language,
          theme: shikiTheme,
        })

        if (mounted) {
          setHtml(generatedHtml)
        }
      } catch (e) {}
    }
    highlight()
    return () => { mounted = false }
  }, [language, value, theme])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const Header = (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50 rounded-t-xl">
      <span className="text-xs text-muted-foreground">{language}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={copyToClipboard}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  )

  if (!html) {
    return (
      <div className="relative my-4 rounded-xl border bg-card">
        {Header}
        <pre className="overflow-x-auto p-4 text-sm font-mono text-foreground">
          <code>{value}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className="relative my-4 rounded-xl border bg-card">
      {Header}
      <div
        className="overflow-x-auto p-4 text-sm [&>pre]:bg-transparent! [&>pre]:p-0!"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
})
