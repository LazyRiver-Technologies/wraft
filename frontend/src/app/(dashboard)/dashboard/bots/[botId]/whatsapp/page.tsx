"use client"

import * as React from "react"
import { CheckCircle2, Phone, Link as LinkIcon, Loader2, AlertCircle } from "lucide-react"

import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { useBot } from "@/hooks/api/useBots"
import { useConnectWhatsAppOauth, useDisconnectWhatsApp } from "@/hooks/api/useWhatsApp"
import { useToast } from "@/hooks/use-toast"
import { FeatureGate } from "@/components/ui/FeatureGate"
import { useProfileWithPlan } from "@/hooks/api/useBilling"
import { createClient } from "@/utils/supabase/client"
import { Copy } from "lucide-react"
import { fetchApi } from "@/lib/api"

// Declare FB globally
declare global {
  interface Window {
    FB: any;
    fbAsyncInit: any;
  }
}

export default function BotWhatsAppPage(props: { params: any }) {
  const params = React.use(props.params as Promise<{ botId: string }>)
  const { toast } = useToast()
  const { data: bot, isLoading: botLoading } = useBot(params.botId)
  const { data: profile, isLoading: profileLoading } = useProfileWithPlan()
  
  const hasWaNotifications = profile?.plans?.wa_notifications === true
  
  const { mutate: connectOauth, isPending: isConnecting } = useConnectWhatsAppOauth()
  const { mutate: disconnectToken, isPending: isDisconnecting } = useDisconnectWhatsApp()

  const [sdkLoaded, setSdkLoaded] = React.useState(false)
  const [isGeneratingLink, setIsGeneratingLink] = React.useState(false)

  // Initialize Facebook SDK
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.fbAsyncInit = function() {
        const appId = process.env.NEXT_PUBLIC_META_APP_ID;
        if (!appId || appId === 'YOUR_META_APP_ID_HERE') {
          console.error("Missing NEXT_PUBLIC_META_APP_ID environment variable. Facebook SDK will fail.");
        }
        window.FB.init({
          appId            : appId || '', 
          autoLogAppEvents : true,
          xfbml            : true,
          version          : 'v19.0' // Use current Meta API version
        });
        setSdkLoaded(true)
      };

      if (!document.getElementById('facebook-jssdk')) {
        const script = document.createElement('script')
        script.id = 'facebook-jssdk'
        script.src = "https://connect.facebook.net/en_US/sdk.js"
        script.async = true
        script.defer = true
        document.body.appendChild(script)
      } else if (window.FB) {
        setSdkLoaded(true)
      }
    }
  }, [])

  // Dynamic State derived from bot
  const whatsappConfig = Array.isArray(bot?.whatsapp_configs) && bot!.whatsapp_configs.length > 0 ? bot!.whatsapp_configs[0] : null
  const isConnected = whatsappConfig?.is_connected === true

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }

  const handleLaunchEmbeddedSignup = () => {
    if (!window.FB) {
      toast({ title: "Error", description: "Facebook SDK not loaded. Check adblockers.", variant: "destructive" })
      return
    }

    // Launch FB Login with specific config for WhatsApp Tech Providers
    window.FB.login((response: any) => {
      if (response.authResponse) {
        const code = response.authResponse.code;
        // Exchange code in our backend
        connectOauth({ botId: params.botId, data: { oauth_code: code } }, {
          onSuccess: () => toast({ title: "Success", description: "WhatsApp successfully connected!" }),
          onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
        })
      } else {
        toast({ title: "Cancelled", description: "WhatsApp connection was cancelled." })
      }
    }, {
      config_id: 'OPTIONAL_CONFIG_ID_FROM_META', // Not strictly required for basic embedded signup if scopes are used, but recommended.
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
        featureType: '',
        sessionInfoVersion: '2',
      },
      scopes: 'whatsapp_business_management,whatsapp_business_messaging'
    })
  }

  const handleGenerateMagicLink = async () => {
    setIsGeneratingLink(true)
    try {
      const data = await fetchApi(`/api/v1/setup/generate?bot_id=${params.botId}`)
      const link = `${window.location.origin}/setup/${data.token}`
      await navigator.clipboard.writeText(link)
      toast({ title: "Link Copied!", description: "Send this secure link to your client.", variant: "default" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const handleDisconnect = () => {
    disconnectToken({ botId: params.botId }, {
      onSuccess: () => {
        toast({ title: "Disconnected", description: "WhatsApp integration removed." })
      }
    })
  }

  const isMissingAppId = !process.env.NEXT_PUBLIC_META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID === 'YOUR_META_APP_ID_HERE';
  const showMissingAppIdWarning = !isConnected && isMissingAppId;

  if (botLoading || profileLoading) {
    return <div className="animate-pulse h-64 bg-bg-secondary w-full rounded-xl" />;
  }

  if (isConnected) {
    return (
      <>
        <PageHeader 
          title="WhatsApp Integration" 
          description="Your bot is connected to WhatsApp."
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
              {whatsappConfig?.connected_at && (
                <p className="text-text-tertiary text-xs mt-1">Connected {formatRelativeTime(whatsappConfig.connected_at)}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <Button 
               variant="danger" 
               size="sm" 
               onClick={handleDisconnect}
               disabled={isDisconnecting}
               className="h-8 text-xs bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 hover:text-danger"
            >
              Disconnect
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
        description="Connect your bot to WhatsApp in 2 clicks using Meta Embedded Signup."
      />
      <FeatureGate hasAccess={hasWaNotifications} requiredPlan="Starter">

      <div className="max-w-2xl relative">
        <div className="flex-1 rounded-xl border border-border-default bg-bg-secondary p-8 shadow-brand-glow border-brand/30 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-[#25D366]/10 rounded-full flex items-center justify-center mb-6">
            <Phone className="h-8 w-8 text-[#25D366]" />
          </div>
          
          <h3 className="font-semibold text-text-primary text-xl mb-3">Connect WhatsApp Business</h3>
          <p className="text-sm text-text-secondary mb-8 max-w-md">
            Click the button below to link your WhatsApp number. You don't need any developer tokens. 
            We will set up everything for you automatically.
          </p>

          {showMissingAppIdWarning && (
             <div className="mb-6 p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-center gap-2 text-warning text-sm">
                <AlertCircle className="w-4 h-4" />
                You need to set NEXT_PUBLIC_META_APP_ID in .env first.
             </div>
          )}

          <Button 
            onClick={handleLaunchEmbeddedSignup} 
            disabled={isConnecting || !sdkLoaded} 
            className="w-full max-w-sm h-12 shadow-brand-glow bg-[#1877F2] hover:bg-[#0c5cce] text-white"
          >
            {isConnecting || !sdkLoaded ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />} 
            {sdkLoaded ? "Login with Facebook" : "Loading Meta SDK..."}
          </Button>
          
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-text-tertiary">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
            Meta Verified Tech Provider Flow
          </div>
        </div>

        {/* --- Magic Link Section (For Agencies/DFY) --- */}
        <div className="flex-1 rounded-xl border border-border-default bg-bg-secondary p-8 shadow-sm flex flex-col items-center mt-6">
          <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mb-4">
            <LinkIcon className="h-6 w-6 text-brand" />
          </div>
          
          <h3 className="font-semibold text-text-primary text-lg mb-2">Concierge Setup Link</h3>
          <p className="text-sm text-text-secondary mb-6 max-w-md text-center">
            Doing it for a client? Generate a secure 1-click magic link. Send it to the client so they can authorize WhatsApp without logging into your dashboard.
          </p>

          <Button 
            variant="secondary"
            onClick={handleGenerateMagicLink} 
            disabled={isGeneratingLink} 
            className="w-full max-w-sm h-11 border border-border-default hover:border-brand transition-colors"
          >
            {isGeneratingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />} 
            Copy Setup Link to Clipboard
          </Button>
          <div className="mt-4 text-xs text-text-tertiary">
            Link expires in 7 days
          </div>
        </div>

      </div>
      </FeatureGate>
    </>
  )
}
