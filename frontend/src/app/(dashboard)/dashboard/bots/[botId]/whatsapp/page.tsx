"use client"

import * as React from "react"
import { Copy, CheckCircle2, Phone, Key, Link as LinkIcon, Eye, EyeOff } from "lucide-react"

import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBot } from "@/hooks/api/useBots"
import { useSaveWhatsAppToken, useDisconnectWhatsApp } from "@/hooks/api/useWhatsApp"
import { useToast } from "@/hooks/use-toast"
import { useUsage } from "@/hooks/api/useUsage"
import { FeatureGate } from "@/components/ui/FeatureGate"

export default function BotWhatsAppPage(props: { params: any }) {
  const params = React.use(props.params as Promise<{ botId: string }>)
  const { toast } = useToast()
  const [showToken, setShowToken] = React.useState(false)
  const { data: bot, isLoading: botLoading } = useBot(params.botId)
  const { data: usage, isLoading: usageLoading } = useUsage()
  
  const isTrial = usage?.plan_name === "trial"
  
  const [phoneNumberId, setPhoneNumberId] = React.useState("")
  const [wabaId, setWabaId] = React.useState("")
  const [accessToken, setAccessToken] = React.useState("")

  const { mutate: saveToken, isPending: isSaving } = useSaveWhatsAppToken()
  const { mutate: disconnectToken, isPending: isDisconnecting } = useDisconnectWhatsApp()

  // Dynamic State derived from bot
  const whatsappConfig = Array.isArray(bot?.whatsapp_configs) && bot!.whatsapp_configs.length > 0 ? bot!.whatsapp_configs[0] : null
  const isConnected = !!whatsappConfig
  const activeStep: number = isConnected ? 4 : (phoneNumberId && wabaId ? 3 : 2)

  const handleConnect = () => {
    if (!phoneNumberId || !wabaId || !accessToken) {
      toast({ title: "Error", description: "Please fill in all Meta credentials.", variant: "destructive" })
      return
    }
    saveToken({ 
      botId: params.botId, 
      data: { phone_number_id: phoneNumberId, waba_id: wabaId, access_token: accessToken } 
    }, {
      onSuccess: () => toast({ title: "Success", description: "WhatsApp successfully connected!" }),
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    })
  }

  const handleDisconnect = () => {
    disconnectToken({ botId: params.botId }, {
      onSuccess: () => {
        toast({ title: "Disconnected", description: "WhatsApp integration removed." })
        setPhoneNumberId("")
        setWabaId("")
        setAccessToken("")
      }
    })
  }

  if (botLoading || usageLoading) return <div className="animate-pulse h-64 bg-bg-secondary w-full rounded-xl" />

  if (isConnected) {
    return (
      <>
        <PageHeader 
          title="WhatsApp Integration" 
          description="Connect your bot to WhatsApp via the Meta Cloud API."
        />
        <div className="rounded-xl border border-success/30 bg-success/5 p-6 max-w-3xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center text-success">
              <Phone className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                WhatsApp Connected <CheckCircle2 className="h-4 w-4 text-success" />
              </h3>
              <p className="text-text-secondary text-sm mt-1">Bound Phone ID: <span className="font-mono text-text-primary">{whatsappConfig?.phone_number_id || "N/A"}</span></p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <span className="text-xs text-text-tertiary">Verified Token: {whatsappConfig?.verify_token || "N/A"}</span>
            <Button 
               variant="danger" 
               size="sm" 
               onClick={handleDisconnect}
               disabled={isDisconnecting}
               className="h-8 text-xs bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 hover:text-danger"
            >
              Disconnect integration
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader 
        title="WhatsApp Integration" 
        description="Connect your bot to WhatsApp via the Meta Cloud API."
      />
      <FeatureGate hasAccess={!isTrial} requiredPlan="Starter">

      <div className="max-w-3xl relative">
        {/* Continuous Line */}
        <div className="absolute left-6 top-8 bottom-8 w-px bg-border-default z-0" />

        {/* STEP 1 */}
        <div className="relative z-10 flex gap-6 mb-12">
          <div className="flex flex-col items-center mt-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 bg-bg-primary
              ${activeStep > 1 ? 'border-success text-success' : 'border-brand text-brand'}
            `}>
              {activeStep > 1 ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-sm font-bold">1</span>}
            </div>
          </div>
          
          <div className="flex-1 rounded-xl border border-border-default bg-bg-secondary p-6">
            <h3 className="font-semibold text-text-primary text-lg mb-2 flex items-center justify-between">
              Webhook Configuration
              {activeStep > 1 && <span className="text-xs font-medium text-success flex items-center gap-1 bg-success/10 px-2 py-1 rounded-full"><CheckCircle2 className="h-3 w-3" /> Verified</span>}
            </h3>
            <p className="text-sm text-text-secondary mb-6">
              Configure these endpoints in your Meta App Dashboard under the WhatsApp Webhook section. Make sure to subscribe to the <code className="bg-bg-tertiary px-1 rounded text-text-primary">messages</code> field.
            </p>

            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Callback URL</label>
                <div className="flex gap-2">
                  <Input defaultValue={`https://api.lazyriver.com/v1/webhook/whatsapp/${bot?.slug || params.botId}`} readOnly className="font-mono text-sm bg-bg-tertiary text-text-primary" />
                  <Button variant="secondary" size="icon" className="shrink-0"><Copy className="h-4 w-4 text-text-secondary" /></Button>
                </div>
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Verify Token</label>
                <div className="flex gap-2">
                  <Input defaultValue="lr_ws_verified_token_v1" readOnly className="font-mono text-sm bg-bg-tertiary text-text-primary" />
                  <Button variant="secondary" size="icon" className="shrink-0"><Copy className="h-4 w-4 text-text-secondary" /></Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2 */}
        <div className={`relative z-10 flex gap-6 mb-12 transition-opacity ${activeStep >= 2 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="flex flex-col items-center mt-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 bg-bg-primary
              ${activeStep > 2 ? 'border-success text-success' : (activeStep === 2 ? 'border-brand text-brand' : 'border-border-default text-text-tertiary')}
            `}>
              {activeStep > 2 ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-sm font-bold">2</span>}
            </div>
          </div>
          
          <div className="flex-1 rounded-xl border border-border-default bg-bg-secondary p-6">
            <h3 className="font-semibold text-text-primary text-lg mb-2">Meta Credentials</h3>
            <p className="text-sm text-text-secondary mb-6">Enter your WhatsApp Business API identity markers.</p>

            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Phone Number ID</label>
                <Input 
                   value={phoneNumberId}
                   onChange={e => setPhoneNumberId(e.target.value)}
                   placeholder="e.g. 102938475612345" 
                   className="font-mono" 
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">WhatsApp Business Account ID (WABA)</label>
                <Input 
                   value={wabaId}
                   onChange={e => setWabaId(e.target.value)}
                   placeholder="e.g. 192837465543210" 
                   className="font-mono" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* STEP 3 */}
        <div className={`relative z-10 flex gap-6 mb-12 transition-opacity ${activeStep >= 3 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="flex flex-col items-center mt-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 bg-bg-primary
              ${activeStep === 3 ? 'border-brand text-brand' : 'border-border-default text-text-tertiary'}
            `}>
              <span className="text-sm font-bold">3</span>
            </div>
          </div>
          
          <div className="flex-1 rounded-xl border border-border-default bg-bg-secondary p-6 shadow-brand-glow border-brand/30">
            <h3 className="font-semibold text-text-primary text-lg mb-2">Access Token</h3>
            <p className="text-sm text-text-secondary mb-6">Provide your Permanent Access Token for sending messages.</p>

            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">System User Token</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                  <Input 
                    type={showToken ? "text" : "password"} 
                    value={accessToken}
                    onChange={e => setAccessToken(e.target.value)}
                    placeholder="EAABwzLix..." 
                    className="pl-9 pr-10 font-mono" 
                  />
                  <button 
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <Button onClick={handleConnect} disabled={isSaving} className="mt-6 w-full h-11 shadow-brand-glow">
              <LinkIcon className="mr-2 h-4 w-4" /> {isSaving ? "Connecting..." : "Finalize Connection"}
            </Button>
          </div>
        </div>

      </div>
      </FeatureGate>
    </>
  )
}
