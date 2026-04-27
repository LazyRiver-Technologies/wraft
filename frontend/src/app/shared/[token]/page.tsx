"use client"
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { Send, Bot, Loader2, Link2Off } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export default function SharedPlaygroundPage() {
  const { token } = useParams()
  
  const [botData, setBotData] = useState<any>(null)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [inputVal, setInputVal] = useState("")
  const [loading, setLoading] = useState(true)
  const [typing, setTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const getSessionId = () => {
    let sess = sessionStorage.getItem(`shared_session_${token}`)
    if (!sess) {
       sess = crypto.randomUUID()
       sessionStorage.setItem(`shared_session_${token}`, sess)
    }
    return sess
  }

  useEffect(() => {
    const fetchSharedContext = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const res = await fetch(`${apiBase}/api/v1/bots/shared/${token}`)
        if (!res.ok) {
           setErrorStatus(res.status)
           setLoading(false)
           return
        }
        const data = await res.json()
        setBotData(data)
        setMessages([{
          id: 'welcome_1',
          role: 'assistant',
          content: data.bot_appearance?.welcome_message || 'Hi there! How can I help you?',
          sources: []
        }])
      } catch (e) {
        console.error(e)
        setErrorStatus(500)
      } finally {
        setLoading(false)
      }
    }
    fetchSharedContext()
  }, [token])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typing])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputVal.trim() || typing || !botData) return
    
    const text = inputVal.trim()
    setInputVal("")
    
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: text }])
    setTyping(true)

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiBase}/api/v1/chat/${botData.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: getSessionId(),
          channel: "web"
        })
      })

      if (res.status === 429) {
          setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'Message limit reached. Please try again later.', sources: [] }])
          return
      }

      const data = await res.json()
      
      setMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        content: data.response || "Sorry, I couldn't process your request.", 
        sources: data.sources || [],
        confidence_score: data.confidence_score
      }])
    } catch (e) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'There was a network error processing your request.', sources: [] }])
    } finally {
      setTyping(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col h-screen bg-slate-50 relative overflow-hidden font-sans animate-in fade-in duration-500">
      <Skeleton className="h-[60px] w-full rounded-none bg-slate-200" />
      <div className="flex-1 p-4 space-y-4 flex flex-col">
        <Skeleton className="h-16 w-3/4 rounded-2xl bg-slate-200" />
        <Skeleton className="h-16 w-2/3 rounded-2xl bg-slate-200 self-end" />
        <Skeleton className="h-16 w-3/4 rounded-2xl bg-slate-200" />
      </div>
      <div className="p-3 border-t border-slate-200 bg-white">
        <Skeleton className="h-10 w-full rounded-full bg-slate-200" />
      </div>
    </div>
  )

  if (errorStatus) {
    return (
      <div className="flex flex-col h-screen bg-[#0f1413] items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-emerald-500/5">
           <Link2Off className="w-10 h-10 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-emerald-50 mb-2">
          {errorStatus === 410 ? "This preview link has expired" : "Link Unavailable"}
        </h1>
        <p className="text-slate-400 max-w-sm leading-relaxed">
          {errorStatus === 410 
            ? "Playground sharing links automatically expire after 7 days for security reasons. Ask the owner to generate a new link."
            : "The page you are looking for has been moved, deleted, or never existed."}
        </p>
      </div>
    )
  }

  const appearance = botData.bot_appearance || {}

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative overflow-hidden font-sans mx-auto max-w-2xl shadow-2xl">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 shrink-0 text-white shadow-sm" style={{ backgroundColor: appearance.theme_color || '#10b981' }}>
        <div className="bg-white/20 p-2 rounded-xl">
           <Bot className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold leading-tight">{appearance.bot_name || botData.name}</h2>
          <p className="text-[12px] opacity-90 leading-tight tracking-wide">Usually replies instantly</p>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 max-w-[85%]">
              {msg.role === 'assistant' && msg.confidence_score !== undefined && (
                <div 
                  title={`Confidence: ${(msg.confidence_score * 100).toFixed(1)}%`}
                  className={`w-2 h-2 rounded-full shrink-0 ${msg.confidence_score > 0.8 ? 'bg-green-500' : msg.confidence_score >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                />
              )}
              <div 
                className={`px-4 py-3 rounded-2xl text-[14.5px] leading-relaxed ${msg.role === 'user' ? 'text-white rounded-br-sm shadow-[0_2px_10px_rgba(0,0,0,0.08)]' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-[0_2px_10px_rgba(0,0,0,0.04)] text-left'}`}
                style={msg.role === 'user' ? { backgroundColor: appearance.theme_color || '#10b981' } : {}}
              >
                {msg.content}
              </div>
            </div>
            {msg.sources && msg.sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 ml-4">
                {msg.sources.map((s: any, idx: number) => (
                   <span key={idx} className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] uppercase font-medium px-2 py-0.5 rounded-full inline-flex items-center">
                     {s.name || `Source ${idx+1}`}
                   </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {typing && (
          <div className="flex items-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-sm flex items-center gap-1.5 ml-4">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-slate-100 shrink-0">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input 
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder={appearance.placeholder_text || "Type your message..."} 
            className="w-full bg-slate-50 border border-slate-200 focus:border-slate-300 focus:bg-white rounded-full pl-5 pr-12 py-3 text-[15px] transition-colors outline-none focus:ring-4 focus:ring-slate-50"
          />
          <button 
            type="submit" 
            disabled={!inputVal.trim() || typing}
            className="absolute right-1.5 p-2 rounded-full text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 shadow-sm"
            style={{ backgroundColor: appearance.theme_color || '#10b981' }}
          >
             <Send className="h-4 w-4 ml-[1px] mt-[1px]" />
          </button>
        </form>
        
        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-medium text-slate-400 uppercase tracking-widest">
           <span>⚡ Powered by Wraft</span>
        </div>
      </div>
    </div>
  )
}
