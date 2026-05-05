"use client"

import * as React from 'react'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { Copy, MessageSquare, X, Loader2 } from 'lucide-react'
import { PageHeader } from "@/components/ui/page-header"
import { useProfileWithPlan } from "@/hooks/api/useBilling"
import { FeatureGate } from "@/components/ui/FeatureGate"

function ChatWidgetMock({ theme, welcomeMsg, placeholder, botAvatarUrl, botName }: { theme: string, welcomeMsg: string, placeholder: string, botAvatarUrl?: string, botName?: string }) {
  const [open, setOpen] = useState(true)
  
  return (
    <div className="relative w-[350px] h-[500px] border border-border-default rounded-xl overflow-hidden bg-bg-primary flex flex-col shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white" style={{ backgroundColor: theme }}>
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-1.5 rounded-full flex items-center justify-center overflow-hidden h-8 w-8">
             {botAvatarUrl ? (
               <img src={botAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
             ) : (
               <span className="font-bold text-sm">
                 {botName ? botName.charAt(0).toUpperCase() : <MessageSquare className="h-4 w-4" />}
               </span>
             )}
          </div>
          <span className="font-semibold text-sm">{botName || "Support Agent"}</span>
        </div>
        <button onClick={() => setOpen(!open)} className="hover:opacity-80 transition-opacity"><X className="h-4 w-4" /></button>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-bg-secondary/30">
        <div className="flex justify-start">
          <div className="bg-bg-primary border border-border-default text-text-primary rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[85%] shadow-sm">
            {welcomeMsg || "Hi there! How can I help you today?"}
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3 bg-bg-primary border-t border-border-default">
        <div className="relative">
          <input 
            disabled
            placeholder={placeholder || "Type your message..."} 
            className="w-full bg-bg-secondary border border-transparent rounded-full pl-4 pr-10 py-2.5 text-sm focus:outline-none"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-full text-white flex items-center justify-center" style={{ backgroundColor: theme }}>
             <MessageSquare className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="mt-2 text-center">
          <span className="text-[10px] text-text-tertiary font-medium flex items-center justify-center gap-1">
            <MessageSquare className="h-3 w-3" /> Powered by Wraft
          </span>
        </div>
      </div>
    </div>
  )
}

export default function AppearancePage(props: { params: any }) {
  const params = React.use(props.params as Promise<{ botId: string }>)
  const botId = params.botId
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: profile } = useProfileWithPlan()
  const hasCustomBranding = profile?.plans?.custom_branding === true

  const { data: bot, isLoading } = useQuery({
    queryKey: ['bot', botId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bots')
        .select('*, bot_appearance(*)')
        .eq('id', botId)
        .is('deleted_at', null)
        .single()
      if (error) throw error
      return data
    }
  })

  const [appearance, setAppearance] = useState({
    theme_color: '#7C5CFC',
    welcome_message: 'Hi there! How can I help you today?',
    placeholder_text: 'Type your message...',
    position: 'bottom-right',
    bot_avatar_url: '',
    launcher_icon: 'chat'
  })

  useEffect(() => {
    if (bot && bot.bot_appearance) {
      setAppearance({
        theme_color: bot.bot_appearance.theme_color || '#7C5CFC',
        welcome_message: bot.bot_appearance.welcome_message || '',
        placeholder_text: bot.bot_appearance.placeholder_text || '',
        position: bot.bot_appearance.position || 'bottom-right',
        bot_avatar_url: bot.bot_appearance.bot_avatar_url || '',
        launcher_icon: bot.bot_appearance.launcher_icon || 'chat'
      })
    }
  }, [bot])

  const { mutate, isPending } = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      fetchApi(`/api/v1/bots/${botId}/appearance`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot', botId] })
      toast({ title: "Success", description: "Appearance settings saved." })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  })

  const domain = typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'
  const slug = bot?.slug || 'your-bot-slug'
  const embedCode = `<script src="https://wraft.in/widget.js" data-bot-slug="${slug}"></script>`

  if (isLoading) return (
    <div className="pb-10 animate-in fade-in duration-500">
      <div className="h-10 w-48 bg-bg-tertiary rounded-md animate-pulse mb-8" />
      <div className="grid lg:grid-cols-2 gap-10 max-w-6xl">
        <div className="space-y-6">
          <Skeleton className="h-[400px] w-full rounded-xl bg-bg-secondary border border-border-default" />
        </div>
        <div className="bg-bg-tertiary/30 rounded-2xl flex items-center justify-center min-h-[600px] border border-border-default">
          <Skeleton className="w-[350px] h-[500px] rounded-xl bg-bg-secondary" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="pb-10 animate-in fade-in duration-500">
      <PageHeader 
        title="Appearance" 
        description="Customize how your widget looks on your website."
      />

      <div className="grid lg:grid-cols-[1fr_auto] gap-10 max-w-6xl mt-6">
        <div className="space-y-6">
          
          <FeatureGate hasAccess={hasCustomBranding} requiredPlan="Scale">
          <Card className="bg-bg-secondary border-border-default shadow-sm">
            <CardHeader className="pb-4">
               <CardTitle className="text-text-primary text-lg">Styling & Branding</CardTitle>
               <CardDescription className="text-text-secondary">Brand colors and greeting copy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Theme Color</label>
                <div className="flex items-center gap-3">
                  <div className="relative h-11 w-14 rounded-lg border border-border-default overflow-hidden p-1 bg-bg-primary">
                    <input 
                      type="color" 
                      value={appearance.theme_color} 
                      onChange={e => setAppearance({...appearance, theme_color: e.target.value})} 
                      className="absolute -top-2 -left-2 w-20 h-20 cursor-pointer border-0 p-0 m-0" 
                    />
                  </div>
                  <Input 
                     value={appearance.theme_color} 
                     onChange={e => setAppearance({...appearance, theme_color: e.target.value})} 
                     className="w-32 uppercase font-mono bg-bg-primary border-border-default h-11" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Welcome Message</label>
                <Input 
                  value={appearance.welcome_message} 
                  onChange={e => setAppearance({...appearance, welcome_message: e.target.value})} 
                  className="bg-bg-primary border-border-default h-11 focus:border-brand"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Placeholder Text</label>
                <Input 
                  value={appearance.placeholder_text} 
                  onChange={e => setAppearance({...appearance, placeholder_text: e.target.value})} 
                  className="bg-bg-primary border-border-default h-11 focus:border-brand"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Bot Avatar URL</label>
                <Input 
                  value={appearance.bot_avatar_url} 
                  onChange={e => setAppearance({...appearance, bot_avatar_url: e.target.value})} 
                  placeholder="https://example.com/avatar.png"
                  className="bg-bg-primary border-border-default h-11 focus:border-brand"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Launcher Icon</label>
                <Input 
                  value={appearance.launcher_icon} 
                  onChange={e => setAppearance({...appearance, launcher_icon: e.target.value})} 
                  placeholder="chat"
                  className="bg-bg-primary border-border-default h-11 focus:border-brand"
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Widget Position</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary hover:text-text-primary">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${appearance.position === 'bottom-left' ? 'border-brand' : 'border-text-tertiary'}`}>
                       {appearance.position === 'bottom-left' && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
                    </div>
                    <input type="radio" className="hidden" checked={appearance.position === 'bottom-left'} onChange={() => setAppearance({...appearance, position: 'bottom-left'})} />
                    Bottom Left
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary hover:text-text-primary">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${appearance.position === 'bottom-right' ? 'border-brand' : 'border-text-tertiary'}`}>
                       {appearance.position === 'bottom-right' && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
                    </div>
                    <input type="radio" className="hidden" checked={appearance.position === 'bottom-right'} onChange={() => setAppearance({...appearance, position: 'bottom-right'})} />
                    Bottom Right
                  </label>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-border-default bg-bg-tertiary/30 px-6 py-4">
              <Button onClick={() => mutate(appearance)} disabled={isPending} className="w-full sm:w-auto h-10 px-6">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isPending ? "Saving..." : "Save Appearance"}
              </Button>
            </CardFooter>
          </Card>
          </FeatureGate>

          <Card className="bg-bg-secondary border-border-default shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-text-primary text-lg">Embed Code</CardTitle>
              <CardDescription className="text-text-secondary">Paste this snippet right before the &lt;/body&gt; tag on your website.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative group">
                <pre className="bg-[#0f1413] text-emerald-100/90 p-4 rounded-xl text-sm overflow-x-auto border border-white/10 font-mono leading-relaxed">
                  {embedCode}
                </pre>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 border-none hover:bg-white/20 text-white"
                  onClick={() => {
                    navigator.clipboard.writeText(embedCode)
                    toast({ title: "Copied to clipboard!" })
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Mock Preview */}
        <div className="bg-bg-tertiary/30 rounded-2xl flex items-center justify-center min-h-[600px] border border-border-default lg:w-[450px] relative overflow-hidden p-8">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border-default)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-default)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />
          <ChatWidgetMock 
            theme={appearance.theme_color} 
            welcomeMsg={appearance.welcome_message} 
            placeholder={appearance.placeholder_text} 
            botAvatarUrl={appearance.bot_avatar_url}
            botName={bot?.name}
          />
        </div>
      </div>
    </div>
  )
}
