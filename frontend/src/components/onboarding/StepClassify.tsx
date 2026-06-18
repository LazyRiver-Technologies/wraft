import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { ClassifyResult } from "@/types/onboarding";

interface Props {
  businessDescription: string;
  setBusinessDescription: (v: string) => void;
  setClassifyResult: (v: ClassifyResult) => void;
  onNext: () => void;
}

export function StepClassify({ businessDescription, setBusinessDescription, setClassifyResult, onNext }: Props) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showChips, setShowChips] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowChips(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleClassify = async () => {
    if (businessDescription.length < 2) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchApi('/api/v1/onboarding/classify', {
        method: "POST",
        body: JSON.stringify({ description: businessDescription })
      });
      setClassifyResult(result);
      onNext();
    } catch (err: any) {
      setError(err.message || "Failed to analyze business.");
    } finally {
      setIsLoading(false);
    }
  };

  const chips = ["dental clinic", "coaching institute", "restaurant", "kirana shop", "real estate"];

  return (
    <>
      <div className="text-xs text-text-tertiary mb-6 font-medium uppercase tracking-wider">
        Step 1 of 7 — Let's set up your AI assistant
      </div>
      <h1 className="text-xl font-semibold text-text-primary mb-2">What kind of business do you run?</h1>
      <p className="text-sm text-text-secondary mb-6">Describe it in a few words — we'll handle the rest</p>
      
      <input
        value={businessDescription}
        onChange={e => setBusinessDescription(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && businessDescription.length >= 2) handleClassify() }}
        placeholder="e.g. dental clinic, mobile repair shop..."
        className="w-full text-[16px] px-4 py-3 bg-bg-tertiary border border-border-default rounded-[10px] text-text-primary outline-none focus:border-brand transition-colors"
      />
      
      {showChips && (
        <div className="flex flex-wrap gap-2 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {chips.map(chip => (
            <div 
              key={chip} 
              onClick={() => setBusinessDescription(chip)} 
              className="bg-bg-tertiary border border-border-default text-text-secondary text-xs rounded-full px-3 py-1.5 cursor-pointer hover:border-brand hover:text-brand transition-colors"
            >
              {chip}
            </div>
          ))}
        </div>
      )}
      
      {error && <div className="text-xs text-danger mt-4">{error}</div>}
      
      <div className="mt-auto pt-6">
        <Button onClick={handleClassify} disabled={businessDescription.length < 2 || isLoading} className="w-full h-[52px] bg-brand hover:bg-brand-hover text-white rounded-xl font-medium border-none">
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : "Continue"}
        </Button>
      </div>
    </>
  );
}
