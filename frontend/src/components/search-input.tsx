"use client"

import * as React from "react"
import { ArrowRight, Globe, Square } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onSearch: (query: string) => void
  onStop?: () => void
  isLoading?: boolean
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function SearchInput({
  onSearch,
  onStop,
  isLoading,
  className,
  value: controlledValue,
  onChange: controlledOnChange,
  ...props
}: SearchInputProps) {
  const [internalQuery, setInternalQuery] = React.useState("")
  
  // Use controlled value if provided, otherwise use internal state
  const isControlled = controlledValue !== undefined
  const query = isControlled ? controlledValue : internalQuery

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (controlledOnChange) {
      controlledOnChange(e)
    }
    if (!isControlled) {
      setInternalQuery(e.target.value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim() && !isLoading) {
      onSearch(query)
      if (!isControlled) {
        setInternalQuery("")
      }
    }
  }

  const handleButtonClick = () => {
    if (query.trim()) {
      onSearch(query)
      if (!isControlled) {
        setInternalQuery("")
      }
    }
  }

  // Determine which icon to show
  const Icon = isLoading ? (
    // Simple spinner for loading state
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  ) : (
    // Globe icon that rotates slowly (Insight Star concept with Globe)
    <Globe className="h-5 w-5 text-teal-400 animate-spin-slow" />
  )

  return (
    <div className="relative w-full max-w-2xl px-4 md:px-0">
      <div className="relative flex items-center group">
        <div className="absolute left-4 flex items-center justify-center">
            {Icon}
        </div>
        <Input
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          // Generating text effect (shimmer) could be applied here if we had a separate element, 
          // but for Input placeholder is standard. 
          placeholder={isLoading ? "Generating..." : "Search anything..."}
          className={cn(
            "h-14 w-full rounded-full border-white/10 bg-[#0a0a0a] pl-12 pr-14 text-lg shadow-lg transition-all focus-visible:ring-1 focus-visible:ring-teal-400/50",
            className
          )}
          {...props}
        />
        <div className="absolute right-2 top-2">
          {isLoading && onStop ? (
            <Button
              size="icon"
              className="h-10 w-10 rounded-full bg-red-500/90 hover:bg-red-500 text-white transition-all"
              onClick={onStop}
              type="button"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              className={cn(
                "h-10 w-10 rounded-full transition-all",
                query.trim() ? "bg-teal-400 hover:bg-teal-500 text-black" : "bg-zinc-800 text-zinc-500"
              )}
              disabled={!query.trim() || isLoading}
              onClick={handleButtonClick}
              type="button"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
