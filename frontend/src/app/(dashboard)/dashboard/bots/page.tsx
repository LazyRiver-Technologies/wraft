"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Globe, Phone, ExternalLink } from "lucide-react"

import { useStore } from "@/lib/store"
import { useBots } from "@/hooks/api/useBots"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function BotsListPage() {
  const { data: botsData, isLoading } = useBots()
  const setCurrentBot = useStore((state) => state.setCurrentBot)
  const bots = botsData || []

  React.useEffect(() => {
    setCurrentBot(null)
  }, [setCurrentBot])

  if (isLoading) {
    return (
      <>
        <div className="h-10 w-48 bg-bg-tertiary rounded-md animate-pulse mb-8" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-[220px] bg-bg-secondary rounded-lg animate-pulse" />
          <div className="h-[220px] bg-bg-secondary rounded-lg animate-pulse" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader 
        title="Your Bots" 
        description="Manage your configured AI assistants and their integrations."
      >
        <Link href="/dashboard/bots/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create new bot
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Existing Bots */}
        {bots.map((bot) => {
          const stats = {
            convos: bot.conversations?.[0]?.count || 0,
            messages: bot.this_month?.message_count || 0,
            web: bot.this_month?.web_count || 0,
            whatsapp: bot.this_month?.whatsapp_count || 0,
            leads: bot.leads?.[0]?.count || 0,
          }
          
          const hasWhatsApp = Array.isArray(bot.whatsapp_configs) && bot.whatsapp_configs.length > 0;

          return (
            <div key={bot.id} className="flex min-h-[220px] flex-col rounded-lg border border-border-default bg-bg-secondary p-5 transition-colors hover:border-border-hover">
              
              {/* Top Row: Name + Badge */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-lg font-medium text-text-primary">{bot.name}</h3>
                    <Badge variant={bot.is_active !== false ? "success" : "default"}>
                      {bot.is_active !== false ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {/* Second Row: Slug */}
                  <p className="mt-1 font-mono text-xs text-text-tertiary">{bot.slug}</p>
                </div>
              </div>

              {/* Stats Row */}
              <div className="mt-6 flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-text-primary">{String(stats.convos)}</span>
                  <span className="text-xs text-text-tertiary uppercase tracking-wider mt-0.5">Conversations</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-text-primary">{String(stats.messages)}</span>
                  <span className="text-xs text-text-tertiary uppercase tracking-wider mt-0.5">Messages</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-text-primary">{String(stats.leads)}</span>
                  <span className="text-xs text-text-tertiary uppercase tracking-wider mt-0.5">Leads</span>
                </div>
              </div>

              <div className="mt-auto pt-6 flex items-center justify-between">
                {/* Channels */}
                <div className="flex gap-2">
                  <Badge variant="outline" className="flex items-center gap-1.5 px-2.5 py-1">
                    <Globe className="h-3 w-3" /> 
                    Web
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1.5 px-2.5 py-1">
                    <Phone className="h-3 w-3" />
                    WhatsApp
                    {hasWhatsApp && (
                      <span className="ml-1 h-1.5 w-1.5 rounded-full bg-success"></span>
                    )}
                  </Badge>
                </div>
                
                <Link href={`/dashboard/bots/${bot.id}`}>
                  <Button variant="secondary" size="sm" className="h-8">
                    Open <ExternalLink className="ml-2 h-3 w-3" />
                  </Button>
                </Link>
              </div>

            </div>
          )
        })}
      </div>
    </>
  )
}
