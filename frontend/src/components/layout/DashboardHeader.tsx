"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Menu, LogOut, Bell, User as UserIcon, Settings } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useStore } from "@/lib/store"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useUsage } from "@/hooks/api/useUsage"

const ROUTE_NAMES: Record<string, string> = {
  chat: "Playground",
  analytics: "Analytics",
  leads: "Leads",
  sources: "Data Sources",
  qa: "Q&A Pairs",
  suggestions: "Suggestions",
  appearance: "Appearance",
  actions: "Actions",
  whatsapp: "WhatsApp Integration",
  settings: "Settings"
}

export function DashboardHeader({ setMobileOpen }: { setMobileOpen?: (b: boolean) => void }) {
  const pathname = usePathname()
  const user = useStore((state) => state.user)
  const currentBot = useStore((state) => state.currentBot)
  const setUser = useStore((state) => state.setUser)
  const router = useRouter()
  const { data: usage, isLoading } = useUsage()

  const buildBreadcrumbs = () => {
    if (pathname === "/dashboard") {
      return [{ name: "Overview", href: "/dashboard", active: true }]
    }
    if (pathname === "/dashboard/bots") {
      return [{ name: "My Bots", href: "/dashboard/bots", active: true }]
    }

    const nodes = []
    if (pathname.includes("/dashboard/bots/")) {
      nodes.push({ name: "My Bots", href: "/dashboard/bots", active: false })
      
      if (currentBot) {
        // Find if we are in a sub-route of the bot
        const parts = pathname.split(`/${currentBot.id}`)
        const specificRouteMatch = parts[1]?.replace(/^\//, '')
        
        nodes.push({ 
          name: currentBot.name, 
          href: `/dashboard/bots/${currentBot.id}`, 
          active: !specificRouteMatch 
        })
        
        if (specificRouteMatch) {
          const routeKey = specificRouteMatch.split('/')[0]
          const formatted = ROUTE_NAMES[routeKey] || (routeKey.charAt(0).toUpperCase() + routeKey.slice(1))
          nodes.push({
            name: formatted,
            href: pathname,
            active: true
          })
        }
      }
    }
    
    if (nodes.length === 0) {
       nodes.push({ name: "Dashboard", href: "/dashboard", active: true })
    }
    return nodes
  }

  const breadcrumbs = buildBreadcrumbs()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    document.cookie = "sb-access-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    setUser(null, null)
    router.push("/login")
  }

  const planName = usage?.plan_name || "trial"
  const maxMessages = usage?.messages_limit || 50
  const usedMessages = usage?.messages_used || 0
  const isTrial = planName === "trial"
  const trialDaysRemaining = usage?.trial_days_remaining || 0
  
  const usagePercentage = Math.min(100, Math.max(0, (usedMessages / maxMessages) * 100)) || 0

  const getUsageColorClass = () => {
    if (usagePercentage < 50) return "text-text-secondary"
    if (usagePercentage < 100) return "text-warning"
    return "text-danger"
  }
  const getProgressColorClass = () => {
    if (usagePercentage < 50) return "bg-brand"
    if (usagePercentage < 100) return "bg-warning"
    return "bg-danger"
  }

  return (
    <header className="flex h-14 shrink-0 w-full items-center justify-between border-b border-border-default bg-bg-primary px-4 md:px-8 transition-all ease-linear relative z-30">
      
      {/* LEFT: Mobile Menu + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setMobileOpen?.(true)}
          className="md:hidden flex items-center justify-center text-text-secondary hover:text-text-primary h-8 w-8 rounded-md bg-bg-tertiary border border-border-default"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="hidden sm:flex items-center text-sm">
          {breadcrumbs.map((node, index) => (
            <React.Fragment key={node.href}>
              {index > 0 && (
                <span className="mx-2 text-text-tertiary">/</span>
              )}
              {node.active ? (
                <span className="text-text-primary font-medium">{node.name}</span>
              ) : (
                <Link href={node.href} className="text-text-secondary hover:text-text-primary transition-colors">
                  {node.name}
                </Link>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* RIGHT: Actions & Profile */}
      <div className="flex items-center gap-4">
        
        {/* Plan / Usage (Desktop Only) */}
        <div className="hidden lg:flex items-center gap-4 mr-2">
          {/* Trial Badge */}
          {isTrial && (
            <div className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
              trialDaysRemaining > 7 ? "bg-success/10 text-success" :
              trialDaysRemaining > 3 ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
            }`}>
              Trial: {trialDaysRemaining} days left
            </div>
          )}

          {/* Usage Progress Bar (Always visible) */}
          <div className="flex flex-col items-end gap-1 min-w-[120px]">
            <div className={`text-[10px] font-medium flex items-center gap-1.5 ${getUsageColorClass()}`}>
              {usagePercentage >= 80 && usagePercentage < 100 && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning"></span>
                </span>
              )}
              {usagePercentage >= 100 ? "Limit reached" : `${usedMessages.toLocaleString()} / ${maxMessages.toLocaleString()} msg`}
            </div>
            <div className="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden">
              <div className={`h-full transition-all ${getProgressColorClass()}`} style={{ width: `${usagePercentage}%` }} />
            </div>
            {usage?.overage_messages ? (
              <div className="text-danger text-[10px] mt-0.5 whitespace-nowrap">
                +{usage.overage_messages.toLocaleString()} extra &middot; &#8377;{usage.overage_cost_inr?.toFixed(2) || "0.00"}
              </div>
            ) : null}
          </div>
          
          <Link href="/dashboard/billing">
            {(usagePercentage >= 100 || isTrial) ? (
              <Button size="sm" className="h-7 text-xs px-3 bg-brand hover:bg-brand-hover text-white shadow-sm border border-brand/20">Upgrade</Button>
            ) : (
              <Badge variant="outline" className="capitalize cursor-pointer hover:bg-bg-tertiary transition-colors border-border-default">
                {planName}
              </Badge>
            )}
          </Link>
        </div>

        {/* Notification Bell */}
        <button className="relative text-text-secondary hover:text-text-primary transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-brand"></span>
        </button>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="focus-visible:outline-none">
            <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-transparent transition-all border border-border-default hover:border-border-hover relative overflow-visible">
              <AvatarFallback className="bg-bg-tertiary text-text-primary font-semibold text-sm">
                {user?.email?.charAt(0).toUpperCase() || <UserIcon className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2">
            <DropdownMenuLabel className="font-normal border-b border-border-default pb-2">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-text-primary">Acccount</p>
                <p className="text-xs leading-none text-text-secondary truncate mt-1">
                  {user?.email || "Unknown user"}
                </p>
              </div>
            </DropdownMenuLabel>
            
            <Link href="/dashboard/settings">
              <DropdownMenuItem className="cursor-pointer focus:bg-bg-tertiary focus:text-text-primary mt-1">
                <Settings className="mr-2 h-4 w-4 text-text-secondary" />
                <span>Settings</span>
              </DropdownMenuItem>
            </Link>

            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-danger focus:bg-danger/10 focus:text-danger mt-1">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  )
}
