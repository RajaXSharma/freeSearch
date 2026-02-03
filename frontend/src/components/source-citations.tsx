"use client"

import * as React from "react"
import { X, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
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
        "fixed inset-y-0 right-0 z-50 w-full md:w-80 lg:w-96 bg-[#0a0a0a] border-l border-white/5 transform transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-white/90">
            <Globe className="h-4 w-4" />
            Source Citations
            <span className="text-xs font-normal text-muted-foreground ml-1">({sources.length})</span>
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
