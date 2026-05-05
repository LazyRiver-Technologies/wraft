"use client"

import * as React from "react"
import { 
  MessageSquare, Zap, Clock, Activity, Target,
  Filter, Calendar
} from "lucide-react"
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, 
  Tooltip, ResponsiveContainer, BarChart, Bar 
} from "recharts"

import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  useOverviewQuery, useTrendsQuery, useSentimentQuery, 
  useTopicsQuery, useSourcesPerformanceQuery,
  AnalyticsFilter
} from "@/hooks/api/useAnalytics"
import { useToast } from "@/hooks/use-toast"
import { useProfileWithPlan } from "@/hooks/api/useBilling"
import { FeatureGate } from "@/components/ui/FeatureGate"
import { useUsage } from "@/hooks/api/useUsage"

export default function BotAnalyticsPage(props: { params: any }) {
  const params = React.use(props.params as Promise<{ botId: string }>)
  const [filter] = React.useState<AnalyticsFilter>({ botId: params.botId, channel: "all" })
  const { toast } = useToast()

  const { data: overviewResp } = useOverviewQuery(filter)
  const { data: trendsResp } = useTrendsQuery(filter)
  const { data: sentimentResp } = useSentimentQuery(filter)
  const { data: sourcesResp } = useSourcesPerformanceQuery(filter)

  const overview = overviewResp?.data || {}
  const trendData = trendsResp?.data || []
  const sentimentData = sentimentResp?.data || []
  const citationLeaderboard = sourcesResp?.data || []
  const { data: profile } = useProfileWithPlan()
  const { data: usage } = useUsage()
  
  const hasAdvancedAnalytics = profile?.plans?.advanced_analytics === true

  return (
    <>
      <PageHeader 
        title="Analytics" 
        description="Comprehensive analysis of bot performance and user engagement."
      >
        <Button variant="outline" className="text-xs" onClick={() => toast({ title: "Restricted", description: "Channel filtering is disabled in this environment." })}>
          <Filter className="mr-2 h-3.5 w-3.5" /> All Channels
        </Button>
        <Button variant="outline" className="text-xs" onClick={() => toast({ title: "Restricted", description: "Date filtering is currently locked to Last 30 Days." })}>
          <Calendar className="mr-2 h-3.5 w-3.5" /> Last 30 Days
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-6">
        <FeatureGate hasAccess={hasAdvancedAnalytics} requiredPlan="Starter">
        
        {/* ROW 1: STATS */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatCard title="Total Conversations" value={overview.total_conversations || 0} icon={MessageSquare} />
          <StatCard title="Total Messages" value={overview.total_messages || 0} icon={Activity} />
          <StatCard title="Avg Conv Length" value={overview.avg_messages_per_conversation?.toFixed(1) || "0.0"} icon={Target} />
          <StatCard title="Cache Hit Rate" value={`${(overview.cache_hit_rate * 100).toFixed(1) || 0}%`} icon={Zap} />
          <StatCard title="Avg Response Time" value={`${overview.avg_latency_ms?.toFixed(0) || 0}ms`} icon={Clock} />
        </div>

        {/* ROW 2: TREND CHART */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-5">
          <h3 className="mb-6 text-sm font-semibold text-text-primary">Conversation Volume</h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="count" stroke="var(--brand)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "var(--brand)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ROW 3: TWO COLUMNS */}
        <FeatureGate hasAccess={hasAdvancedAnalytics} requiredPlan="Growth">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border-default bg-bg-secondary p-5">
            <h3 className="mb-6 text-sm font-semibold text-text-primary">Sentiment Trend</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sentimentData}>
                  <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="positive" stackId="1" stroke="var(--success)" fill="var(--success)" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="negative" stackId="1" stroke="var(--danger)" fill="var(--danger)" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border-default bg-bg-secondary p-5 flex flex-col items-center justify-center text-center">
            <h3 className="mb-2 text-sm font-semibold text-text-primary w-full text-left">Drop-off Point</h3>
            <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary">
              <Activity className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-xs">Insufficient drop-off data.</p>
            </div>
          </div>
        </div>
        </FeatureGate>

        {/* ROW 4: DATA BLOCKS (TABLES) */}
        <FeatureGate hasAccess={hasAdvancedAnalytics} requiredPlan="Growth">
        <div className="grid gap-6 lg:grid-cols-1">
          {/* Source Citation */}
          <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
            <div className="p-5 border-b border-border-default">
              <h3 className="text-sm font-semibold text-text-primary">Source Citation Leaderboard</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80%]">Data Source</TableHead>
                  <TableHead className="text-right">Citations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {citationLeaderboard.map((c: {source: string, citations: number}, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-brand truncate max-w-[200px]">{c.source}</TableCell>
                    <TableCell className="text-right text-text-secondary">{c.citations}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        </FeatureGate>

        {/* ROW 5: RECENT SESSIONS */}
        <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden mb-8">
           <div className="p-5 border-b border-border-default flex justify-between items-center">
              <h3 className="text-sm font-semibold text-text-primary">Recent Conversations</h3>
              <Button variant="ghost" size="sm">View all</Button>
           </div>
           
           <div className="flex flex-col">
             {[1, 2, 3].map((s) => (
               <div key={s} className="flex items-center justify-between p-4 border-b border-border-default last:border-0 hover:bg-bg-tertiary cursor-pointer transition-colors">
                 <div className="flex flex-col gap-1.5">
                   <div className="flex items-center gap-2">
                     <span className="text-sm text-text-primary font-medium">Session_{s}48x9A</span>
                     <Badge variant="outline" className="text-[10px]">Web</Badge>
                     <Badge variant="success" className="text-[10px] w-2 h-2 rounded-full p-0 flex items-center justify-center"></Badge>
                   </div>
                   <p className="text-sm text-text-secondary line-clamp-1 max-w-[400px]">
                     "I need help setting up my billing account configuration."
                   </p>
                 </div>
                 <div className="flex flex-col items-end gap-1 shrink-0">
                   <span className="text-xs text-text-tertiary">{s * 15}m ago</span>
                   <span className="text-xs text-text-secondary">{s * 3} messages</span>
                 </div>
               </div>
             ))}
           </div>
        </div>
        </FeatureGate>

      </div>
    </>
  )
}
