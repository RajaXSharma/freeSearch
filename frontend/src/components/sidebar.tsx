"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Plus, Menu, MessageSquare, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PanelLeft, PanelLeftClose } from "lucide-react"
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
  const [isCollapsed, setIsCollapsed] = React.useState(false)
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
    <TooltipProvider delayDuration={0}>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="fixed left-4 top-4 z-40 md:hidden">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[260px] p-0">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarContent 
            chats={chats} 
            onNewChat={handleNewChat}
            onDelete={openDeleteDialog}
          />
        </SheetContent>
      </Sheet>

      <aside
        className={cn(
          "hidden h-full flex-col border-r border-white/5 bg-[#0a0a0a] transition-[width] duration-300 md:flex",
          isCollapsed ? "w-[60px]" : "w-[260px]",
          className
        )}
      >
        <div className="flex h-full flex-col">
           <div className={cn("flex h-14 items-center border-b border-white/5", isCollapsed ? "justify-center" : "justify-between px-4")}>
             {!isCollapsed && (
                <Link href="/" className="font-serif font-medium text-lg flex items-center animate-in fade-in duration-300 tracking-tight">
                    <span className="text-teal-400 mr-2 text-xl">✦</span> FreeSearch
                </Link>
             )}
             <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/5"
                onClick={() => setIsCollapsed(!isCollapsed)}
             >
                {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
             </Button>
           </div>

           <div className={cn("p-4", isCollapsed && "px-2 py-4 flex justify-center")}>
             {isCollapsed ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-full shadow-sm hover:shadow-md"
                          onClick={handleNewChat}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">New Thread</TooltipContent>
                </Tooltip>
             ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 rounded-full py-6 shadow-sm hover:shadow-md transition-all"
                  onClick={handleNewChat}
                >
                  <Plus className="h-4 w-4" />
                  <span>New Thread</span>
                </Button>
             )}
           </div>

           {!isCollapsed && (
             <div className="flex-1 overflow-hidden py-2 animate-in fade-in duration-300">
               <div className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                 Library
               </div>
               
               <ScrollArea className="h-full">
                  <div className="flex flex-col gap-1 px-2">
                      {chats.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-2 py-4">
                          No conversations yet
                        </p>
                      ) : (
                        chats.map((chat) => (
                          <Button
                            key={chat.id}
                            variant="ghost"
                            asChild
                            className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-sm font-normal h-9 group overflow-hidden max-w-full hover:bg-transparent hover:ring-1 hover:ring-zinc-700 hover:text-zinc-100 transition-all"
                          >
                            <Link href={`/chat/${chat.id}`}>
                              <MessageSquare className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate text-left">{chat.title}</span>
                              <Trash2 
                                className="h-3 w-3 text-muted-foreground hover:text-destructive transition-colors z-10 opacity-0 group-hover:opacity-100"
                                onClick={(e) => openDeleteDialog(chat.id, e)}
                              />
                            </Link>
                          </Button>
                        ))
                      )}
                  </div>
               </ScrollArea>
             </div>
           )}
           
           {isCollapsed && <div className="flex-1" />}

            <div className="mt-auto border-t p-4 flex flex-col gap-2" />
        </div>
        
        <AlertDialog open={!!chatToDelete} onOpenChange={(open: boolean) => !open && setChatToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
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
      </aside>
    </TooltipProvider>
  )
}

interface SidebarContentProps {
  chats: Chat[]
  onNewChat: () => void
  onDelete: (chatId: string, e: React.MouseEvent) => void
}

function SidebarContent({ chats, onNewChat, onDelete }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4 font-semibold text-lg">
        <Link href="/" className="flex items-center">
          <span className="text-primary mr-2">✦</span> FreeSearch
        </Link>
      </div>

      <div className="p-4">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 rounded-full py-6 shadow-sm hover:shadow-md transition-all"
          onClick={onNewChat}
        >
          <Plus className="h-4 w-4" />
          <span>New Thread</span>
        </Button>
      </div>

      <div className="flex-1 overflow-hidden py-2">
        <div className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Library
        </div>
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-1 px-2">
            {chats.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-4">
                No conversations yet
              </p>
            ) : (
              chats.map((chat) => (
                <Button
                  key={chat.id}
                  variant="ghost"
                  asChild
                  className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-sm font-normal h-9 group overflow-hidden max-w-full hover:bg-transparent hover:ring-1 hover:ring-zinc-700 hover:text-zinc-100 transition-all"
                >
                  <Link href={`/chat/${chat.id}`}>
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate text-left">{chat.title}</span>
                    <Trash2
                      className="h-3 w-3 text-muted-foreground hover:text-destructive transition-colors z-10 opacity-0 group-hover:opacity-100"
                      onClick={(e) => onDelete(chat.id, e)}
                    />
                  </Link>
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="mt-auto border-t p-4 flex flex-col gap-2" />
    </div>
  )
}
