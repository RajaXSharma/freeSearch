"use client"

import * as React from "react"
import { Search, ArrowRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onSearch: (query: string) => void
  isLoading?: boolean
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function SearchInput({ 
  onSearch, 
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
    if (e.key === "Enter" && query.trim()) {
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

  return (
    <div className="relative w-full max-w-2xl">
      <div className="relative flex items-center">
        <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="h-14 rounded-full border-muted-foreground/20 bg-card pl-12 pr-14 text-lg shadow-sm transition-all focus-visible:ring-primary/20"
          {...props}
        />
        <div className="absolute right-2 top-2">
          <Button
            size="icon"
            className="h-10 w-10 rounded-full"
            disabled={!query.trim() || isLoading}
            onClick={handleButtonClick}
            type="button"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
