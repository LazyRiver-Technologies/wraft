"use client"
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { Send, Bot, Loader2 } from "lucide-react"

export default function WidgetApp() {
  const { slug } = useParams()
  
  const [appearance, setAppearance] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [inputVal, setInputVal] = useState("")
  const [loading, setLoading] = useState(true)
  const [typing, setTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Session ID persistence tracking conversations per visitor locally without external cookie reliance
  const getSessionId = () => {
    let sess = sessionStorage.getItem(`bot_session_${slug}`)
    if (!sess) {
       sess = crypto.randomUUID()
       sessionStorage.setItem(`bot_session_${slug}`, sess)
    }
    return sess
  }

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const res = await fetch(`${apiBase}/api/v1/chat/${slug}/appearance`)
        if (res.ok) {
           const data = await res.json()
           setAppearance(data)
           setMessages([{
             id: 'welcome_1',
             role: 'assistant',
             content: data.welcome_message || 'Hi there! How can I help you?',
             sources: []
           }])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [slug])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typing])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputVal.trim() || typing) return
    
    const text = inputVal.trim()
    setInputVal("")
    
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: text }])
    setTyping(true)

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiBase}/api/v1/chat/${slug}`, {
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
        sources: data.sources || [] 
      }])
    } catch (e) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'There was a network error processing your request.', sources: [] }])
    } finally {
      setTyping(false)
    }
  }

  if (loading || !appearance) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-slate-400 h-6 w-6" /></div>

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative overflow-hidden font-sans">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 text-white shadow-sm" style={{ backgroundColor: appearance.theme_color }}>
        <div className="bg-white/20 p-1.5 rounded-full">
           <Bot className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold leading-tight">Support Agent</h2>
          <p className="text-[11px] opacity-80 leading-tight">Usually replies instantly</p>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-[14.5px] leading-[1.4] ${msg.role === 'user' ? 'text-white rounded-br-sm shadow-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'}`}
              style={msg.role === 'user' ? { backgroundColor: appearance.theme_color } : {}}
            >
              {msg.content}
            </div>
            {msg.sources && msg.sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                {msg.sources.map((s: any, idx: number) => (
                   <span key={idx} className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] uppercase font-medium px-2 py-0.5 rounded-full inline-flex items-center">
                     {s.name || `Source ${idx+1}`}
                   </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {typing && (
          <div className="flex items-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input 
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder={appearance.placeholder_text || "Type your message..."} 
            className="w-full bg-slate-100 border border-transparent focus:border-slate-300 focus:bg-white rounded-full pl-4 pr-12 py-2.5 text-sm transition-colors outline-none focus:ring-2 focus:ring-slate-100"
          />
          <button 
            type="submit" 
            disabled={!inputVal.trim() || typing}
            className="absolute right-1.5 p-1.5 rounded-full text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{ backgroundColor: appearance.theme_color }}
          >
             <Send className="h-4 w-4 ml-[1px] mt-[1px]" />
          </button>
        </form>
      </div>
    </div>
  )
}
