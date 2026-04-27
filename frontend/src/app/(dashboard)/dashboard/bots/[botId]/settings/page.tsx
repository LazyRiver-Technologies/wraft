"use client"

import * as React from "react"
import { useState } from "react"
import { Copy, AlertTriangle, Trash2, Smartphone, Save, Loader2 } from "lucide-react"

import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { 
  useBot, useDeleteBot, useUpdateBotSettings, 
  useUpdateBotAppearance, useUpdateBotNotifications, useUpdateBot
} from "@/hooks/api/useBots"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export default function BotSettingsPage(props: { params: any }) {
  const params = React.use(props.params as Promise<{ botId: string }>)
  const [activeTab, setActiveTab] = useState("general")
  const router = useRouter()
  const { toast } = useToast()
  
  const { data: bot, isLoading } = useBot(params.botId)
  
  const updateBot = useUpdateBot()
  const updateSettings = useUpdateBotSettings()
  const updateAppearance = useUpdateBotAppearance()
  const updateNotifications = useUpdateBotNotifications()
  const deleteBot = useDeleteBot()

  const [deleteConfirmName, setDeleteConfirmName] = useState("")

  const [aiConfig, setAiConfig] = useState({
    system_prompt: "You are a helpful customer support agent. Always answer politely and use the provided context to answer questions. If you do not know the answer, explicitly state that you don't know.",
    model: "gemini-2.5-flash-lite",
    temperature: 0.3,
    search_mode: "hybrid",
    max_chunks: 5,
    fallback_message: "I'm sorry, I couldn't find information about that. Let me connect you to a human.",
    guardrails_enabled: true
  })

  React.useEffect(() => {
    if (bot?.bot_settings) {
      setAiConfig(prev => ({
        system_prompt: bot.bot_settings?.system_prompt || prev.system_prompt,
        model: bot.bot_settings?.model || prev.model,
        temperature: bot.bot_settings?.temperature ?? prev.temperature,
        search_mode: bot.bot_settings?.search_mode || prev.search_mode,
        max_chunks: bot.bot_settings?.max_chunks || prev.max_chunks,
        fallback_message: bot.bot_settings?.fallback_message || prev.fallback_message,
        guardrails_enabled: bot.bot_settings?.guardrails_enabled ?? prev.guardrails_enabled
      }))
    }
  }, [bot])

  const handleSaveAi = () => {
    updateSettings.mutate({
      botId: params.botId,
      data: aiConfig as any
    }, {
      onSuccess: () => toast({ title: "Success", description: "AI settings saved." })
    })
  }

  const handleSaveGeneral = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    updateBot.mutate({
      botId: params.botId,
      data: {
        name: formData.get("name") as string,
        is_active: formData.get("is_active") === "on"
      }
    }, {
      onSuccess: () => toast({ title: "Success", description: "General settings saved." })
    })
  }

  const handleSaveNotifications = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    updateNotifications.mutate({
      botId: params.botId,
      data: {
        owner_whatsapp: (formData.get("owner_whatsapp") as string) || undefined,
        notify_on_lead: formData.get("notify_on_lead") === "on",
        notify_on_fallback: formData.get("notify_on_fallback") === "on",
        notify_on_escalation: formData.get("notify_on_escalation") === "on",
      }
    }, {
      onSuccess: () => toast({ title: "Success", description: "Notification settings saved." })
    })
  }

  const handleDelete = () => {
    if (deleteConfirmName === bot?.name) {
      deleteBot.mutate(params.botId, {
        onSuccess: () => {
          toast({ title: "Bot Deleted", description: "All associated data has been purged." })
          router.push("/dashboard/bots")
        }
      })
    }
  }

  const tabs = [
    { id: "general", label: "General" },
    { id: "ai", label: "AI Configuration" },
    { id: "notifications", label: "Notifications" },
    { id: "danger", label: "Danger Zone" }
  ]

  return (
    <>
      <PageHeader 
        title="Bot Settings" 
        description="Configure your assistant's behavior, personality, and notifications."
      />

      <div className="flex flex-col gap-8 pb-20">
        
        {/* TABS HEADER */}
        <div className="flex items-center gap-1 border-b border-border-default pb-0 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id 
                  ? (tab.id === 'danger' ? 'border-danger text-danger' : 'border-brand text-brand') 
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-default'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENTS */}
        <div className="max-w-4xl">
          {isLoading && <div className="h-48 w-full bg-bg-secondary rounded-xl animate-pulse border border-border-default" />}
          
          {/* GENERAL TAB */}
          {activeTab === "general" && bot && (
            <form onSubmit={handleSaveGeneral} id="form-general" className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-text-primary">Bot Name</label>
                <p className="text-xs text-text-tertiary">Used internally to identify this assistant.</p>
                <Input name="name" defaultValue={bot.name || ""} className="max-w-md bg-bg-secondary border-border-default focus:border-brand" />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-text-primary">URL Slug / App ID</label>
                <p className="text-xs text-text-tertiary">Unique identifier for API requests and the chat widget.</p>
                <div className="flex max-w-md gap-2">
                  <Input defaultValue={bot.slug || ""} readOnly className="font-mono text-text-secondary bg-bg-tertiary border-border-default" />
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="icon" 
                    className="shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(bot.slug)
                      toast({ title: "Copied", description: "Slug copied to clipboard." })
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-5 rounded-xl border border-border-default bg-bg-secondary max-w-xl shadow-sm">
                <div className="flex flex-col gap-1">
                  <h4 className="font-medium text-text-primary text-sm">Bot Active Status</h4>
                  <p className="text-xs text-text-tertiary w-[90%]">Pause all interactions globally. Requests will return an offline state.</p>
                </div>
                <Switch name="is_active" defaultChecked={bot.is_active !== false} />
              </div>

              <Button type="submit" disabled={updateSettings.isPending} className="w-fit">
                {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </form>
          )}

          {/* AI TAB */}
          {activeTab === "ai" && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-text-primary">System Prompt</label>
                <p className="text-xs text-text-tertiary uppercase tracking-widest font-bold">Identity & Constraints</p>
                <Textarea 
                  value={aiConfig.system_prompt}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, system_prompt: e.target.value }))}
                  className="font-mono min-h-[160px] bg-bg-secondary border-border-default focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-text-primary">LLM Model</label>
                  <Select value={aiConfig.model} onValueChange={(val) => setAiConfig(prev => ({ ...prev, model: val }))}>
                    <SelectTrigger className="bg-bg-secondary border-border-default">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent className="bg-bg-elevated border-border-default">
                      <SelectItem value="gemini-2.5-flash-lite">Gemini Flash Lite (Fastest)</SelectItem>
                      <SelectItem value="gemini-1.5-pro">Gemini Pro 1.5</SelectItem>
                      <SelectItem value="llama-3.1-8b-instant">Llama 3.1 8B (Groq)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-text-primary">Temperature: {aiConfig.temperature}</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-tertiary w-14 text-right font-bold">STRICT</span>
                    <input type="range" min="0" max="100" value={aiConfig.temperature * 100} onChange={(e) => setAiConfig(prev => ({ ...prev, temperature: parseInt(e.target.value) / 100 }))} className="flex-1 accent-brand h-1.5 bg-bg-tertiary rounded-lg appearance-none cursor-pointer" />
                    <span className="text-[10px] text-text-tertiary w-14 font-bold">CREATIVE</span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-text-primary">Search Mode</label>
                  <div className="flex rounded-lg p-1 bg-bg-tertiary border border-border-default">
                    <button onClick={() => setAiConfig(prev => ({ ...prev, search_mode: 'hybrid' }))} className={`flex-1 py-1.5 text-xs font-medium rounded shadow-sm ${aiConfig.search_mode === 'hybrid' ? 'bg-bg-elevated text-text-primary' : 'text-text-tertiary hover:text-text-primary'} transition-colors`}>Hybrid</button>
                    <button onClick={() => setAiConfig(prev => ({ ...prev, search_mode: 'vector' }))} className={`flex-1 py-1.5 text-xs font-medium rounded shadow-sm ${aiConfig.search_mode === 'vector' ? 'bg-bg-elevated text-text-primary' : 'text-text-tertiary hover:text-text-primary'} transition-colors`}>Vector Only</button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-text-primary">Max Context Chunks</label>
                  <Input type="number" value={aiConfig.max_chunks} onChange={(e) => setAiConfig(prev => ({ ...prev, max_chunks: parseInt(e.target.value) || 1 }))} min="1" max="20" className="bg-bg-secondary border-border-default" />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-text-primary">Fallback Message</label>
                <Input 
                   value={aiConfig.fallback_message}
                   onChange={(e) => setAiConfig(prev => ({ ...prev, fallback_message: e.target.value }))}
                   className="bg-bg-secondary border-border-default"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-bg-secondary border border-border-default rounded-xl">
                <div>
                  <h4 className="text-sm font-medium text-text-primary">Guardrails</h4>
                  <p className="text-sm text-text-secondary">Block off-topic questions, harmful content, and prompt injection attempts.</p>
                </div>
                <Switch 
                  checked={aiConfig.guardrails_enabled} 
                  onCheckedChange={(checked) => setAiConfig(prev => ({ ...prev, guardrails_enabled: checked }))} 
                />
              </div>

              <Button onClick={handleSaveAi} disabled={updateSettings.isPending} className="w-fit">
                {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save AI Config
              </Button>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === "notifications" && bot && (
            <form onSubmit={handleSaveNotifications} className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-end gap-3 max-w-md mb-4">
                <div className="grid gap-2 flex-1">
                  <label className="text-sm font-medium text-text-primary">Owner WhatsApp Number</label>
                  <p className="text-xs text-text-tertiary">Include country code (e.g. +91...)</p>
                  <Input name="owner_whatsapp" defaultValue={bot.bot_settings?.owner_whatsapp || ""} placeholder="+91..." className="bg-bg-secondary border-border-default" />
                </div>
                <Button variant="outline" type="button" className="h-10">Test</Button>
              </div>

              {[
                { name: "notify_on_lead", title: "New lead detected", desc: "Alert when a user provides contact info.", defaultChecked: bot.bot_settings?.notify_on_lead },
                { name: "notify_on_fallback", title: "Bot couldn't answer", desc: "Alert when fallback message is triggered.", defaultChecked: bot.bot_settings?.notify_on_fallback },
                { name: "notify_on_escalation", title: "Human request", desc: "Alert when user explicitly asks for support agent.", defaultChecked: bot.bot_settings?.notify_on_escalation },
              ].map((notif, i) => (
                <div key={notif.name} className="flex items-center justify-between p-4 rounded-xl border border-border-default bg-bg-secondary max-w-2xl shadow-sm">
                  <div className="flex flex-col gap-1">
                    <h4 className="font-medium text-text-primary text-sm">{notif.title}</h4>
                    <p className="text-xs text-text-tertiary">{notif.desc}</p>
                  </div>
                  <Switch name={notif.name} defaultChecked={notif.defaultChecked !== false} />
                </div>
              ))}
              
              <Button type="submit" disabled={updateNotifications.isPending} className="w-fit mt-4">
                {updateNotifications.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Notifications
              </Button>
            </form>
          )}

          {/* DANGER TAB */}
          {activeTab === "danger" && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 max-w-2xl shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="bg-danger/10 p-2.5 rounded-full shrink-0">
                    <AlertTriangle className="h-6 w-6 text-danger" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-danger">Delete Assistant</h3>
                    <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                      This will instantly destroy all associated data sources, custom Q&A pairs, analytics history, and webhook bindings. This action cannot be undone.
                    </p>
                    
                    <div className="mt-8">
                      <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest block mb-2">Type "{bot?.name}" to confirm</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Input 
                          value={deleteConfirmName} 
                          onChange={e => setDeleteConfirmName(e.target.value)} 
                          placeholder="Type bot name..." 
                          className="max-w-[280px] bg-bg-primary border-border-default focus:border-danger" 
                        />
                        <Button 
                          variant="danger" 
                          className="h-10"
                          disabled={deleteConfirmName !== bot?.name || deleteBot.isPending}
                          onClick={handleDelete}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> {deleteBot.isPending ? "Deleting..." : "Permanently Delete"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
