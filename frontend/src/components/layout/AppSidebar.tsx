"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, Bot, Plus, Play, Activity, Users, 
  Database, MessageSquare, Lightbulb, Zap, 
  Phone, Settings, HelpCircle, Palette, CreditCard
} from "lucide-react"

import { useStore } from "@/lib/store"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { cn } from "@/lib/utils"

export function AppSidebar({ mobileOpen, setMobileOpen }: { mobileOpen?: boolean, setMobileOpen?: (b: boolean) => void }) {
  const pathname = usePathname()
  
  const currentBot = useStore((state) => state.currentBot)

  const { data: uncontactedCount } = useQuery({
    queryKey: ['uncontacted_leads', currentBot?.id],
    queryFn: async () => {
      if (!currentBot) return 0
      const supabase = createClient()
      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('bot_id', currentBot.id)
        .eq('is_contacted', false)
      return count || 0
    },
    enabled: !!currentBot?.id,
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  })

  const { data: suggestionsCount } = useQuery({
    queryKey: ['suggestions_count', currentBot?.id],
    queryFn: async () => {
      if (!currentBot) return 0
      const supabase = createClient()
      const { count } = await supabase
        .from('suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('bot_id', currentBot.id)
        .eq('status', 'pending')
      return count || 0
    },
    enabled: !!currentBot?.id,
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  })

  const NavItem = ({ href, icon: Icon, children, badge, active }: { href: string, icon: React.ElementType, children: React.ReactNode, badge?: number, active?: boolean }) => {
    const isActive = active !== undefined ? active : pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"))
    
    return (
      <Link href={href} onClick={() => setMobileOpen?.(false)}>
        <div className={cn(
          "flex items-center justify-between px-3 py-2 mx-2 rounded-md transition-all duration-100 cursor-pointer text-sm",
          isActive 
            ? "text-text-primary bg-brand-muted border-l-2 border-brand font-medium" 
            : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
        )}>
          <div className="flex items-center gap-2.5">
            <Icon className="h-4 w-4" />
            {children}
          </div>
          {badge !== undefined && badge > 0 && (
            <span className="bg-brand text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-bold">
              {badge}
            </span>
          )}
        </div>
      </Link>
    )
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-bg-secondary w-[220px] border-r border-border-default overflow-y-auto">
      {/* Top Section - Logo */}
      <div className="h-14 flex items-center px-4 shrink-0 mt-4 mb-2">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileOpen?.(false)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="url(#paint0_linear)"/>
            <path d="M6 8L8.5 16L12 10.5L15.5 16L18 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="paint0_linear" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C5CFC"/>
                <stop offset="1" stopColor="#9F7FFD"/>
              </linearGradient>
            </defs>
          </svg>
          <span className="font-semibold text-base font-sans text-text-primary tracking-tight">Wraft</span>
        </Link>
      </div>

      {/* Nav Sections */}
      <div className="flex-1 flex flex-col gap-1 py-2 pb-10">
        <div className="mb-2">
          <NavItem href="/dashboard" active={pathname === "/dashboard"} icon={LayoutDashboard}>Overview</NavItem>
          <NavItem href="/dashboard/bots" active={pathname === "/dashboard/bots" || pathname === "/dashboard/bots/new"} icon={Bot}>My Bots</NavItem>
          <NavItem href="/dashboard/billing" active={pathname === "/dashboard/billing"} icon={CreditCard}>Billing & Plans</NavItem>
        </div>

        {currentBot && (
          <div className="mt-8 border-t border-border-default pt-4">
            <div className="px-3 mb-2 flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-brand"></div>
              <span className="text-[10px] text-text-primary uppercase tracking-widest font-bold truncate max-w-[160px]">{currentBot.name}</span>
            </div>
            <NavItem href={`/dashboard/bots/${currentBot.id}`} icon={Play} active={pathname === `/dashboard/bots/${currentBot.id}`}>Playground</NavItem>
            <NavItem href={`/dashboard/bots/${currentBot.id}/analytics`} icon={Activity}>Analytics</NavItem>
            <NavItem href={`/dashboard/bots/${currentBot.id}/leads`} icon={Users} badge={uncontactedCount}>Leads</NavItem>
            <NavItem href={`/dashboard/bots/${currentBot.id}/sources`} icon={Database}>Data Sources</NavItem>
            <NavItem href={`/dashboard/bots/${currentBot.id}/qa`} icon={MessageSquare}>Q&amp;A Pairs</NavItem>
            <NavItem href={`/dashboard/bots/${currentBot.id}/suggestions`} icon={Lightbulb} badge={suggestionsCount}>Suggestions</NavItem>
            <NavItem href={`/dashboard/bots/${currentBot.id}/appearance`} icon={Palette}>Appearance</NavItem>
            <NavItem href={`/dashboard/bots/${currentBot.id}/actions`} icon={Zap}>Actions</NavItem>
            <NavItem href={`/dashboard/bots/${currentBot.id}/whatsapp`} icon={Phone}>
              WhatsApp
              {Array.isArray(currentBot.whatsapp_configs) && currentBot.whatsapp_configs.length > 0 && (
                <span className="ml-auto w-1.5 h-1.5 bg-success rounded-full"></span>
              )}
            </NavItem>
            <NavItem href={`/dashboard/bots/${currentBot.id}/settings`} icon={Settings}>Settings</NavItem>
          </div>
        )}
      </div>

      {/* Footer Pinned Section */}
      <div className="p-3 mt-auto border-t border-border-default">
        <Link href="/dashboard/help" onClick={() => setMobileOpen?.(false)}>
          <div className="flex items-center gap-2.5 px-3 py-2 mx-0 rounded-md text-sm text-text-secondary cursor-pointer transition-all duration-100 hover:text-text-primary hover:bg-bg-tertiary">
            <HelpCircle className="h-4 w-4" />
            Help
          </div>
        </Link>
        <Link href="/dashboard/settings" onClick={() => setMobileOpen?.(false)}>
          <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-md text-sm text-text-secondary cursor-pointer transition-all duration-100 hover:text-text-primary hover:bg-bg-tertiary">
            <div className="bg-brand w-5 h-5 rounded-full flex justify-center items-center text-[10px] text-white font-bold">U</div>
            User Account
          </div>
        </Link>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden md:block fixed left-0 top-0 h-screen z-40 bg-bg-secondary w-[220px]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div 
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen?.(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside className={cn(
        "md:hidden fixed top-0 bottom-0 z-50 w-[220px] transform transition-transform duration-200 ease-in-out bg-bg-secondary",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarContent}
      </aside>
    </>
  )
}
