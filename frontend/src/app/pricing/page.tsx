"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check, X, ArrowLeft } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { useStore } from "@/lib/store"

export default function PricingPage() {
  const [isYearly, setIsYearly] = React.useState(false)
  const user = useStore((state) => state.user)

  const getCheckoutLink = (plan: string) => {
    return user ? `/checkout?plan=${plan}&yearly=${isYearly}` : `/signup?plan=${plan}&yearly=${isYearly}`
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-text-tertiary hover:text-text-primary mb-10 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to home
        </Link>
        
        {/* HEADER */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-4">
            Simple, honest pricing
          </h1>
          <p className="text-lg text-text-secondary">
            Start free for 30 days. No credit card needed.
          </p>
        </div>

        {/* TRIAL CALLOUT BOX */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="bg-brand-muted border border-brand/20 rounded-xl p-8 text-center flex flex-col items-center">
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              🎉 Start with a free 30-day trial
            </h2>
            <p className="text-text-secondary mb-6 text-base">
              50 messages · 1 bot · No card needed
            </p>
            <Link href={getCheckoutLink("starter")}>
              <Button size="lg" className="w-full sm:w-auto px-10 h-12 text-base font-semibold">
                Start free trial
              </Button>
            </Link>
          </div>
        </div>

        {/* MONTHLY / YEARLY TOGGLE */}
        <div className="flex items-center justify-center gap-4 mb-16">
          <span className={`text-sm font-medium ${!isYearly ? 'text-text-primary' : 'text-text-tertiary'}`}>Monthly</span>
          <Switch 
            checked={isYearly} 
            onCheckedChange={setIsYearly} 
            className="data-[state=checked]:bg-brand"
          />
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isYearly ? 'text-text-primary' : 'text-text-tertiary'}`}>Yearly</span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-success bg-success/10 px-2 py-1 rounded-full">Save 2 months</span>
          </div>
        </div>

        {/* 3 PLAN CARDS */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-24">
          
          {/* STARTER */}
          <div className="bg-bg-secondary border border-border-default rounded-2xl p-8 flex flex-col relative">
            <h3 className="text-xl font-semibold text-text-primary">Starter</h3>
            <p className="text-sm text-text-secondary mt-1">Get your bot live</p>
            <div className="mt-6 mb-2">
              <span className="text-4xl font-bold text-text-primary">{isYearly ? '₹833' : '₹999'}</span>
              <span className="text-text-tertiary ml-1">/mo</span>
            </div>
            {isYearly && <p className="text-sm text-text-tertiary mb-4">Billed ₹9,990 yearly (Save ₹1,998)</p>}
            {!isYearly && <div className="h-9 mb-4"></div>}
            
            <div className="border-t border-border-default my-6" />
            
            <ul className="space-y-4 flex-1">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary">1 Bot · 2,000 msg/mo</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary font-bold">WhatsApp agent</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary">10 Data Sources</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary">Lead capture (Dashboard)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary">Shareable playground</span>
              </li>
            </ul>
            
            <div className="mt-8 pt-4 border-t border-border-default">
              <p className="text-xs text-text-tertiary text-center mb-4">Additional messages at ₹1 each</p>
              <Link href={getCheckoutLink("starter")} className="block w-full">
                <Button variant="outline" className="w-full h-12 bg-bg-primary hover:bg-bg-tertiary">
                  {user ? "Upgrade to Starter" : "Get Started"}
                </Button>
              </Link>
            </div>
          </div>

          {/* GROWTH */}
          <div className="bg-brand/5 border-2 border-brand rounded-2xl p-8 flex flex-col relative transform md:-translate-y-4 shadow-lg shadow-brand/10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
               <span className="bg-brand text-bg-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Most Popular</span>
            </div>
            
            <h3 className="text-xl font-semibold text-text-primary">Growth</h3>
            <p className="text-sm text-text-secondary mt-1">Capture leads automatically</p>
            <div className="mt-6 mb-2">
              <span className="text-4xl font-bold text-text-primary">{isYearly ? '₹1,666' : '₹1,999'}</span>
              <span className="text-text-tertiary ml-1">/mo</span>
            </div>
            {isYearly && <p className="text-sm text-text-tertiary mb-4">Billed ₹19,990 yearly (Save ₹3,998)</p>}
            {!isYearly && <div className="h-9 mb-4"></div>}
            
            <div className="border-t border-brand/20 my-6" />
            
            <ul className="space-y-4 flex-1">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary">5 Bots · 5,000 msg/mo</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary font-bold">Lead capture + WA notifications</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary">Advanced Analytics</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary">Leads CSV Export</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary">Check Availability AI Action</span>
              </li>
            </ul>
            
            <div className="mt-8 pt-4 border-t border-brand/20">
              <p className="text-xs text-text-tertiary text-center mb-4">Additional messages at ₹1 each</p>
              <Link href={getCheckoutLink("growth")} className="block w-full">
                <Button className="w-full h-12 text-bg-primary">
                  {user ? "Upgrade to Growth" : "Get Started"}
                </Button>
              </Link>
            </div>
          </div>

          {/* SCALE */}
          <div className="bg-bg-secondary border border-border-hover rounded-2xl p-8 flex flex-col relative">
            <h3 className="text-xl font-semibold text-text-primary">Scale</h3>
            <p className="text-sm text-text-secondary mt-1">Automate your business</p>
            <div className="mt-6 mb-2">
              <span className="text-4xl font-bold text-text-primary">{isYearly ? '₹4,166' : '₹4,999'}</span>
              <span className="text-text-tertiary ml-1">/mo</span>
            </div>
            {isYearly && <p className="text-sm text-text-tertiary mb-4">Billed ₹49,990 yearly (Save ₹9,998)</p>}
            {!isYearly && <div className="h-9 mb-4"></div>}
            
            <div className="border-t border-border-default my-6" />
            
            <ul className="space-y-4 flex-1">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary">50 Bots · 15,000 msg/mo</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary font-bold">AI Actions + white-label</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary">Custom Branding & Domain</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary">Calculate Quote Action</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-success shrink-0" />
                <span className="text-sm text-text-primary">API & Webhook Access</span>
              </li>
            </ul>
            
            <div className="mt-8 pt-4 border-t border-border-default">
              <p className="text-xs text-text-tertiary text-center mb-4">Additional messages at ₹1 each</p>
              <Link href="mailto:hello@wraft.in" className="block w-full">
                <Button variant="outline" className="w-full h-12 bg-bg-primary hover:bg-bg-tertiary">
                  Contact Sales
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* COMPARISON TABLE */}
        <div className="max-w-5xl mx-auto mb-24 overflow-x-auto">
          <h3 className="text-2xl font-bold text-center mb-10 text-text-primary">Compare Features</h3>
          
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-bg-primary sticky top-0 z-10">
              <tr>
                <th className="py-4 px-6 border-b border-border-default font-medium text-text-secondary w-1/4">Feature</th>
                <th className="py-4 px-6 border-b border-border-default font-bold text-text-primary text-center">Starter</th>
                <th className="py-4 px-6 border-b border-border-default font-bold text-text-primary text-center bg-brand/5 relative">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-brand"></div>
                  Growth
                  <div className="text-[10px] text-brand uppercase mt-1">Most Popular</div>
                </th>
                <th className="py-4 px-6 border-b border-border-default font-bold text-text-primary text-center">Scale</th>
              </tr>
            </thead>
            
            <tbody className="text-sm">
              {/* Limits */}
              <tr>
                <td colSpan={4} className="bg-bg-secondary py-3 px-6 font-semibold text-text-primary uppercase text-xs tracking-wider border-b border-border-default">Core Limits</td>
              </tr>
              <tr>
                <td className="py-4 px-6 border-b border-border-default text-text-primary">Bots</td>
                <td className="py-4 px-6 border-b border-border-default text-center text-text-secondary">1</td>
                <td className="py-4 px-6 border-b border-border-default text-center text-text-secondary bg-brand/5">5</td>
                <td className="py-4 px-6 border-b border-border-default text-center text-text-secondary">50</td>
              </tr>
              <tr>
                <td className="py-4 px-6 border-b border-border-default text-text-primary">Messages / month</td>
                <td className="py-4 px-6 border-b border-border-default text-center text-text-secondary">2,000</td>
                <td className="py-4 px-6 border-b border-border-default text-center text-text-secondary bg-brand/5">5,000</td>
                <td className="py-4 px-6 border-b border-border-default text-center text-text-secondary">15,000</td>
              </tr>
              <tr>
                <td className="py-4 px-6 border-b border-border-default text-text-primary">Data Sources per bot</td>
                <td className="py-4 px-6 border-b border-border-default text-center text-text-secondary">10</td>
                <td className="py-4 px-6 border-b border-border-default text-center text-text-secondary bg-brand/5">50</td>
                <td className="py-4 px-6 border-b border-border-default text-center text-text-secondary">500</td>
              </tr>
              <tr>
                <td className="py-4 px-6 border-b border-border-default text-text-primary">Language Support</td>
                <td className="py-4 px-6 border-b border-border-default text-center text-text-secondary">En, Hi, Kn</td>
                <td className="py-4 px-6 border-b border-border-default text-center text-text-secondary bg-brand/5">50+ Languages</td>
                <td className="py-4 px-6 border-b border-border-default text-center text-text-secondary">100+ Languages</td>
              </tr>

              {/* Bot Capabilities */}
              <tr>
                <td colSpan={4} className="bg-bg-secondary py-3 px-6 font-semibold text-text-primary uppercase text-xs tracking-wider border-b border-border-default">Bot Capabilities</td>
              </tr>
              <tr>
                <td className="py-4 px-6 border-b border-border-default text-text-primary">WhatsApp Agent</td>
                <td className="py-4 px-6 border-b border-border-default text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center bg-brand/5"><Check className="h-5 w-5 text-success mx-auto" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-4 px-6 border-b border-border-default text-text-primary">Lead Capture</td>
                <td className="py-4 px-6 border-b border-border-default text-center text-text-secondary">Dashboard Only</td>
                <td className="py-4 px-6 border-b border-border-default text-center bg-brand/5"><Check className="h-5 w-5 text-success mx-auto" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-4 px-6 border-b border-border-default text-text-primary">WA Notifications (on Lead)</td>
                <td className="py-4 px-6 border-b border-border-default text-center"><X className="h-5 w-5 text-text-tertiary mx-auto opacity-50" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center bg-brand/5"><Check className="h-5 w-5 text-success mx-auto" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-4 px-6 border-b border-border-default text-text-primary">Advanced Analytics</td>
                <td className="py-4 px-6 border-b border-border-default text-center"><X className="h-5 w-5 text-text-tertiary mx-auto opacity-50" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center bg-brand/5"><Check className="h-5 w-5 text-success mx-auto" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-4 px-6 border-b border-border-default text-text-primary">Check Availability Action</td>
                <td className="py-4 px-6 border-b border-border-default text-center"><X className="h-5 w-5 text-text-tertiary mx-auto opacity-50" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center bg-brand/5"><Check className="h-5 w-5 text-success mx-auto" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-4 px-6 border-b border-border-default text-text-primary">Calculate Quote Action</td>
                <td className="py-4 px-6 border-b border-border-default text-center"><X className="h-5 w-5 text-text-tertiary mx-auto opacity-50" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center bg-brand/5"><X className="h-5 w-5 text-text-tertiary mx-auto opacity-50" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
              </tr>

              {/* Advanced */}
              <tr>
                <td colSpan={4} className="bg-bg-secondary py-3 px-6 font-semibold text-text-primary uppercase text-xs tracking-wider border-b border-border-default">Advanced & Customization</td>
              </tr>
              <tr>
                <td className="py-4 px-6 border-b border-border-default text-text-primary">Remove "Powered by Wraft"</td>
                <td className="py-4 px-6 border-b border-border-default text-center"><X className="h-5 w-5 text-text-tertiary mx-auto opacity-50" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center bg-brand/5"><Check className="h-5 w-5 text-success mx-auto" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-4 px-6 border-b border-border-default text-text-primary">Custom Branding & Domain</td>
                <td className="py-4 px-6 border-b border-border-default text-center"><X className="h-5 w-5 text-text-tertiary mx-auto opacity-50" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center bg-brand/5"><X className="h-5 w-5 text-text-tertiary mx-auto opacity-50" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-4 px-6 border-b border-border-default text-text-primary">API & Webhook Access</td>
                <td className="py-4 px-6 border-b border-border-default text-center"><X className="h-5 w-5 text-text-tertiary mx-auto opacity-50" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center bg-brand/5"><X className="h-5 w-5 text-text-tertiary mx-auto opacity-50" /></td>
                <td className="py-4 px-6 border-b border-border-default text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ENTERPRISE CALLOUT */}
        <div className="max-w-3xl mx-auto bg-bg-secondary border border-border-default rounded-xl p-10 text-center">
          <h3 className="text-2xl font-bold text-text-primary mb-3">Need more than 15,000 messages/month?</h3>
          <p className="text-text-secondary mb-8 text-lg">Talk to us about a custom plan with volume discounts and dedicated support.</p>
          <Link href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline" className="px-8 h-12 bg-bg-primary hover:bg-bg-tertiary font-semibold">
              WhatsApp Us
            </Button>
          </Link>
        </div>

      </div>
    </div>
  )
}
