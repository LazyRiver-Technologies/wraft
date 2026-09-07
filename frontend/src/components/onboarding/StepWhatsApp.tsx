import * as React from 'react';
import { Phone, Sparkles, CheckCircle2, MessageSquare, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface Props {
  botId: string | null;
  waConnected: boolean;
  setWaConnected: (v: boolean) => void;
  onNext: () => void;
}

export function StepWhatsApp({ botId, waConnected, setWaConnected, onNext }: Props) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-text-tertiary font-medium uppercase tracking-wider">Step 5 of 7</span>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20">
          <Sparkles className="w-3 h-3" /> Coming Soon
        </span>
      </div>

      <div className="flex flex-col items-center text-center mt-2 flex-1">
        <div className="w-16 h-16 bg-[#25D366]/10 rounded-2xl flex items-center justify-center mb-4 border border-[#25D366]/20 shadow-sm relative">
          <Phone className="h-8 w-8 text-[#25D366]" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-white text-[10px] font-bold">
            ✓
          </div>
        </div>

        <h1 className="text-xl font-semibold text-text-primary mb-2">WhatsApp Business AI</h1>
        <p className="text-sm text-text-secondary mb-6 max-w-sm">
          Soon you can deploy this exact assistant directly to your official WhatsApp Business number with 1-click automated setup.
        </p>

        {/* Feature Highlights */}
        <div className="w-full bg-bg-tertiary/60 border border-border-default rounded-xl p-4 text-left flex flex-col gap-3 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0 mt-0.5">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">Direct Cloud Deployment</div>
              <div className="text-[11px] text-text-secondary">Zero-code connection with Meta WhatsApp Cloud API</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">Instant Customer Replies</div>
              <div className="text-[11px] text-text-secondary">Answers FAQs, quotes & timings from your ingested knowledge</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-warning/10 text-warning flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">Human Agent Handover</div>
              <div className="text-[11px] text-text-secondary">Automatic owner notifications when urgent escalations occur</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-4 flex flex-col gap-3">
        <Button 
          onClick={onNext}
          className="w-full h-[52px] bg-brand hover:bg-brand-hover text-white rounded-xl font-medium border-none flex items-center justify-center gap-2"
        >
          <span>Continue to Test Bot</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </>
  );
}
