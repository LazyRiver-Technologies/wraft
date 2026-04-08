"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Copy, MessageSquare, X } from 'lucide-react'

function ChatWidgetMock({ theme, welcomeMsg, placeholder }: { theme: string, welcomeMsg: string, placeholder: string }) {
  const [open, setOpen] = useState(true)
  
  return (
    <div className="relative w-[350px] h-[500px] border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white" style={{ backgroundColor: theme }}>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <span className="font-semibold">Support Agent</span>
        </div>
        <button onClick={() => setOpen(!open)} className="hover:opacity-80"><X className="h-5 w-5" /></button>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        <div className="flex justify-start">
          <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-2 text-sm max-w-[85%] shadow-sm">
            {welcomeMsg || "Hi there! How can I help you today?"}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-slate-200">
        <div className="relative">
          <input 
            disabled
            placeholder={placeholder || "Type your message..."} 
            className="w-full bg-slate-100 border-transparent rounded-full pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': theme } as React.CSSProperties}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-white" style={{ backgroundColor: theme }}>
             <MessageSquare className="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AppearancePage() {
  const { botId } = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: bot, isLoading } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => fetchApi(`/api/v1/bots/${botId}`)
  })

  const [appearance, setAppearance] = useState({
    theme_color: '#4f46e5',
    welcome_message: 'Hi there! How can I help you today?',
    placeholder_text: 'Type your message...',
    position: 'bottom-right'
  })

  useEffect(() => {
    if (bot && bot.bot_appearance) {
      setAppearance({
        theme_color: bot.bot_appearance.theme_color || '#4f46e5',
        welcome_message: bot.bot_appearance.welcome_message || '',
        placeholder_text: bot.bot_appearance.placeholder_text || '',
        position: bot.bot_appearance.position || 'bottom-right'
      })
    }
  }, [bot])

  const { mutate, isPending } = useMutation({
    mutationFn: (patch: Record<string, unknown>) => fetchApi(`/api/v1/bots/${botId}/appearance`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot', botId] })
      toast({ title: "Success", description: "Appearance settings saved." })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  })

  // Determine domain generically from window if possible
  const domain = typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'
  const slug = bot?.slug || 'your-bot-slug'
  const embedCode = `<script src="${domain}/widget.js" data-bot-slug="${slug}"></script>`

  if (isLoading) return <p>Loading...</p>

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-6xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Appearance</h1>
          <p className="text-slate-500">Customize how your widget looks on your website.</p>
        </div>

        <Card>
          <CardHeader>
             <CardTitle>Styling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Theme Color</label>
              <div className="flex items-center gap-4">
                <input 
                  type="color" 
                  value={appearance.theme_color} 
                  onChange={e => setAppearance({...appearance, theme_color: e.target.value})} 
                  className="h-10 w-10 cursor-pointer rounded-lg border-2 border-slate-200" 
                />
                <Input value={appearance.theme_color} onChange={e => setAppearance({...appearance, theme_color: e.target.value})} className="w-32 uppercase" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Welcome Message</label>
              <Input 
                value={appearance.welcome_message} 
                onChange={e => setAppearance({...appearance, welcome_message: e.target.value})} 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Placeholder Text</label>
              <Input 
                value={appearance.placeholder_text} 
                onChange={e => setAppearance({...appearance, placeholder_text: e.target.value})} 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Widget Position</label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={appearance.position === 'bottom-left'} onChange={() => setAppearance({...appearance, position: 'bottom-left'})} />
                  Bottom Left
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={appearance.position === 'bottom-right'} onChange={() => setAppearance({...appearance, position: 'bottom-right'})} />
                  Bottom Right
                </label>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4">
            <Button onClick={() => mutate(appearance)} disabled={isPending}>
              {isPending ? "Saving..." : "Save Appearance"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Embed Code</CardTitle>
            <CardDescription>Paste this snippet right before the &lt;/body&gt; tag on your website.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
                {embedCode}
              </pre>
              <Button 
                size="icon" 
                variant="secondary" 
                className="absolute top-2 right-2"
                onClick={() => {
                  navigator.clipboard.writeText(embedCode)
                  toast({ title: "Copied to clipboard!" })
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-slate-100 rounded-2xl flex items-center justify-center min-h-[600px] border border-slate-200">
        <ChatWidgetMock theme={appearance.theme_color} welcomeMsg={appearance.welcome_message} placeholder={appearance.placeholder_text} />
      </div>
    </div>
  )
}
