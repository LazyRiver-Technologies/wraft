"use client"

import { useStore } from "@/lib/store"
import { Bell } from "lucide-react"

export function Topbar() {
  const user = useStore((state) => state.user)

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-slate-800 md:hidden">LazyRiver AI</h2>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
          <Bell className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium text-sm">
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
        </div>
      </div>
    </header>
  )
}
