"use client"

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Send, Bot, User, RefreshCw, Zap, ShieldAlert, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tokens_used?: number
}

export default function ChatPlaygroundPage() {
  const { botId } = useParams()
  const { toast } = useToast()
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Fetch bot strictly to get the SLUG since the /chat endpoint binds strictly via slug (for public widget parity)
  const { data: bot, isLoading: botLoading } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => fetchApi(`/api/v1/bots/${botId}`)
  })

  useEffect(() => {
    // Generate a secure pseudo-UUID session exclusively for this Playground mount
    setSessionId(`playground-${Math.random().toString(36).substring(2, 11)}`)
  }, [botId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || !bot?.slug) return

    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Direct raw API post simulating the widget logic
      const response = await fetchApi(`/api/v1/chat/${bot.slug}`, {
        method: 'POST',
        body: JSON.stringify({
          message: userMessage.content,
          session_id: sessionId,
          channel: 'web'
        })
      })

      const assistantMessage: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: response.response,
        tokens_used: response.tokens_used
      }
      setMessages(prev => [...prev, assistantMessage])
      
    } catch (err: unknown) {
      toast({
        title: "Simulation Error",
        description: err instanceof Error ? err.message : "Failed to reach AI Core",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setMessages([])
    setSessionId(`playground-${Math.random().toString(36).substring(2, 11)}`)
  }

  if (botLoading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-10 w-48 bg-slate-200 rounded"></div>
      <div className="h-[600px] w-full bg-slate-100 rounded-xl"></div>
    </div>
  }

  return (
    <div className="mx-auto max-w-4xl h-[calc(100vh-8rem)] flex flex-col animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
            <Sparkles className="h-6 w-6 text-indigo-500" />
            Agent Playground
          </h1>
          <p className="text-slate-500 text-sm">Simulate chatting with <span className="font-semibold text-indigo-600">{bot?.name}</span> live in standard generic web mode.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} className="h-8 gap-2 text-slate-600">
          <RefreshCw className="h-3.5 w-3.5" />
          Purge Session
        </Button>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden border-slate-200 shadow-xl shadow-slate-200/40">
        
        {/* Chat History View */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 space-y-6 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full"></div>
                <Bot className="h-16 w-16 text-indigo-400 relative" />
              </div>
              <p className="text-lg">Agent is online and waiting.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
                    <Bot className="h-5 w-5" />
                  </div>
                )}
                
                <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div 
                    className={`px-4 py-3 rounded-2xl whitespace-pre-wrap leading-relaxed shadow-sm
                    ${msg.role === 'user' 
                      ? 'bg-slate-900 text-slate-50 rounded-tr-sm' 
                      : 'bg-white border text-slate-800 border-slate-200/60 rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  
                  {msg.role === 'assistant' && msg.tokens_used !== undefined && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 pl-1">
                      <Zap className="h-3 w-3" />
                      {msg.tokens_used} tokens
                    </span>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                    <User className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex gap-4 justify-start animate-fade-in">
               <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/50 to-purple-600/50 text-white animate-pulse">
                <Bot className="h-5 w-5" />
              </div>
              <div className="px-4 py-4 rounded-2xl bg-white border border-slate-200/60 rounded-tl-sm shadow-sm min-w-[60px] flex items-center justify-center gap-1">
                <span className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce"></span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-100">
          <form onSubmit={handleSend} className="relative flex items-center shadow-sm rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all bg-slate-50/50 hover:bg-white overflow-hidden">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-base py-6 pl-4"
              disabled={isLoading || !bot?.slug}
            />
            <div className="pr-2">
              <Button 
                type="submit" 
                size="icon" 
                disabled={!input.trim() || isLoading}
                className="rounded-lg h-10 w-10 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </form>
          <div className="flex items-center justify-center gap-1 mt-3">
             <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />
             <p className="text-xs text-slate-400">Playground inputs hit production logic and count towards monthly quotas.</p>
          </div>
        </div>

      </Card>
    </div>
  )
}
