"use client"

import * as React from "react"
import { Phone, Link as LinkIcon, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { fetchApi } from "@/lib/api"

// Declare FB globally
declare global {
  interface Window {
    FB: any;
    fbAsyncInit: any;
  }
}

export default function MagicSetupPage(props: { params: any }) {
  const params = React.use(props.params as Promise<{ token: string }>)
  const [loadingInfo, setLoadingInfo] = React.useState(true)
  const [botInfo, setBotInfo] = React.useState<{ bot_name: string, provider_name: string } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  
  const [sdkLoaded, setSdkLoaded] = React.useState(false)
  const [isConnecting, setIsConnecting] = React.useState(false)
  const [success, setSuccess] = React.useState(false)

  // 1. Verify Token
  React.useEffect(() => {
    const fetchInfo = async () => {
      try {
        const data = await fetchApi(`/api/v1/setup/verify?token=${params.token}`)
        setBotInfo(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoadingInfo(false)
      }
    }
    fetchInfo()
  }, [params.token])

  // 2. Load FB SDK
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
        });setSdkLoaded(true)
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

  const handleLaunchEmbeddedSignup = () => {
    if (!window.FB) {
      setError("Facebook SDK not loaded. Check adblockers.")
      return
    }
    setIsConnecting(true)
    setError(null)

    window.FB.login(async (response: any) => {
      if (response.authResponse) {
        const code = response.authResponse.code;
        try {
          await fetchApi(`/api/v1/setup/${params.token}/whatsapp/oauth`, {
            method: "POST",
            body: JSON.stringify({ oauth_code: code })
          })
          setSuccess(true)
        } catch (err: any) {
          setError(err.message)
          setIsConnecting(false)
        }
      } else {
        setError("WhatsApp connection was cancelled.")
        setIsConnecting(false)
      }
    }, {
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, featureType: '', sessionInfoVersion: '2' },
      scopes: 'whatsapp_business_management,whatsapp_business_messaging'
    })
  }

  // Render Background
  const renderBackground = () => (
    <div className="fixed inset-0 z-0 bg-[url('/dashboard-preview.png')] bg-cover blur-[8px] brightness-[0.3] scale-105" />
  )

  if (loadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-primary">
         <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    )
  }

  if (error && !botInfo) {
    return (
      <>
        {renderBackground()}
        <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-bg-secondary border border-border-default rounded-2xl p-8 text-center shadow-2xl">
             <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8" />
             </div>
             <h1 className="text-xl font-semibold text-text-primary mb-2">Link Expired</h1>
             <p className="text-sm text-text-secondary">{error}</p>
          </div>
        </div>
      </>
    )
  }

  if (success) {
    return (
      <>
        {renderBackground()}
        <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-bg-secondary border border-success/30 rounded-2xl p-8 text-center shadow-2xl animate-in zoom-in-95 duration-500">
             <div className="w-20 h-20 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
             </div>
             <h1 className="text-2xl font-semibold text-text-primary mb-3">All Set!</h1>
             <p className="text-[15px] text-text-secondary leading-relaxed">
               Your WhatsApp Business account is successfully connected to <b>{botInfo?.bot_name}</b>.
               <br/><br/>
               You can safely close this window. {botInfo?.provider_name} will take it from here!
             </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {renderBackground()}
      <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-bg-secondary border border-border-default rounded-2xl p-8 text-center shadow-2xl animate-[slideUp_0.3s_ease_out_forwards]">
          
          <div className="text-xs text-text-tertiary mb-6 font-medium uppercase tracking-wider">
            Secure Setup Portal
          </div>
          
          <div className="w-20 h-20 bg-[#25D366]/10 border border-[#25D366]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Phone className="h-10 w-10 text-[#25D366]" />
          </div>
          
          <h1 className="text-xl font-semibold text-text-primary mb-3">
            Connect WhatsApp
          </h1>
          <p className="text-[15px] text-text-secondary mb-8 leading-relaxed px-2">
            <b>{botInfo?.provider_name}</b> has prepared your AI Assistant, <b>{botInfo?.bot_name}</b>.
            <br/><br/>
            Click the button below to link your WhatsApp Business number. Takes just 2 minutes.
          </p>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2 text-left">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button 
            onClick={handleLaunchEmbeddedSignup} 
            disabled={isConnecting || !sdkLoaded} 
            className="w-full h-14 bg-[#1877F2] hover:bg-[#0c5cce] disabled:bg-[#1877F2]/50 disabled:cursor-not-allowed text-white rounded-xl font-medium text-[16px] shadow-lg shadow-[#1877F2]/20 flex items-center justify-center transition-all"
          >
            {isConnecting || !sdkLoaded ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {sdkLoaded ? "Connecting..." : "Loading Meta SDK..."}</>
            ) : (
              <><LinkIcon className="mr-2 h-5 w-5" /> Login with Facebook</>
            )}
          </button>
          
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-text-tertiary font-medium">
            <CheckCircle2 className="w-4 h-4 text-success" />
            Meta Verified Secure Login
          </div>
          
        </div>
      </div>
    </>
  )
}
