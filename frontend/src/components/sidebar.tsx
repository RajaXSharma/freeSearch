"use client"

import * as React from "react"
import { Plus, History, Settings, Menu, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="fixed left-4 top-4 z-40 md:hidden">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[260px] p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className={cn("hidden w-[260px] flex-col border-r bg-secondary/30 md:flex", className)}>
        <SidebarContent />
      </aside>
    </>
  )
}

function SidebarContent() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 items-center px-4 font-semibold text-lg">
        <span className="text-primary mr-2">✦</span> FreeSearch
      </div>

      {/* New Chat */}
      <div className="p-4">
        <Button variant="outline" className="w-full justify-start gap-2 rounded-full py-6 shadow-sm hover:shadow-md transition-all">
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
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="flex flex-col gap-1 px-2">
            {[
              "How to use CSS Grid",
              "History of the Roman Empire",
              "Best Pasta Recipes 2024",
              "React vs Vue performance",
              "Quantum Physics for dummies",
              "Next.js 15 features",
            ].map((topic, i) => (
              <Button
                key={i}
                variant="ghost"
                className="justify-start gap-2 truncate text-sm font-normal h-9"
              >
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{topic}</span>
              </Button>
            ))}
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
