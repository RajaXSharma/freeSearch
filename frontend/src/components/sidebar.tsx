"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Settings, Menu, MessageSquare, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PanelLeft, PanelLeftClose } from "lucide-react"

interface Chat {
  id: string
  title: string
  updatedAt: string
}

type SidebarProps = React.HTMLAttributes<HTMLDivElement>

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [chats, setChats] = React.useState<Chat[]>([])
  const router = useRouter()

  // Fetch chat history
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
    
    // Refetch on route changes
    const interval = setInterval(fetchChats, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleNewChat = () => {
    // Navigate to home page for a fresh chat experience
    // Chat will be created when user submits their first message
    router.push("/")
  }

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    try {
      const response = await fetch(`/api/chats/${chatId}`, { method: "DELETE" })
      if (response.ok) {
        setChats((prev) => prev.filter((c) => c.id !== chatId))
      }
    } catch (error) {
      console.error("Failed to delete chat:", error)
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile Sidebar */}
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
            onDelete={handleDeleteChat}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden h-full flex-col border-r bg-secondary/30 transition-[width] duration-300 md:flex", 
          isCollapsed ? "w-[60px]" : "w-[260px]",
          className
        )}
      >
        <div className="flex h-full flex-col">
           {/* Header & Toggle */}
           <div className={cn("flex h-14 items-center", isCollapsed ? "justify-center" : "justify-between px-4")}>
             {!isCollapsed && (
                <Link href="/" className="font-semibold text-lg flex items-center animate-in fade-in duration-300">
                    <span className="text-primary mr-2">✦</span> FreeSearch
                </Link>
             )}
             <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => setIsCollapsed(!isCollapsed)}
             >
                {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
             </Button>
           </div>

           {/* New Chat */}
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
                  <span className="ml-auto text-xs text-muted-foreground border px-1.5 py-0.5 rounded">Ctrl I</span>
                </Button>
             )}
           </div>

           {/* History / Library */}
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
                          <Link key={chat.id} href={`/chat/${chat.id}`}>
                            <Button
                              variant="ghost"
                              className="w-full justify-start gap-2 truncate text-sm font-normal h-9 group"
                            >
                              <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate flex-1 text-left">{chat.title}</span>
                              <Trash2 
                                className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                onClick={(e) => handleDeleteChat(chat.id, e)}
                              />
                            </Button>
                          </Link>
                        ))
                      )}
                  </div>
               </ScrollArea>
             </div>
           )}
           
           {isCollapsed && <div className="flex-1" />}

           {/* Footer */}
           <div className="mt-auto border-t p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                {isCollapsed ? (
                     <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="mx-auto">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Settings</TooltipContent>
                    </Tooltip>
                ) : (
                    <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                        <Settings className="h-4 w-4" />
                        Settings
                    </Button>
                )}
              </div>
              
              <div className={cn("flex items-center pt-2", isCollapsed ? "justify-center flex-col gap-4" : "justify-between")}>
                  {!isCollapsed && (
                     <div className="flex items-center gap-2 text-sm text-muted-foreground">
                         <div className="h-2 w-2 rounded-full bg-green-500"></div>
                         Online
                     </div>
                  )}
                  <ThemeToggle />
              </div>
           </div>
        </div>
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
      {/* Header */}
      <div className="flex h-14 items-center px-4 font-semibold text-lg">
        <Link href="/" className="flex items-center">
          <span className="text-primary mr-2">✦</span> FreeSearch
        </Link>
      </div>

      {/* New Chat */}
      <div className="p-4">
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 rounded-full py-6 shadow-sm hover:shadow-md transition-all"
          onClick={onNewChat}
        >
          <Plus className="h-4 w-4" />
          <span>New Thread</span>
          <span className="ml-auto text-xs text-muted-foreground border px-1.5 py-0.5 rounded">Ctrl I</span>
        </Button>
      </div>

      {/* History */}
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
                <Link key={chat.id} href={`/chat/${chat.id}`}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 truncate text-sm font-normal h-9 group"
                  >
                    <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1 text-left">{chat.title}</span>
                    <Trash2 
                      className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => onDelete(chat.id, e)}
                    />
                  </Button>
                </Link>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="mt-auto border-t p-4 flex flex-col gap-2">
         <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <Settings className="h-4 w-4" />
                Settings
            </Button>
         </div>
         <div className="flex items-center justify-between pt-2">
             <div className="flex items-center gap-2 text-sm text-muted-foreground">
                 <div className="h-2 w-2 rounded-full bg-green-500"></div>
                 Online
             </div>
             <ThemeToggle />
         </div>
      </div>
    </div>
  )
}
