"use client"

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MessageSquare, BarChart2, Zap } from 'lucide-react'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function AnalyticsPage() {
  const { botId } = useParams()
  const [dateRange, setDateRange] = useState('30')
  const [channel, setChannel] = useState('all')

  const { data: bot } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => fetchApi(`/api/v1/bots/${botId}`)
  })

  // Start/End date bounds strictly mapping the UI filters natively
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - parseInt(dateRange))
  const qs = `?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}&channel=${channel}`

  const { data: overview, isLoading: oLoading } = useQuery({ queryKey: ['overview', botId, qs], queryFn: () => fetchApi(`/api/v1/analytics/${botId}/overview${qs}`) })
  const { data: convOverTime, isLoading: cLoading } = useQuery({ queryKey: ['conv_over_time', botId, qs], queryFn: () => fetchApi(`/api/v1/analytics/${botId}/conversations-over-time${qs}`) })
  const { data: dropoff, isLoading: dLoading } = useQuery({ queryKey: ['dropoff', botId, qs], queryFn: () => fetchApi(`/api/v1/analytics/${botId}/drop-off${qs}`) })
  const { data: sentiment, isLoading: sLoading } = useQuery({ queryKey: ['sentiment', botId, qs], queryFn: () => fetchApi(`/api/v1/analytics/${botId}/sentiment${qs}`) })
  const { data: topQs, isLoading: tLoading } = useQuery({ queryKey: ['topqs', botId, qs], queryFn: () => fetchApi(`/api/v1/analytics/${botId}/top-questions${qs}`) })
  const { data: sourcesPerf, isLoading: spLoading } = useQuery({ queryKey: ['sourcesperf', botId, qs], queryFn: () => fetchApi(`/api/v1/analytics/${botId}/sources-performance${qs}`) })

  const themeColor = bot?.bot_appearance?.theme_color || '#4f46e5'

  const dropoffData = dropoff ? [
    { name: '1 Message', count: dropoff.drop_off_at_message_1 },
    { name: '2 Messages', count: dropoff.drop_off_at_message_2 },
    { name: '3 Messages', count: dropoff.drop_off_at_message_3 },
    { name: '4+ Messages', count: dropoff.drop_off_at_message_4_plus },
  ] : []

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h1>
          <p className="text-slate-500">Track AI interactions, user drop-offs, and vector accuracies natively.</p>
        </div>
        
        <div className="flex gap-4">
           <Select value={channel} onValueChange={setChannel}>
             <SelectTrigger className="w-32 bg-white"><SelectValue /></SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Channels</SelectItem>
               <SelectItem value="web">Web Chat</SelectItem>
               <SelectItem value="whatsapp">WhatsApp</SelectItem>
             </SelectContent>
           </Select>

           <Select value={dateRange} onValueChange={setDateRange}>
             <SelectTrigger className="w-36 bg-white"><SelectValue /></SelectTrigger>
             <SelectContent>
               <SelectItem value="7">Last 7 Days</SelectItem>
               <SelectItem value="30">Last 30 Days</SelectItem>
               <SelectItem value="90">Last 90 Days</SelectItem>
             </SelectContent>
           </Select>
        </div>
      </div>

      {oLoading ? <p>Loading metrics...</p> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
              <MessageSquare className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview?.total_conversations || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview?.total_messages || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Convo Length</CardTitle>
              <BarChart2 className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview?.avg_messages_per_conversation?.toFixed(1) || '0.0'} msgs</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
              <Zap className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{((overview?.cache_hit_rate || 0) * 100).toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Row 2: Conv Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Conversations Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {cLoading ? <p>Loading chart...</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={convOverTime?.data || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke={themeColor} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Row 3: Drop off & Sentiment */}
      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Engagement Depth (Drop-off)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              {dLoading ? <p>Loading...</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dropoffData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill={themeColor} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sentiment Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
               {sLoading ? <p>Loading...</p> : (
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={sentiment?.data || []}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                     <XAxis dataKey="date" hide />
                     <YAxis tickLine={false} axisLine={false} domain={[-1, 1]} />
                     <Tooltip />
                     <Area type="monotone" dataKey="avg_sentiment" fill={themeColor} fillOpacity={0.2} stroke={themeColor} strokeWidth={2} />
                   </AreaChart>
                 </ResponsiveContainer>
               )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 4 & 5: Tables */}
      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Frequent Subjects</CardTitle>
            <CardDescription>Most commonly asked questions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tLoading ? <p>Loading subjects...</p> : (
                topQs?.data?.length === 0 ? <p className="text-sm text-slate-500">Not enough data.</p> :
                topQs?.data?.map((q: Record<string, unknown>, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                    <span className="truncate pr-4 text-slate-700">{String(q.question_summary)}</span>
                    <span className="font-semibold px-2 py-1 bg-slate-100 rounded-lg">{Number(q.count)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Source Performance</CardTitle>
            <CardDescription>Knowledge nodes cited most frequently by the RAG bot.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {spLoading ? <p>Loading performance...</p> : (
                sourcesPerf?.data?.length === 0 ? <p className="text-sm text-slate-500">Not enough data.</p> :
                sourcesPerf?.data?.map((s: Record<string, unknown>, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                    <span className="truncate pr-4 font-medium">{String(s.source_name)}</span>
                    <span className="text-slate-500">{Number(s.citation_count)} citations</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
    </div>
  )
}
