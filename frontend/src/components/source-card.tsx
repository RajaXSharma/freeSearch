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
  // Safely parse domain from URL
  let domain = ""
  let faviconUrl = ""
  try {
    if (source.url) {
      const urlObj = new URL(source.url)
      domain = urlObj.hostname.replace(/^www\./, "")
      faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
    }
  } catch {
    // Invalid URL, keep defaults
  }

  const hasValidUrl = source.url && domain

  const content = (
    <div className="flex h-full flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-secondary/50">
      {/* Title */}
      <div className="text-sm font-medium line-clamp-2 leading-tight">
        {source.title || "Untitled"}
      </div>

      {/* Snippet */}
      {source.snippet && (
        <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
          {source.snippet}
        </p>
      )}

      {/* Footer with index and domain */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
          {source.index}
        </div>
        {hasValidUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={faviconUrl}
              alt=""
              className="h-3 w-3"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <span className="truncate text-xs text-muted-foreground">{domain}</span>
          </>
        ) : (
          <>
            <Globe className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">No link</span>
          </>
        )}
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
