"use client"

import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bot as BotIcon, MessageSquare, BatteryCharging, Zap } from 'lucide-react'
import { Bot } from '@/lib/store'
import Link from 'next/link'

export default function DashboardOverviewPage() {
  const { data: bots } = useQuery({
    queryKey: ['bots'],
    queryFn: () => fetchApi('/api/v1/bots')
  })

  const firstBotId = bots?.[0]?.id

  const { data: analytics } = useQuery({
    queryKey: ['analytics-overview', firstBotId],
    queryFn: () => fetchApi(`/api/v1/analytics/${firstBotId}/overview`),
    enabled: !!firstBotId
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Bots</CardTitle>
            <BotIcon className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bots?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Messages This Month</CardTitle>
            <MessageSquare className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.total_messages || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Messages Remaining</CardTitle>
            <BatteryCharging className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.messages_remaining_this_month || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((analytics?.cache_hit_rate || 0) * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Bots</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {bots?.slice(0, 3).map((bot: Bot) => (
            <Link key={bot.id} href={`/dashboard/bots/${bot.id}`}>
              <Card className="hover:border-indigo-500 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-base">{bot.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <div className={`h-2 w-2 rounded-full ${bot.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    {bot.is_active ? 'Active' : 'Inactive'}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
