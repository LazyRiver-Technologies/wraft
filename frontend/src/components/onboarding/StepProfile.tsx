import * as React from 'react';
import { Button } from "@/components/ui/button";

interface Props {
  ownerName: string;
  setOwnerName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepProfile({ ownerName, setOwnerName, phone, setPhone, onNext, onBack }: Props) {
  return (
    <>
      <div onClick={onBack} className="absolute top-6 left-6 text-xs text-text-tertiary cursor-pointer hover:text-text-primary transition-colors">← Back</div>
      <div className="mt-8 text-xs text-text-tertiary mb-4 font-medium uppercase tracking-wider">Step 2 of 7</div>
      <h1 className="text-xl font-semibold text-text-primary mb-2">Tell us about yourself</h1>
      <p className="text-sm text-text-secondary mb-6">We'll personalize your assistant</p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Your name</label>
          <input 
            autoFocus 
            value={ownerName} 
            onChange={e => setOwnerName(e.target.value)} 
            placeholder="Enter your name" 
            className="w-full text-[16px] px-4 py-3 bg-bg-tertiary border border-border-default rounded-[10px] text-text-primary outline-none focus:border-brand transition-colors" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">WhatsApp number</label>
          <div className="flex">
            <div className="bg-bg-tertiary border border-border-default border-r-0 rounded-l-xl px-3 h-[52px] text-text-secondary flex items-center justify-center min-w-[50px] font-medium text-[16px]">
              +91
            </div>
            <input 
              type="tel" 
              value={phone} 
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
              placeholder="98765 43210" 
              className="flex-1 text-[16px] px-4 py-3 bg-bg-tertiary border border-border-default border-l-0 rounded-r-xl text-text-primary outline-none h-[52px] focus:border-brand focus:border-l" 
            />
          </div>
        </div>
      </div>
      
      <div className="mt-auto pt-8">
        <Button onClick={onNext} disabled={ownerName.length < 2 || phone.length < 10} className="w-full h-[52px] bg-brand hover:bg-brand-hover text-white rounded-xl font-medium border-none">
          Continue
        </Button>
      </div>
    </>
  );
}
