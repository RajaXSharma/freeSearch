"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import { createHighlighter } from "shiki"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"

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

  React.useEffect(() => {
    if (skipAnimation) {
      setDisplayedContent(content)
      setIsDoneTyping(true)
      return
    }

    if (isLoading) {
      setDisplayedContent("")
      setIsDoneTyping(false)
      return
    }

    let mounted = true
    let currentIndex = 0
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

    animationFrameId = requestAnimationFrame(animate)

    return () => {
      mounted = false
      cancelAnimationFrame(animationFrameId)
    }
  }, [content, isLoading, skipAnimation])

  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none w-full text-[15px] leading-relaxed">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[80%]" />
        </div>
      ) : (
        <>
          <MemoizedReactMarkdown
            components={{
              p({ node, children, ...props }: any) {
                return (
                  <p className="my-4 leading-7" {...props}>
                    {children}
                  </p>
                )
              },
              strong({ node, children, ...props }: any) {
                return (
                  <strong className="font-semibold" {...props}>
                    {children}
                  </strong>
                )
              },
              ul({ node, children, ...props }: any) {
                return (
                  <ul className="my-4 space-y-2 list-disc list-outside pl-5" {...props}>
                    {children}
                  </ul>
                )
              },
              ol({ node, children, ...props }: any) {
                return (
                  <ol className="my-4 space-y-2 list-decimal list-outside pl-5" {...props}>
                    {children}
                  </ol>
                )
              },
              li({ node, children, ...props }: any) {
                return (
                  <li className="leading-7" {...props}>
                    {children}
                  </li>
                )
              },
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || "")
                return !inline && match ? (
                  <CodeBlock language={match[1]} value={String(children).replace(/\n$/, "")} />
                ) : (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-medium" {...props}>
                    {children}
                  </code>
                )
              },
              a({ node, children, href, ...props }: any) {
                const isCitation = /^\[\d+\]$/.test(String(children))
                return (
                  <a
                    href={href}
                    className={isCitation
                      ? "text-primary font-medium no-underline hover:underline text-sm align-super"
                      : "text-primary hover:underline"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  >
                    {children}
                  </a>
                )
              },
            }}
          >
            {displayedContent}
          </MemoizedReactMarkdown>
          
          {isDoneTyping && props.onToggleSources && (
            <div className="mt-4 flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-2 text-xs h-8"
                    onClick={props.onToggleSources}
                >
                    <div className="flex -space-x-2 mr-0.5">
                       <div className="w-2 h-2 rounded-full bg-current opacity-60" />
                       <div className="w-2 h-2 rounded-full bg-current opacity-80" />
                       <div className="w-2 h-2 rounded-full bg-current" />
                    </div>
                    View Sources {props.sourceCount ? `(${props.sourceCount})` : ''}
                </Button>
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

        const generatedHtml = highlighter.codeToHtml(value, {
          lang: language,
          theme: "github-dark",
        })

        if (mounted) {
          setHtml(generatedHtml)
        }
      } catch (e) {}
    }
    highlight()
    return () => { mounted = false }
  }, [language, value])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const Header = (
    <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 rounded-t-lg">
        <span className="text-xs text-zinc-400">{language}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-zinc-400 hover:text-zinc-50"
          onClick={copyToClipboard}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
  )

  if (!html) {
    return (
        <div className="relative my-4 rounded-lg border bg-zinc-950">
             {Header}
             <pre className="overflow-x-auto p-4 text-sm font-mono text-zinc-50">
                <code>{value}</code>
            </pre>
        </div>
    )
  }

  return (
    <div className="relative my-4 rounded-lg border bg-zinc-950">
      {Header}
      <div
        className="overflow-x-auto p-4 text-sm [&>pre]:bg-transparent! [&>pre]:p-0!"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
})
