"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Send, Mic, Copy, ExternalLink, Pencil, Database, MessageSquare, Lightbulb, Clock, RefreshCw, Activity, Zap } from "lucide-react"
import Link from "next/link"

import { useStore } from "@/lib/store"
import { useBot, useSharePlayground } from "@/hooks/api/useBots"
import { useChat } from "@/hooks/api/useChat"
import { useSources } from "@/hooks/api/useSources"
import { useQA } from "@/hooks/api/useQA"
import { useSuggestionsQuery } from "@/hooks/api/useAnalytics"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

export default function BotPlaygroundPage(props: { params: any }) {
  const params = React.use(props.params as Promise<{ botId: string }>)
  const { data: bot, isLoading: botLoading } = useBot(params.botId)
  const currentBotFromStore = useStore((state) => state.currentBot)
  const botData = bot || currentBotFromStore
  
  const { toast } = useToast()
  
  // Custom API hooks - using botData?.slug for chat
  const { messages, isTyping, sendMessage } = useChat(botData?.slug)
  const { data: sourcesData, isLoading: sourcesLoading } = useSources(params.botId)
  const { data: suggestionsData, isLoading: suggestionsLoading } = useSuggestionsQuery(params.botId)
  const { data: qaData, isLoading: qaLoading } = useQA(params.botId)
  const shareMutation = useSharePlayground()

  const [inputValue, setInputValue] = useState("")
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const handleSend = () => {
    if (!inputValue.trim() || !botData?.slug) return
    sendMessage(inputValue)
    setInputValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleLanguageTest = (msg: string) => {
    setInputValue(msg)
  }

  const [shareLink, setShareLink] = useState("")

  const handleShare = async () => {
    try {
      const res = await shareMutation.mutateAsync(params.botId)
      const url = `${window.location.origin}/shared/${res.token}`
      setShareLink(url)
      try {
        await navigator.clipboard.writeText(url)
        toast({
          title: "Share link generated!",
          description: "Link copied to clipboard. Valid for 7 days.",
        })
      } catch (clipErr) {
        toast({
          title: "Share link generated!",
          description: "Link is ready. Please copy it from the input field below.",
        })
      }
    } catch (err) {
      toast({
        title: "Failed to generate link",
        variant: "destructive"
      })
    }
  }

  // Health Stats Calculations
  const sourcesArray = sourcesData || []
  const totalSources = sourcesArray.length || 0
  const readySources = sourcesArray.filter((s:any) => s.status === 'ready').length || 0
  const pendingSuggestions = suggestionsData?.length || 0
  const activeQA = qaData?.length || 0
  
  // Estimate training time based on last updated source
  const lastTrained = sourcesArray.reduce((latest: any, s: any) => {
    const d = new Date(s.updated_at || s.created_at)
    return !latest || d > latest ? d : latest
  }, null)

  const timeAgo = (date: Date) => {
    if (!date) return "Never"
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return "Just now"
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  if (botLoading && !botData) {
    return (
      <div className="space-y-6 animate-pulse mt-4">
        <div className="h-10 w-48 bg-bg-tertiary rounded-md" />
        <div className="flex flex-col lg:flex-row gap-6 h-[600px]">
          <div className="flex-[0.55] bg-bg-secondary rounded-xl border border-border-default" />
          <div className="flex-[0.45] flex flex-col gap-6">
             <div className="h-48 bg-bg-secondary rounded-xl border border-border-default" />
             <div className="h-48 bg-bg-secondary rounded-xl border border-border-default" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader 
        title="Playground" 
        description="Interact closely with your bot in real-time."
      >
        <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-9">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh Bot
        </Button>
      </PageHeader>

      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">
        
        {/* LEFT PANEL: 55% PLAYGROUND */}
        <div className="flex-[0.55] flex flex-col rounded-xl border border-border-default bg-bg-secondary overflow-hidden shadow-sm transition-all hover:shadow-md">
          {/* Playground Header */}
          <div className="flex items-center justify-between border-b border-border-default px-5 py-4 bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <h3 className="font-medium text-text-primary">{botData?.name || "AI Assistant"}</h3>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleLanguageTest("Translate 'pricing' to English")} className="text-[10px] uppercase font-bold tracking-wider bg-bg-tertiary hover:bg-bg-elevated border border-border-default text-text-secondary px-2 py-1 rounded transition-colors">EN</button>
              <button onClick={() => handleLanguageTest("प्राइसिंग के बारे में बताएं")} className="text-[10px] uppercase font-bold tracking-wider bg-bg-tertiary hover:bg-bg-elevated border border-border-default text-text-secondary px-2 py-1 rounded transition-colors">HI</button>
              <button onClick={() => handleLanguageTest("ಬೆಲೆಗಳ ಬಗ್ಗೆ ಹೇಳಿ")} className="text-[10px] uppercase font-bold tracking-wider bg-bg-tertiary hover:bg-bg-elevated border border-border-default text-text-secondary px-2 py-1 rounded transition-colors">KN</button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-5 pb-0 space-y-4 scroll-smooth no-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex w-full ${msg.isBot ? "justify-start" : "justify-end"}`}>
                <div className={`relative max-w-[85%] rounded-2xl px-4 py-3 text-sm group transition-all ${msg.isBot ? "bg-bg-tertiary text-text-primary rounded-tl-sm shadow-sm" : "bg-brand text-white rounded-tr-sm shadow-brand-glow"}`}>
                  
                  {/* Bot Specific Overlays */}
                  {msg.isBot && (
                    <>
                      {msg.confidence === "high" && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-bg-secondary" title="High Confidence"></span>}
                      {msg.confidence === "medium" && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-bg-secondary" title="Medium Confidence"></span>}
                      {msg.confidence === "low" && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-bg-secondary" title="Low Confidence"></span>}
                      
                      <button className="absolute -right-10 top-0 p-2 rounded-lg bg-bg-secondary border border-border-default text-text-tertiary opacity-0 group-hover:opacity-100 transition-all hover:text-text-primary hover:bg-bg-tertiary shadow-sm">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex w-full justify-start animate-in fade-in duration-300">
                <div className="bg-bg-tertiary rounded-2xl rounded-tl-sm px-4 py-4 flex items-center gap-1.5 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand/50 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-brand/50 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-brand/50 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-6" />
          </div>

          {/* Chat Input */}
          <div className="border-t border-border-default p-4 bg-bg-secondary/50 backdrop-blur-sm">
            <div className="relative flex items-center gap-3">
              <div className="relative flex-1">
                <Input 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask your bot a question..." 
                  className="pr-12 h-12 bg-bg-primary border-border-default focus:border-brand transition-all rounded-xl shadow-inner"
                />
                <button className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-brand transition-colors p-1 rounded-md hover:bg-bg-tertiary">
                  <Mic className="h-4 w-4" />
                </button>
              </div>
              
              <Button size="icon" className="h-12 w-12 shrink-0 rounded-xl shadow-lg hover:shadow-brand-glow transition-all" onClick={handleSend} disabled={!inputValue.trim() || isTyping}>
                <Send className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-[10px] text-text-tertiary text-center mt-3 tracking-wide">SYSTEM SIMULATION: DATA RECALLED FROM CONNECTED KNOWLEDGE BASE</p>
          </div>
        </div>

        {/* RIGHT PANEL: 45% STATS */}
        <div className="flex-[0.45] flex flex-col gap-6 overflow-y-auto no-scrollbar pb-6">
          
          <div className="rounded-xl border border-border-default bg-bg-secondary p-6 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-6">
               <h3 className="font-semibold text-text-primary flex items-center gap-2">
                 <Activity className="h-4 w-4 text-brand" /> Bot Health
               </h3>
               <Badge variant="outline" className="bg-bg-tertiary border-none text-[10px] font-bold uppercase tracking-tighter">Live Monitor</Badge>
            </div>
            
            <div className="space-y-5">
              <div className="flex items-center justify-between group cursor-default">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-brand/10 flex items-center justify-center transition-colors group-hover:bg-brand/20">
                    <Database className="h-4 w-4 text-brand" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text-primary">Data Sources</span>
                    <span className="text-[10px] text-text-tertiary uppercase tracking-widest font-bold">Knowledge Base</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-text-primary">{readySources} / {totalSources}</span>
                  {readySources === totalSources && totalSources > 0 ? (
                     <Badge variant="success" className="h-5 px-1.5">Healthy</Badge>
                  ) : totalSources === 0 ? (
                     <Badge variant="default" className="h-5 px-1.5">Empty</Badge>
                  ) : (
                     <Badge variant="warning" className="h-5 px-1.5 animate-pulse">Syncing</Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between group cursor-default">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center transition-colors group-hover:bg-success/20">
                    <MessageSquare className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text-primary">Q&amp;A Pairs</span>
                    <span className="text-[10px] text-text-tertiary uppercase tracking-widest font-bold">Instant Overrides</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-text-primary">{activeQA} Active</span>
              </div>

              <div className="flex items-center justify-between group cursor-default">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center transition-colors group-hover:bg-warning/20">
                    <Clock className="h-4 w-4 text-warning" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text-primary">Last Trained</span>
                    <span className="text-[10px] text-text-tertiary uppercase tracking-widest font-bold">Deployment Age</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-text-primary">{timeAgo(lastTrained)}</span>
              </div>

              <div className="flex items-center justify-between group cursor-default">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-danger/10 flex items-center justify-center transition-colors group-hover:bg-danger/20">
                    <Lightbulb className="h-4 w-4 text-danger" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text-primary">Suggestions</span>
                    <span className="text-[10px] text-text-tertiary uppercase tracking-widest font-bold">Unresolved Gaps</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${pendingSuggestions > 0 ? "text-danger" : "text-text-primary"}`}>{pendingSuggestions}</span>
                  {pendingSuggestions > 0 && <span className="h-1.5 w-1.5 rounded-full bg-danger animate-ping" />}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border-default bg-bg-secondary p-6 shadow-sm transition-all hover:shadow-md">
            <h3 className="font-semibold text-text-primary mb-2 flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-brand" /> Share Playground
            </h3>
            <p className="text-xs text-text-secondary mb-5 leading-relaxed">
              Generate a secure public link to share this exact configuration with team members or clients. Links expire automatically.
            </p>
            
            <div className="flex flex-col gap-3">
              {shareLink ? (
                <div className="flex items-center gap-2">
                  <Input readOnly value={shareLink} className="bg-bg-primary text-xs font-mono" />
                  <Button size="icon" variant="secondary" className="shrink-0" onClick={() => {
                    navigator.clipboard.writeText(shareLink)
                    toast({ title: "Copied!" })
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" className="w-full justify-between group h-11 rounded-lg border-border-default hover:bg-bg-tertiary" onClick={handleShare} disabled={shareMutation.isPending}>
                  <span className="flex items-center text-sm">
                    {shareMutation.isPending ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-2 h-4 w-4 text-brand" />
                    )}
                    {shareMutation.isPending ? "Generating..." : "Generate access link"}
                  </span>
                  <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-all text-text-tertiary" />
                </Button>
              )}
              <p className="text-[10px] text-text-tertiary text-center italic">Public access will be restricted to the playground interface only.</p>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-2 gap-4">
             <Link href={`/dashboard/bots/${params.botId}/sources`} className="flex flex-col gap-2 p-4 rounded-xl border border-border-default bg-bg-secondary hover:border-brand hover:bg-brand/5 transition-all group">
                <Database className="h-4 w-4 text-text-tertiary group-hover:text-brand" />
                <span className="text-xs font-medium">Add Knowledge</span>
             </Link>
             <Link href={`/dashboard/bots/${params.botId}/settings`} className="flex flex-col gap-2 p-4 rounded-xl border border-border-default bg-bg-secondary hover:border-brand hover:bg-brand/5 transition-all group">
                <Zap className="h-4 w-4 text-text-tertiary group-hover:text-brand" />
                <span className="text-xs font-medium">Core Logic</span>
             </Link>
          </div>

        </div>
      </div>
    </>
  )
}
