"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bot, Home, LogOut, Settings, BarChart2, Inbox, Link as LinkIcon, Database, MessageSquare } from "lucide-react"
import { useStore } from "@/lib/store"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export function Sidebar() {
  const pathname = usePathname()
  const currentBot = useStore((state) => state.currentBot)
  const setUser = useStore((state) => state.setUser)
  const router = useRouter()

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
    { name: "Bot Overview", href: `/dashboard/bots/${currentBot.id}`, icon: BarChart2 },
    { name: "Settings", href: `/dashboard/bots/${currentBot.id}/settings`, icon: Settings },
    { name: "Appearance", href: `/dashboard/bots/${currentBot.id}/appearance`, icon: Inbox },
    { name: "Sources", href: `/dashboard/bots/${currentBot.id}/sources`, icon: Database },
    { name: "WhatsApp", href: `/dashboard/bots/${currentBot.id}/whatsapp`, icon: LinkIcon },
    { name: "Playground", href: `/dashboard/bots/${currentBot.id}/chat`, icon: MessageSquare },
    { name: "Analytics", href: `/dashboard/bots/${currentBot.id}/analytics`, icon: BarChart2 },
  ] : []

  return (
    <aside className="fixed max-md:bottom-0 max-md:w-full md:left-0 md:top-0 md:h-screen md:w-64 border-r max-md:border-t border-slate-200 bg-slate-50 flex flex-col z-50">
      <div className="p-4 hidden md:block">
        <h1 className="text-xl font-bold text-indigo-600">LazyRiver AI</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto px-3 py-4 max-md:flex max-md:flex-row max-md:justify-around max-md:py-2">
        <div className="space-y-1 max-md:flex max-md:space-y-0 max-md:gap-2">
          {baseLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link key={link.name} href={link.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${isActive ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-slate-600 hover:bg-slate-100'}`}>
                <link.icon className="h-4 w-4" />
                <span className="max-md:hidden">{link.name}</span>
              </Link>
            )
          })}
        </div>

        {currentBot && (
          <div className="mt-8 max-md:hidden">
            <h4 className="mb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {currentBot.name}
            </h4>
            <div className="space-y-1">
              {botLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link key={link.name} href={link.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${isActive ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-slate-600 hover:bg-slate-100'}`}>
                    <link.icon className="h-4 w-4" />
                    <span>{link.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 max-md:hidden">
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition-all hover:bg-slate-100">
          <LogOut className="h-4 w-4" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  )
}
