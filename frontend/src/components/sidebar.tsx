"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Plus, Menu, MessageSquare, Trash2 } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Chat {
  id: string
  title: string
  updatedAt: string
}

type SidebarProps = React.HTMLAttributes<HTMLDivElement>

export function Sidebar({ className }: SidebarProps) {
  const [chats, setChats] = React.useState<Chat[]>([])
  const [chatToDelete, setChatToDelete] = React.useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    async function fetchChats() {
      try {
        const response = await fetch("/api/chats")
        if (response.ok) {
          const data = await response.json()
          setChats(data)
        }
      } catch (error) {
        console.error("Failed to fetch chats:", error)
      }
    }

    fetchChats()
  }, [pathname])

  const handleNewChat = () => {
    router.push("/")
  }

  const confirmDeleteChat = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!chatToDelete) return

    try {
      const response = await fetch(`/api/chats/${chatToDelete}`, { method: "DELETE" })
      if (response.ok) {
        setChats((prev) => prev.filter((c) => c.id !== chatToDelete))
        if (pathname === `/chat/${chatToDelete}`) {
          router.push("/")
        }
      }
    } catch (error) {
      console.error("Failed to delete chat:", error)
    } finally {
      setChatToDelete(null)
    }
  }

  const openDeleteDialog = (chatId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setChatToDelete(chatId)
  }

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="fixed left-4 top-4 z-40 md:hidden">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[240px] p-0 bg-[var(--color-sidebar)]">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarContent
            chats={chats}
            pathname={pathname}
            onNewChat={handleNewChat}
            onDelete={openDeleteDialog}
          />
        </SheetContent>
      </Sheet>

      <aside
        className={cn(
          "hidden h-full w-[240px] flex-col border-r border-border bg-[var(--color-sidebar)] md:flex",
          className
        )}
      >
        <SidebarContent
          chats={chats}
          pathname={pathname}
          onNewChat={handleNewChat}
          onDelete={openDeleteDialog}
        />
      </aside>

      <AlertDialog open={!!chatToDelete} onOpenChange={(open: boolean) => !open && setChatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this thread?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your chat history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChatToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface SidebarContentProps {
  chats: Chat[]
  pathname: string
  onNewChat: () => void
  onDelete: (chatId: string, e: React.MouseEvent) => void
}

function SidebarContent({ chats, pathname, onNewChat, onDelete }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col p-4">
      {/* Brand */}
      <div className="px-2 pb-6 pt-2">
        <span className="font-semibold text-lg">freeSearch</span>
      </div>

      {/* New Thread Button */}
      <button
        onClick={onNewChat}
        className="flex items-center justify-between w-full px-3 py-2 mb-6 text-sm font-medium rounded-full border border-border bg-background hover:bg-muted transition-colors duration-150"
      >
        <span>New Thread</span>
        <Plus className="h-3.5 w-3.5" />
      </button>

      {/* Recent Threads */}
      <div className="flex-1 overflow-hidden">
        <div className="px-3 pb-1 text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Recent Threads
        </div>

        <ScrollArea className="h-full">
          <nav className="flex flex-col gap-1 mt-2">
            {chats.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                No conversations yet
              </p>
            ) : (
              chats.map((chat) => {
                const isActive = pathname === `/chat/${chat.id}`
                const truncatedTitle = chat.title.split(' ').slice(0, 4).join(' ') + (chat.title.split(' ').length > 4 ? '...' : '')
                return (
                  <div
                    key={chat.id}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150",
                      isActive
                        ? "bg-[var(--color-nav-active-bg)] text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Link
                      href={`/chat/${chat.id}`}
                      className="flex items-center gap-2 flex-1 min-w-0"
                    >
                      <MessageSquare className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{truncatedTitle}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => onDelete(chat.id, e)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                )
              })
            )}
          </nav>
        </ScrollArea>
      </div>

      {/* Theme Toggle */}
      <div className="mt-auto pt-4 border-t border-border">
        <ThemeToggle />
      </div>
    </div>
  )
}
