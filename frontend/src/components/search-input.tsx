"use client"

import * as React from "react"
import { ArrowRight, Square } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onSearch: (query: string) => void
  onStop?: () => void
  isLoading?: boolean
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  variant?: "default" | "compact"
}

export function SearchInput({
  onSearch,
  onStop,
  isLoading,
  className,
  value: controlledValue,
  onChange: controlledOnChange,
  variant = "default",
  placeholder,
  ...props
}: SearchInputProps) {
  const [internalQuery, setInternalQuery] = React.useState("")
  const isControlled = controlledValue !== undefined
  const query = isControlled ? controlledValue : internalQuery
  const hasValue = query.trim().length > 0

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
    if (isLoading && onStop) {
      onStop()
      return
    }
    if (query.trim()) {
      onSearch(query)
      if (!isControlled) {
        setInternalQuery("")
      }
    }
  }

  const isCompact = variant === "compact"

  return (
    <div className={cn("relative w-full", isCompact ? "max-w-[760px]" : "max-w-2xl", className)}>
      <div
        className={cn(
          "flex items-center rounded-full border border-border bg-background transition-all duration-150",
          isCompact
            ? "px-4 py-1 bg-muted"
            : "px-6 py-1.5 shadow-[0_2px_6px_rgba(0,0,0,0.02)]",
          "focus-within:border-muted-foreground focus-within:shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
        )}
      >
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || (isLoading ? "Generating..." : "Ask anything...")}
          className={cn(
            "flex-1 bg-transparent border-none outline-none font-[inherit]",
            isCompact ? "text-base py-2" : "text-lg py-3",
            "placeholder:text-muted-foreground"
          )}
          {...props}
        />
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={!hasValue && !isLoading}
          className={cn(
            "flex items-center justify-center rounded-full transition-all duration-150 ml-2",
            isCompact ? "w-8 h-8" : "w-10 h-10",
            isLoading
              ? "bg-destructive text-destructive-foreground"
              : hasValue
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
          )}
        >
          {isLoading ? (
            <Square className={cn(isCompact ? "h-3 w-3" : "h-4 w-4", "fill-current")} />
          ) : (
            <ArrowRight className={isCompact ? "h-3 w-3" : "h-4 w-4"} />
          )}
        </button>
      </div>
    </div>
  )
}
