import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Copy } from 'lucide-react';
import { fetchApi } from "@/lib/api";

interface Props {
  botId: string | null;
  botSlug: string | null;
  playgroundUrl: string;
  setPlaygroundUrl: (v: string) => void;
  embedCode: string;
  setEmbedCode: (v: string) => void;
}

export function StepDeploy({ botId, botSlug, playgroundUrl, setPlaygroundUrl, embedCode, setEmbedCode }: Props) {
  const router = useRouter();
  const [showEmbedCode, setShowEmbedCode] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);

  const completeRef = React.useRef(false);

  React.useEffect(() => {
    const completeOnboarding = async () => {
      if (!botId || !botSlug || completeRef.current) return;
      completeRef.current = true;
      setIsCompleting(true);
      try {
        const result = await fetchApi('/api/v1/onboarding/complete', {
          method: 'POST',
          body: JSON.stringify({ bot_id: botId })
        });
        setPlaygroundUrl(result.playground_url);
        setEmbedCode(`<script src="https://wraft.in/widget.js" data-bot-slug="${botSlug}"></script>`);
      } catch (err) {
        console.error("Failed to complete onboarding:", err);
      } finally {
        setIsCompleting(false);
      }
    };
    completeOnboarding();
  }, [botId, botSlug]);

  return (
    <div className="flex flex-col h-full flex-1 items-center">
      <div className="text-xs text-text-tertiary w-full text-left mb-6 font-medium uppercase tracking-wider">Step 7 of 7</div>
      <div className="text-5xl mb-4">🎉</div>
      <h1 className="text-xl font-semibold text-text-primary text-center mb-2">Your bot is live!</h1>
      <p className="text-sm text-text-secondary text-center mb-8">Share it with your customers</p>

      {isCompleting ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-brand animate-spin mb-4" />
          <p className="text-sm text-text-secondary">Finalizing your workspace...</p>
        </div>
      ) : (
        <div className="w-full space-y-3 mt-auto">
          <button 
            onClick={() => { window.open('https://wa.me/?text=' + encodeURIComponent("Chat with our AI assistant: " + playgroundUrl), '_blank') }} 
            className="w-full h-[52px] flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl font-medium transition-colors"
          >
            <span>📱</span> Share on WhatsApp
          </button>
          <button 
            onClick={() => setShowEmbedCode(!showEmbedCode)} 
            className="w-full h-[48px] bg-bg-tertiary hover:bg-bg-elevated border border-border-default text-text-primary rounded-xl font-medium transition-colors"
          >
            🌐 Add to your website
          </button>
          {showEmbedCode && (
            <div className="bg-bg-tertiary border border-border-default rounded-xl p-3 mt-2 relative animate-in fade-in slide-in-from-top-1">
              <button 
                onClick={() => navigator.clipboard.writeText(embedCode)} 
                className="absolute top-2 right-2 p-1.5 bg-bg-secondary border border-border-default rounded-md text-text-secondary hover:text-text-primary"
              >
                <Copy className="w-4 h-4" />
              </button>
              <pre className="font-mono text-[11px] text-text-secondary whitespace-pre-wrap pr-8">{embedCode}</pre>
            </div>
          )}
          <div 
            onClick={() => router.push('/dashboard')} 
            className="text-sm text-brand font-medium text-center cursor-pointer hover:underline mt-6 pt-4"
          >
            Go to Dashboard →
          </div>
        </div>
      )}
    </div>
  );
}
