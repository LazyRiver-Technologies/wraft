"use client"

import * as React from "react"
import Link from "next/link"
import { 
  MessageSquare, Bot, Users, Database, Zap, 
  Share, Lightbulb, Play
} from "lucide-react"
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar 
} from "recharts"

import { useStore } from "@/lib/store"
import { useBots } from "@/hooks/api/useBots"
import { useGlobalOverviewQuery, useGlobalTrendsQuery } from "@/hooks/api/useAnalytics"
import { useAllLeads } from "@/hooks/api/useLeads"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import { useProfileWithPlan } from "@/hooks/api/useBilling"

export default function DashboardOverviewPage() {
  const user = useStore((state) => state.user)
  const { data: profile, isLoading: profileLoading } = useProfileWithPlan()
  const setCurrentBot = useStore((state) => state.setCurrentBot)
  const { data: botsData, isLoading: botsLoading } = useBots()
  const { data: overview, isLoading: overviewLoading } = useGlobalOverviewQuery()
  const { data: trends, isLoading: trendsLoading } = useGlobalTrendsQuery()
  const { data: leadsData, isLoading: leadsLoading } = useAllLeads(1)
  
  const bots = botsData || []
  const lineData = trends?.data || []
  const recentLeads = leadsData?.slice(0, 5) || []

  React.useEffect(() => {
    setCurrentBot(null)
  }, [setCurrentBot])

  const isLoading = botsLoading || overviewLoading || trendsLoading || leadsLoading || profileLoading

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse mt-8">
        <div className="h-10 w-48 bg-bg-tertiary rounded-md" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="h-32 bg-bg-secondary rounded-lg" />
          <div className="h-32 bg-bg-secondary rounded-lg" />
          <div className="h-32 bg-bg-secondary rounded-lg" />
          <div className="h-32 bg-bg-secondary rounded-lg" />
        </div>
      </div>
    )
  }

  // Empty state logic
  if (bots.length === 0) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <EmptyState
          icon={() => (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="6" fill="url(#paint0_linear_empty)"/>
              <path d="M6 8L8.5 16L12 10.5L15.5 16L18 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="paint0_linear_empty" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--brand)"/>
                  <stop offset="1" stopColor="var(--brand-hover)"/>
                </linearGradient>
              </defs>
            </svg>
          )}
          title={`Welcome back, ${profile?.full_name || user?.email?.split('@')[0] || 'Builder'}`}
          description="Create your first AI assistant in minutes."
          action={
            <Link href="/dashboard/bots">
              <Button>Create your bot</Button>
            </Link>
          }
          className="border-none bg-transparent"
        />
      </div>
    )
  }

  const messageLimit = overview?.max_messages_per_month || 5000
  const messagesUsed = overview?.total_messages || 0
  const usagePercent = Math.min(100, Math.round((messagesUsed / messageLimit) * 100))

  return (
    <>
      <PageHeader 
        title={`Welcome back, ${profile?.full_name || user?.email?.split('@')[0] || 'Builder'}`} 
        description={
          profile?.business_name 
            ? profile.business_name
            : "Monitor your AI assistant performance across all channels."
        }
      />

      <div className="flex flex-col gap-6">
        {/* ROW 1: STATS */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Total Conversations" 
            value={overview?.total_conversations?.toLocaleString() || "0"} 
            icon={MessageSquare} 
          />
          <div className="rounded-lg border border-border-default bg-bg-secondary p-5">
            <h3 className="text-xs font-medium tracking-wider text-text-secondary uppercase">Messages Used</h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-text-primary">{messagesUsed.toLocaleString()}</span>
              <span className="text-sm text-text-tertiary">/ {messageLimit.toLocaleString()} limit</span>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
              <div className="h-full bg-brand" style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
          <StatCard 
            title="Active Bots" 
            value={bots.length.toString()} 
            icon={Bot} 
          />
          <StatCard 
            title="Leads Captured" 
            value={overview?.total_leads?.toString() || "0"} 
            icon={Users} 
          />
        </div>

        {/* ROW 2: CHARTS & LEADS */}
        <div className="grid gap-6 lg:grid-cols-[60%_40%]">
          <div className="rounded-lg border border-border-default bg-bg-secondary p-5 flex flex-col">
            <h3 className="mb-6 text-sm font-semibold text-text-primary">Conversations over time</h3>
            <div className="h-[280px] w-full flex-1">
              {lineData.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
                  No conversation data available for the selected period.
                </div>
              )}
              
              {lineData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <XAxis 
                      dataKey="date" 
                      stroke="var(--text-tertiary)" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => value.split('-').slice(1).join('/')}
                    />
                    <YAxis 
                      stroke="var(--text-tertiary)" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="var(--brand)" 
                      strokeWidth={3} 
                      dot={false} 
                      activeDot={{ r: 6, fill: "var(--brand)" }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border-default bg-bg-secondary p-5 flex flex-col">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">Recent Leads</h3>
            <div className="flex-1 flex flex-col gap-4">
              {recentLeads.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center gap-2">
                  <Users className="h-8 w-8 text-bg-tertiary" />
                  <p className="text-xs text-text-tertiary">No leads captured yet.</p>
                </div>
              )}
              
              {recentLeads.length > 0 && recentLeads.map((lead: any) => (
                  <div key={lead.id} className="flex items-center gap-3 border-b border-border-default pb-3 last:border-0 last:pb-0">
                    <Avatar className="h-9 w-9 border-none bg-bg-tertiary">
                      <AvatarFallback className="text-xs text-text-secondary">
                        {lead.name?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium text-text-primary truncate">{lead.name || "Anonymous User"}</p>
                      <p className="text-xs text-text-tertiary truncate">{lead.phone || lead.email || "No contact info"}</p>
                    </div>
                    <span className="text-xs text-text-tertiary shrink-0">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </span>
                  </div>
              ))}
            </div>
            {bots.length > 0 && (
              <Link href={`/dashboard/bots/${bots[0].id}/leads`} className="mt-4 block text-center text-sm font-medium text-brand hover:text-brand-hover">
                View all leads
              </Link>
            )}
          </div>
        </div>

        {/* ROW 3: TOPICS & ACTIONS */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border-default bg-bg-secondary p-5">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">Quick actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href={bots.length > 0 ? `/dashboard/bots/${bots[0].id}/sources` : "/dashboard/bots"}>
                <Button variant="secondary" className="w-full justify-start h-12 px-4 shadow-sm">
                  <Database className="mr-3 h-5 w-5 text-brand" />
                  Add data source
                </Button>
              </Link>
              <Link href={bots.length > 0 ? `/dashboard/bots/${bots[0].id}` : "/dashboard/bots"}>
                <Button variant="secondary" className="w-full justify-start h-12 px-4 shadow-sm">
                  <Play className="mr-3 h-5 w-5 text-success" />
                  Test your bot
                </Button>
              </Link>
              <Link href={bots.length > 0 ? `/dashboard/bots/${bots[0].id}/settings` : "/dashboard/bots"}>
                <Button variant="secondary" className="w-full justify-start h-12 px-4 shadow-sm">
                  <Share className="mr-3 h-5 w-5 text-text-secondary" />
                  Bot settings
                </Button>
              </Link>
              <Link href={bots.length > 0 ? `/dashboard/bots/${bots[0].id}/suggestions` : "/dashboard/bots"}>
                <Button variant="secondary" className="w-full justify-start h-12 px-4 shadow-sm relative">
                  <Lightbulb className="mr-3 h-5 w-5 text-warning" />
                  View suggestions
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="rounded-lg border border-border-default bg-bg-secondary p-5 flex items-center justify-center">
             <div className="text-center">
                <p className="text-sm text-text-secondary mb-4">Want to increase your limits?</p>
                <Link href="/dashboard/billing">
                   <Button variant="outline">Upgrade Plan</Button>
                </Link>
             </div>
          </div>
        </div>
      </div>
    </>
  )
}
