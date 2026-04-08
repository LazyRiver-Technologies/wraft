"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { CheckCircle } from 'lucide-react'

export default function WhatsAppPage() {
  const { botId } = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: bot, isLoading } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => fetchApi(`/api/v1/bots/${botId}`)
  })

  const [form, setForm] = useState({
    phone_number_id: '',
    waba_id: '',
    access_token_enc: ''
  })

  useEffect(() => {
    if (bot?.whatsapp_configs?.length > 0) {
      const config = bot.whatsapp_configs[0]
      setForm({
        phone_number_id: config.phone_number_id || '',
        waba_id: config.waba_id || '',
        access_token_enc: config.access_token_enc ? '••••••••••••••••' : '' 
      })
    }
  }, [bot])

  const { mutate, isPending } = useMutation({
    mutationFn: (patch: Record<string, unknown>) => fetchApi(`/api/v1/bots/${botId}/whatsapp`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot', botId] })
      toast({ title: "Success", description: "WhatsApp constraints mapped natively." })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  })

  const domain = typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'
  const webhookUrl = `${domain}/api/v1/webhook/whatsapp/${bot?.slug || '{bot_slug}'}`
  const verifyToken = bot?.whatsapp_configs?.[0]?.verify_token || 'loading...'
  
  const isConnected = bot?.whatsapp_configs?.[0]?.is_connected

  if (isLoading) return <p>Loading...</p>

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            WhatsApp Integration 
          </h1>
          <p className="text-slate-500 mt-1">Connect your bot directly to Meta Cloud API limits natively.</p>
        </div>
        {isConnected && <div className="flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-medium"><CheckCircle className="h-4 w-4" /> Connected</div>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Webhook Configuration</CardTitle>
          <CardDescription>Paste this webhook URL and verify token inside your Meta App Dashboard settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Callback URL</label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="bg-slate-50 font-mono text-sm" />
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({title:"Copied!"})}}>Copy</Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Verify Token</label>
            <div className="flex gap-2">
              <Input readOnly value={verifyToken} className="bg-slate-50 font-mono text-sm" />
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(verifyToken); toast({title:"Copied!"})}}>Copy</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Meta API Credentials</CardTitle>
          <CardDescription>Enter the connection mapping coordinates generated natively in your App Settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
             <label className="text-sm font-medium">Phone Number ID</label>
             <Input value={form.phone_number_id} onChange={e => setForm({...form, phone_number_id: e.target.value})} placeholder="123456789012345" />
          </div>
          
          <div className="space-y-2">
             <label className="text-sm font-medium">WhatsApp Business Account ID (WABA ID)</label>
             <Input value={form.waba_id} onChange={e => setForm({...form, waba_id: e.target.value})} placeholder="109876543210987" />
          </div>

          <div className="space-y-2">
             <label className="text-sm font-medium">Access Token</label>
             <Input type="password" value={form.access_token_enc} onChange={e => setForm({...form, access_token_enc: e.target.value})} placeholder="EAAH..." />
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4">
          <Button onClick={() => mutate(form)} disabled={isPending}>
            {isPending ? "Connecting..." : "Save Configuration"}
          </Button>
        </CardFooter>
      </Card>
      
    </div>
  )
}
