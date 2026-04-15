"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  Bot, Home, LogOut, Settings, BarChart2, Inbox, 
  Link as LinkIcon, Database, MessageSquare, Briefcase, Zap
} from "lucide-react"

import { useStore } from "@/lib/store"
import { supabase } from "@/lib/supabase"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  
  const currentBot = useStore((state) => state.currentBot)
  const setUser = useStore((state) => state.setUser)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    document.cookie = "sb-access-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    setUser(null, null)
    router.push("/login")
  }

  const baseLinks = [
    { name: "Overview", href: "/dashboard", icon: Home },
    { name: "My Bots", href: "/dashboard/bots", icon: Bot },
  ]

  const botLinks = currentBot ? [
    { name: "Overview", href: `/dashboard/bots/${currentBot.id}`, icon: BarChart2 },
    { name: "Settings", href: `/dashboard/bots/${currentBot.id}/settings`, icon: Settings },
    { name: "Appearance", href: `/dashboard/bots/${currentBot.id}/appearance`, icon: Inbox },
    { name: "Sources", href: `/dashboard/bots/${currentBot.id}/sources`, icon: Database },
    { name: "WhatsApp", href: `/dashboard/bots/${currentBot.id}/whatsapp`, icon: LinkIcon },
    { name: "Playground", href: `/dashboard/bots/${currentBot.id}/chat`, icon: MessageSquare },
    { name: "Analytics", href: `/dashboard/bots/${currentBot.id}/analytics`, icon: BarChart2 },
  ] : []

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-3 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md">
            <Zap className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">LazyRiver AI</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Main Workspace Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {baseLinks.map((link) => (
                <SidebarMenuItem key={link.name}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === link.href}
                    tooltip={link.name}
                  >
                    <Link href={link.href}>
                      <link.icon className="h-4 w-4" />
                      <span>{link.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2 opacity-50" />

        {/* Dynamic Bot Context Navigation */}
        {currentBot && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">
              <Briefcase className="h-3 w-3" />
              {currentBot.name}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {botLinks.map((link) => (
                  <SidebarMenuItem key={link.name}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={pathname === link.href}
                      tooltip={link.name}
                    >
                      <Link href={link.href}>
                        <link.icon className="h-4 w-4" />
                        <span>{link.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout} 
              className="text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
