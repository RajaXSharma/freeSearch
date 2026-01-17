import Image from "next/image"

export interface Source {
  title: string
  url: string
  favicon?: string
  index: number
}

interface SourceCardProps {
  source: Source
}

export function SourceCard({ source }: SourceCardProps) {
  // Use a fallback for favicon if not present, e.g., a simple globe icon or domain parse
  const domain = new URL(source.url).hostname

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-[200px] max-w-[240px] flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-secondary/50"
    >
      <div className="text-xs font-semibold text-muted-foreground truncate">
        {source.title}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] text-secondary-foreground ring-1 ring-border">
          {source.index}
        </div>
        <span className="truncate text-xs text-muted-foreground">{domain}</span>
      </div>
    </a>
  )
}
