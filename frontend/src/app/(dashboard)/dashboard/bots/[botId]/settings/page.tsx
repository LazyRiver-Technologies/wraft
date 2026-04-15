"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

export default function SettingsPage() {
  const { botId } = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Ideally fetch bot then pre-populate state
  const { data: bot, isLoading } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => fetchApi(`/api/v1/bots/${botId}`)
  })
  
  const [formData, setFormData] = useState({
    system_prompt: '',
    model: 'gemini-2.5-flash-lite',
    temperature: 0.7,
    max_chunks: 5,
    search_mode: 'hybrid',
    fallback_message: ''
  })

  useEffect(() => {
    if (bot && bot.bot_settings) {
      setFormData({
        system_prompt: bot.bot_settings.system_prompt || '',
        model: bot.bot_settings.model || 'gemini-2.5-flash-lite',
        temperature: bot.bot_settings.temperature || 0.7,
        max_chunks: bot.bot_settings.max_chunks || 5,
        search_mode: bot.bot_settings.search_mode || 'hybrid',
        fallback_message: bot.bot_settings.fallback_message || ''
      })
    }
  }, [bot])

  const { mutate, isPending } = useMutation({
    mutationFn: (patch: Record<string, unknown>) => fetchApi(`/api/v1/bots/${botId}/settings`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot', botId] })
      toast({ title: "Success", description: "Settings saved successfully." })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  })

  if (isLoading) return <p>Loading...</p>

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bot Settings</h1>
        <p className="text-slate-500">Configure AI logic and context mapping boundaries.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Behavior</CardTitle>
          <CardDescription>Tailor exactly how your GenAI interacts with users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">System Prompt</label>
              <span className="text-xs text-slate-500">{formData.system_prompt.length} chars</span>
            </div>
            <Textarea 
              rows={8} 
              value={formData.system_prompt} 
              onChange={e => setFormData({...formData, system_prompt: e.target.value})} 
              placeholder="You are a helpful customer support agent..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <Select value={formData.model} onValueChange={v => setFormData({...formData, model: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash-lite">
                    <div>
                      <div className="font-medium">Gemini 2.5 Flash Lite (Recommended)</div>
                      <div className="text-xs text-slate-500">Best for Hindi, Kannada, English and Hinglish</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="llama-3.1-8b-instant">
                    <div>
                      <div className="font-medium">Llama 3.1 8B via Groq (Faster)</div>
                      <div className="text-xs text-slate-500">Good for English only</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Temperature</label>
                <span className="text-xs text-slate-500">{formData.temperature}</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.1" 
                value={formData.temperature} 
                onChange={e => setFormData({...formData, temperature: parseFloat(e.target.value)})}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
               <label className="text-sm font-medium">Max Context Chunks</label>
               <Input type="number" min="1" max="20" value={formData.max_chunks} onChange={e => setFormData({...formData, max_chunks: parseInt(e.target.value)})} />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Mode</label>
              <Select value={formData.search_mode} onValueChange={v => setFormData({...formData, search_mode: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hybrid">Hybrid (Keyword + Vector)</SelectItem>
                  <SelectItem value="vector">Vector Only</SelectItem>
                  <SelectItem value="keyword">Keyword Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Fallback Message</label>
            <Input 
              value={formData.fallback_message} 
              onChange={e => setFormData({...formData, fallback_message: e.target.value})} 
              placeholder="I couldn't find an answer in my knowledge base."
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4">
          <Button onClick={() => mutate(formData)} disabled={isPending}>
            {isPending ? "Saving..." : "Save Settings"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
