import * as React from 'react';
import { Phone, Link as LinkIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";

interface Props {
  botId: string | null;
  waConnected: boolean;
  setWaConnected: (v: boolean) => void;
  onNext: () => void;
}

export function StepWhatsApp({ botId, waConnected, setWaConnected, onNext }: Props) {
  const [sdkLoaded, setSdkLoaded] = React.useState(false);
  const [isConnectingWa, setIsConnectingWa] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.fbAsyncInit = function() {
        window.FB.init({
          appId            : process.env.NEXT_PUBLIC_META_APP_ID || '1234567890',
          autoLogAppEvents : true,
          xfbml            : true,
          version          : 'v19.0'
        });
        setSdkLoaded(true);
      };

      if (!document.getElementById('facebook-jssdk')) {
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      } else if (window.FB) {
        setSdkLoaded(true);
      }
    }
  }, []);

  const handleLaunchEmbeddedSignup = () => {
    if (!botId) return;
    if (!window.FB) {
      setError("Facebook SDK not loaded. Check adblockers.");
      return;
    }
    setIsConnectingWa(true);
    setError(null);

    window.FB.login((response: any) => {
      if (response.authResponse) {
        const code = response.authResponse.code;
        fetchApi(`/api/v1/bots/${botId}/whatsapp/oauth`, {
          method: 'POST',
          body: JSON.stringify({ oauth_code: code })
        })
        .then(() => {
          setWaConnected(true);
          setTimeout(() => onNext(), 1500);
        })
        .catch((err) => {
          setError(err.message || "Failed to link WhatsApp");
          setIsConnectingWa(false);
        });
      } else {
        setIsConnectingWa(false);
      }
    }, {
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, featureType: '', sessionInfoVersion: '2' },
      scopes: 'whatsapp_business_management,whatsapp_business_messaging'
    });
  };

  return (
    <>
      <div className="text-xs text-text-tertiary mb-4 font-medium uppercase tracking-wider">Step 5 of 7</div>
      <div className="flex flex-col items-center text-center mt-2">
        <div className="w-16 h-16 bg-[#25D366]/10 rounded-full flex items-center justify-center mb-4">
          <Phone className="h-8 w-8 text-[#25D366]" />
        </div>
        <h1 className="text-xl font-semibold text-text-primary mb-2">Connect WhatsApp</h1>
        <p className="text-sm text-text-secondary mb-8">
          Link your Meta Business account to answer customers directly on WhatsApp. Takes 2 minutes.
        </p>
        
        {error && <div className="text-xs text-danger mb-4 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</div>}
        
        {waConnected ? (
          <div className="flex flex-col items-center gap-2 mb-8 animate-in zoom-in">
            <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center text-success"><CheckCircle2 className="w-6 h-6" /></div>
            <span className="text-success font-medium">WhatsApp Connected!</span>
          </div>
        ) : (
          <Button onClick={handleLaunchEmbeddedSignup} disabled={isConnectingWa || !sdkLoaded} className="w-full h-[52px] bg-[#1877F2] hover:bg-[#0c5cce] text-white rounded-xl font-medium border-none mb-4">
            {isConnectingWa ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LinkIcon className="w-4 h-4 mr-2" />}
            {sdkLoaded ? "Login with Facebook" : "Loading..."}
          </Button>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        {!waConnected && (
          <div onClick={onNext} className="text-xs text-text-tertiary text-center cursor-pointer hover:text-text-primary transition-colors">
            Skip — Do it later →
          </div>
        )}
      </div>
    </>
  );
}
