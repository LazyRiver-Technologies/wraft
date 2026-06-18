import * as React from 'react';
import { fetchApi } from "@/lib/api";
import { ClassifyResult } from "@/types/onboarding";

interface Props {
  classifyResult: ClassifyResult | null;
  ownerName: string;
  phone: string;
  setBotId: (v: string) => void;
  setBotSlug: (v: string) => void;
  onNext: () => void;
}

export function StepLoading({ classifyResult, ownerName, phone, setBotId, setBotSlug, onNext }: Props) {
  const [animStep, setAnimStep] = React.useState(0);
  const [apiDone, setApiDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setupRef = React.useRef(false);

  React.useEffect(() => {
    if (error) return;
    const intervalId = setInterval(() => {
      setAnimStep(prev => prev + 1);
    }, 700);
    return () => clearInterval(intervalId);
  }, [error]);

  React.useEffect(() => {
    if (setupRef.current) return;
    setupRef.current = true;

    const doSetup = async () => {
      try {
        const result = await fetchApi('/api/v1/onboarding/setup', {
          method: 'POST',
          body: JSON.stringify({
            business_type: classifyResult?.business_type,
            business_name: ownerName + "'s " + classifyResult?.display_name,
            display_name: classifyResult?.display_name,
            theme_color: classifyResult?.theme_color,
            owner_name: ownerName,
            phone: "+91" + phone,
            suggested_questions: classifyResult?.suggested_questions
          })
        });
        setBotId(result.bot_id);
        setBotSlug(result.bot_slug);
        setApiDone(true);
      } catch (err: any) {
        setError(err.message || "Failed to setup workspace.");
      }
    };
    
    doSetup();
  }, []);

  React.useEffect(() => {
    if (animStep >= 4 && apiDone) {
      setTimeout(() => {
        onNext();
      }, 500);
    }
  }, [animStep, apiDone]);

  const steps = [
    "Creating your AI assistant...",
    "Setting up language support...",
    `Loading templates for ${classifyResult?.display_name || 'your business'}...`,
    "Your workspace is ready! 🎉"
  ];

  return (
    <div className="w-full max-w-md flex flex-col items-center justify-center text-center p-6 relative z-10 animate-[slideUp_0.25s_ease_forwards]">
      {error ? (
        <div className="bg-danger-muted text-danger p-6 rounded-xl mb-6 w-full text-left border border-danger/20 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-danger/20 flex items-center justify-center text-danger font-bold text-xl">!</div>
            <h3 className="font-semibold text-lg">Setup Failed</h3>
          </div>
          <p className="text-[15px] mb-4 opacity-90">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full py-2.5 bg-danger text-white rounded-lg font-medium hover:bg-danger/90 transition-colors"
          >
            Refresh and Try Again
          </button>
        </div>
      ) : (
        <>
          <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border-default flex items-center justify-center shadow-lg animate-pulse mb-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-brand/10"></div>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6L8 18L12 10L16 18L20 6" stroke="currentColor" className="text-brand" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
          </div>
          <div className="w-full text-left bg-bg-secondary/60 backdrop-blur-md p-6 rounded-2xl border border-border-default/50">
            {steps.map((step, i) => (
              i <= animStep && (
                <div key={i} className={`flex items-center gap-3 mb-4 last:mb-0 animate-[fadeIn_0.4s_ease_forwards] ${i === animStep && !apiDone && animStep < 4 ? 'text-text-primary' : 'text-text-secondary'}`}>
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-success/10 flex items-center justify-center">
                     <span className="text-success text-[14px] font-bold">✓</span>
                  </div>
                  <span className="text-[15px] font-medium">{step}</span>
                </div>
              )
            ))}
          </div>
        </>
      )}
    </div>
  );
}
