"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
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
import { User as UserIcon, LogOut } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export function DashboardHeader() {
  const pathname = usePathname()
  const user = useStore((state) => state.user)
  const currentBot = useStore((state) => state.currentBot)
  const setUser = useStore((state) => state.setUser)
  const router = useRouter()

  // Generate dynamic breadcrumbs safely
  const buildBreadcrumbs = () => {
    // If on bots root or dashboard root
    if (pathname === "/dashboard") {
      return [{ name: "Overview", href: "/dashboard", active: true }]
    }
    if (pathname === "/dashboard/bots") {
      return [{ name: "My Bots", href: "/dashboard/bots", active: true }]
    }

    // Dynamic routing checks for active bots
    const nodes = []
    if (pathname.includes("/dashboard/bots/")) {
      nodes.push({ name: "My Bots", href: "/dashboard/bots", active: false })
      
      if (currentBot) {
        // e.g., /dashboard/bots/[id]/settings
        const specificRouteMatch = pathname.split(`/${currentBot.id}/`)[1]
        nodes.push({ 
          name: currentBot.name, 
          href: `/dashboard/bots/${currentBot.id}`, 
          active: !specificRouteMatch 
        })
        
        if (specificRouteMatch) {
          // Capitalize first letter
          const formatted = specificRouteMatch.charAt(0).toUpperCase() + specificRouteMatch.slice(1)
          nodes.push({
            name: formatted,
            href: pathname,
            active: true
          })
        }
      }
    }
    
    // Fallback if logic misses
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

  return (
    <header className="flex h-14 shrink-0 items-center justify-between rounded-full border border-white/10 bg-zinc-900/60 backdrop-blur-2xl px-4 shadow-2xl transition-all ease-linear relative z-50">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((node, index) => (
              <React.Fragment key={node.href}>
                <BreadcrumbItem className="hidden md:block">
                  {!node.active ? (
                    <BreadcrumbLink href={node.href}>
                      {node.name}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{node.name}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="hidden md:block" />
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-4 px-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="focus-visible:ring-0 focus-visible:outline-none">
            <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-transparent transition-all hover:ring-indigo-100 relative group overflow-visible">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold text-sm">
                {user?.email?.charAt(0).toUpperCase() || <UserIcon className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Logged in as</p>
                <p className="text-xs leading-none text-muted-foreground truncate">
                  {user?.email || "Unknown user"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
