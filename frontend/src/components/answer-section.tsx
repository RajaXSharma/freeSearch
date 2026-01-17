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
}

export function AnswerSection({ content, isLoading }: AnswerSectionProps) {
  const [displayedContent, setDisplayedContent] = React.useState("")
  const [isDoneTyping, setIsDoneTyping] = React.useState(false)

  // Typewriter effect
  React.useEffect(() => {
    if (isLoading) {
      setDisplayedContent("")
      setIsDoneTyping(false)
      return
    }

    let i = 0
    const interval = setInterval(() => {
      if (i < content.length) {
        setDisplayedContent((prev) => prev + content.charAt(i))
        i++
      } else {
        clearInterval(interval)
        setIsDoneTyping(true)
      }
    }, 10) // Speed of typing

    return () => clearInterval(interval)
  }, [content, isLoading])

  // Update logic to handle if content updates while streaming (real streaming behavior usually appends)
  // For this mock, we just assume `content` is the full final string and we type it out.
  // Ideally, if `content` grows, we just type the new parts.
  // Simplified for this task:
  
  React.useEffect(() => {
     if(!isLoading && content) {
         // Optimization: if content is very large, just show it all to avoid slow typing
         if(content.length > 0) {
             // Reset logic handled above, but if we wanted real streaming we'd diff.
         }
     }
  }, [content, isLoading])


  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none w-full">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[80%]" />
        </div>
      ) : (
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || "")
              return !inline && match ? (
                <CodeBlock language={match[1]} value={String(children).replace(/\n$/, "")} />
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            },
          }}
        >
          {displayedContent}
        </ReactMarkdown>
      )}
    </div>
  )
}

// Singleton highlighter instance to prevent re-creation
let highlighterPromise: Promise<any> | null = null;

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: ["typescript", "javascript", "tsx", "jsx", "json", "html", "css", "bash", "python", "markdown"], // Preload common langs
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
        
        // Load language if not pre-loaded (rare but possible)
        if (!highlighter.getLoadedLanguages().includes(language)) {
             try {
                await highlighter.loadLanguage(language)
             } catch (e) {
                // If language fails to load (e.g. transient 't' or 'ts'), fallback to plain text (return)
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
      } catch (e) {
         // Silently fail to plain text
      }
    }
    highlight()
    return () => { mounted = false }
  }, [language, value])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // If HTML is not ready yet, render the PREVIOUS html if available (to stop flickering) 
  // OR render a consistent placeholder. 
  // Since we are streaming, 'value' changes often. 
  
  if (!html) {
    return (
        <div className="relative my-4 rounded-lg border bg-zinc-950 p-4 font-mono text-sm text-zinc-50">
             <div className="absolute right-4 top-4">
                <Button variant="ghost" size="icon" disabled>
                    <Copy className="h-4 w-4 text-zinc-500" />
                </Button>
            </div>
             <pre className="overflow-x-auto py-4">
                <code>{value}</code>
            </pre>
        </div>
    )
  }

  return (
    <div className="relative my-4 rounded-lg border bg-zinc-950">
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
      <div
        className="overflow-x-auto p-4 text-sm [&>pre]:!bg-transparent [&>pre]:!p-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
})
