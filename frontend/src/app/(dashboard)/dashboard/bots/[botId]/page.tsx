"use client"

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Code, CheckCircle2, Zap, Settings, Database, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'

export default function BotOverviewPage() {
  const { botId } = useParams()
  const [copied, setCopied] = useState(false)

  const { data: bot, isLoading } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => fetchApi(`/api/v1/bots/${botId}`)
  })

  // Dummy logic, your widget domain could be dynamically resolved
  const embedCode = `<script src="http://localhost:3000/widget.js" data-bot-id="${botId}" defer></script>`

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return <div className="p-8 animate-pulse space-y-6">
      <div className="h-8 w-1/4 bg-slate-200 rounded"></div>
      <div className="h-64 bg-slate-100 rounded-xl"></div>
    </div>
  }

  if (!bot) return null

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{bot.name} Overview</h1>
          <p className="text-slate-500 mt-1">Status: <span className="text-emerald-500 font-medium inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> Active</span></p>
        </div>
      </div>

      <Card className="border-indigo-100 shadow-indigo-100/20 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 blur-3xl -z-10 rounded-full mix-blend-multiply opacity-70"></div>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <Code className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl text-slate-900">Deploy Your Widget</CardTitle>
              <CardDescription className="text-base text-slate-600 mt-1">Copy and paste this snippet into your website's <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-sm px-1.5 py-0.5 rounded text-sm">&lt;head&gt;</code> or <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-sm px-1.5 py-0.5 rounded text-sm">&lt;body&gt;</code>.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mt-4 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <div className="relative bg-slate-900 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                </div>
                <div className="text-xs font-medium text-slate-400 tracking-wider">HTML EMBED</div>
              </div>
              <div className="p-6 overflow-x-auto text-sm font-mono text-emerald-300 leading-relaxed">
                {embedCode}
              </div>
              <div className="absolute right-4 bottom-4">
                <Button 
                  onClick={handleCopy} 
                  variant="secondary" 
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white border-none shadow-lg backdrop-blur-sm transition-all duration-300"
                >
                  {copied ? <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Copied!</span> : <span className="flex items-center gap-2"><Copy className="h-4 w-4" /> Copy Snippet</span>}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Link href={`/dashboard/bots/${botId}/settings`} className="block group">
          <Card className="h-full border border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 bg-white">
            <CardHeader>
              <Settings className="h-8 w-8 text-indigo-500 mb-2 group-hover:scale-110 transition-transform duration-300" />
              <CardTitle className="text-lg">Bot Settings</CardTitle>
              <CardDescription>Configure prompts, AI models, and behavior</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        
        <Link href={`/dashboard/bots/${botId}/sources`} className="block group">
          <Card className="h-full border border-slate-200 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 bg-white">
            <CardHeader>
              <Database className="h-8 w-8 text-emerald-500 mb-2 group-hover:scale-110 transition-transform duration-300" />
              <CardTitle className="text-lg">Knowledge Base</CardTitle>
              <CardDescription>Manage PDFs, Sitemap Links, and training data</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href={`/dashboard/bots/${botId}/analytics`} className="block group">
          <Card className="h-full border border-slate-200 hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 bg-white">
            <CardHeader>
              <MessageSquare className="h-8 w-8 text-purple-500 mb-2 group-hover:scale-110 transition-transform duration-300" />
              <CardTitle className="text-lg">View Analytics</CardTitle>
              <CardDescription>Track usage, drop-offs, and common questions</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
