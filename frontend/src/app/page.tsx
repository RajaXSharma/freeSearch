"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { SearchInput } from "@/components/search-input"


export default function Page() {
  const router = useRouter()
  const [isCreatingChat, setIsCreatingChat] = React.useState(false)

  const handleSearch = async (query: string) => {
    if (!query.trim() || isCreatingChat) return

    try {
      setIsCreatingChat(true)

      const response = await fetch("/api/chats", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to create chat")
      }

      const chat = await response.json()
      router.push(`/chat/${chat.id}?q=${encodeURIComponent(query)}`)
    } catch (error) {
      console.error("Failed to create chat:", error)
      setIsCreatingChat(false)
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center w-full max-w-[640px]">
          <h1 className="text-[2rem] font-medium tracking-tight mb-6 text-center">
            Where knowledge begins
          </h1>
          <SearchInput
            onSearch={handleSearch}
            autoFocus
            isLoading={isCreatingChat}
            disabled={isCreatingChat}
          />
        </div>
      </main>
    </div>
  )
}
