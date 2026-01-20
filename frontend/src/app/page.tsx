"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { SearchInput } from "@/components/search-input"
import { Button } from "@/components/ui/button"

export default function Page() {
  const router = useRouter()
  const [isCreatingChat, setIsCreatingChat] = React.useState(false)

  const handleSearch = async (query: string) => {
    if (!query.trim() || isCreatingChat) return

    try {
      setIsCreatingChat(true)
      
      // Create a new chat
      const response = await fetch("/api/chats", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to create chat")
      }

      const chat = await response.json()
      
      // Navigate to the new chat page with the query in state
      router.push(`/chat/${chat.id}?q=${encodeURIComponent(query)}`)
    } catch (error) {
      console.error("Failed to create chat:", error)
      setIsCreatingChat(false)
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      <Sidebar />
      
      <main className="flex-1 flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
        <h1 className="text-4xl md:text-5xl font-light mb-8 font-serif text-center">
          Where knowledge begins
        </h1>
        <SearchInput 
          onSearch={handleSearch} 
          autoFocus 
          isLoading={isCreatingChat}
          disabled={isCreatingChat}
        />
        
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {[
            "Plan a trip to Kyoto", 
            "Explain Quantum Entanglement", 
            "Best React patterns"
          ].map((q) => (
            <Button 
              key={q} 
              variant="secondary" 
              className="text-xs rounded-full" 
              onClick={() => handleSearch(q)}
              disabled={isCreatingChat}
            >
              {q}
            </Button>
          ))}
        </div>
      </main>
    </div>
  )
}
