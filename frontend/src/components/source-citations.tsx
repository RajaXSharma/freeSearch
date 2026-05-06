"use client"

import * as React from "react"
import { X, BookOpen } from "lucide-react"
import { SourceCard, type Source } from "@/components/source-card"
import { cn } from "@/lib/utils"

interface SourceCitationsProps {
  isOpen: boolean
  onClose: () => void
  sources: Source[]
}

export function SourceCitations({ isOpen, onClose, sources }: SourceCitationsProps) {
  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-50 w-full md:w-80 lg:w-96 bg-[var(--color-sidebar)] border-l border-border transform transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Sources
            <span className="text-sm font-normal text-muted-foreground">({sources.length})</span>
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sources.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              <p>No sources available.</p>
            </div>
          ) : (
            sources.map((source) => (
              <SourceCard key={source.index} source={source} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
