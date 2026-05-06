import { Globe } from "lucide-react"

export interface Source {
  title: string
  url: string
  snippet?: string
  index: number
}

interface SourceCardProps {
  source: Source
}

export function SourceCard({ source }: SourceCardProps) {
  let domain = ""
  let faviconUrl = ""
  try {
    if (source.url) {
      const urlObj = new URL(source.url)
      domain = urlObj.hostname.replace(/^www\./, "")
      faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
    }
  } catch {}

  const hasValidUrl = source.url && domain

  const content = (
    <div className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-background transition-all duration-150 hover:bg-[var(--color-surface)] hover:border-[var(--color-surface-hover)] cursor-pointer">
      {/* Domain header */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {hasValidUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={faviconUrl}
              alt=""
              className="h-4 w-4 rounded-sm bg-muted"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <span>{domain}</span>
          </>
        ) : (
          <>
            <div className="h-4 w-4 rounded-sm bg-muted flex items-center justify-center">
              <Globe className="h-2.5 w-2.5" />
            </div>
            <span>No link</span>
          </>
        )}
      </div>

      {/* Title */}
      <div className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
        {source.title || "Untitled"}
      </div>
    </div>
  )

  if (hasValidUrl) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {content}
      </a>
    )
  }

  return content
}
