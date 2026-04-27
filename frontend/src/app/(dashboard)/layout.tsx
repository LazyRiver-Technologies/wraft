"use client"

import * as React from "react"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { useUsage } from "@/hooks/api/useUsage"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Zap } from "lucide-react"
import { useStore } from "@/lib/store"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const { data: usage, isLoading } = useUsage()
  const router = useRouter()

  const isTrial = usage?.plan_name === "trial"
  const daysRemaining = usage?.trial_days_remaining ?? 0
  
  const showBanner = isTrial && daysRemaining <= 7 && daysRemaining > 0
  const showModal = isTrial && daysRemaining <= 0

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex relative">
      
      {/* --- TRIAL EXPIRY FULL SCREEN MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-bg-primary overflow-y-auto">
          <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6">
            <div className="text-center max-w-2xl mb-12">
              <h1 className="text-3xl font-bold text-text-primary mb-4">Your free trial has ended</h1>
              <p className="text-text-secondary text-lg">
                You explored Wraft for 30 days. Pick a plan to keep your bot running.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mb-12">
              {/* STARTER */}
              <div className="border border-border-default rounded-xl p-6 bg-white shadow-sm flex flex-col">
                <h3 className="text-xl font-bold text-text-primary mb-2">Starter</h3>
                <p className="text-sm text-text-secondary mb-4">Get your bot live</p>
                <div className="mb-6"><span className="text-3xl font-bold">₹999</span><span className="text-text-secondary">/mo</span></div>
                <div className="border-t border-border-default my-4"></div>
                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  <li className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" /> <strong>WhatsApp agent</strong></li>
                  <li className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" /> 2,000 messages / mo</li>
                  <li className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" /> 1 bot</li>
                  <li className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" /> 10 data sources</li>
                </ul>
                <Link href="/pricing" className="block w-full">
                  <Button className="w-full">Choose Starter</Button>
                </Link>
              </div>

              {/* GROWTH */}
              <div className="border-2 border-brand rounded-xl p-6 bg-white shadow-md flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-brand text-white text-[10px] font-bold px-3 py-1 uppercase tracking-wider rounded-bl-lg">Most Popular</div>
                <h3 className="text-xl font-bold text-text-primary mb-2">Growth</h3>
                <p className="text-sm text-text-secondary mb-4">Capture leads automatically</p>
                <div className="mb-6"><span className="text-3xl font-bold">₹1,999</span><span className="text-text-secondary">/mo</span></div>
                <div className="border-t border-border-default my-4"></div>
                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  <li className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" /> <strong>Lead capture & WA alerts</strong></li>
                  <li className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" /> Advanced Analytics</li>
                  <li className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" /> 5,000 messages / mo</li>
                  <li className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" /> 5 bots</li>
                </ul>
                <Link href="/pricing" className="block w-full">
                  <Button className="w-full">Choose Growth</Button>
                </Link>
              </div>

              {/* SCALE */}
              <div className="border border-border-default rounded-xl p-6 bg-white shadow-sm flex flex-col">
                <h3 className="text-xl font-bold text-text-primary mb-2">Scale</h3>
                <p className="text-sm text-text-secondary mb-4">Automate your business</p>
                <div className="mb-6"><span className="text-3xl font-bold">₹4,999</span><span className="text-text-secondary">/mo</span></div>
                <div className="border-t border-border-default my-4"></div>
                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  <li className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" /> <strong>AI Actions & API access</strong></li>
                  <li className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" /> Custom branding (white-label)</li>
                  <li className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" /> 15,000 messages / mo</li>
                  <li className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" /> 50 bots</li>
                </ul>
                <Link href="/pricing" className="block w-full">
                  <Button className="w-full">Choose Scale</Button>
                </Link>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-text-secondary mb-4">Questions? WhatsApp us</p>
              <a href="https://wa.me/15551234567" target="_blank" rel="noreferrer">
                <Button variant="outline" className="border-border-default shadow-sm">Chat on WhatsApp</Button>
              </a>
              <div className="mt-8">
                 <button onClick={handleSignOut} className="text-xs text-text-tertiary hover:underline">Sign Out</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* --- TRIAL BANNER --- */}
      {showBanner && (
        <div className="absolute top-0 left-0 right-0 z-[60] bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-center justify-center gap-4 animate-in slide-in-from-top">
          <Zap className="h-4 w-4 text-warning" />
          <p className="text-sm font-medium text-warning-foreground">
            Your free trial ends in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}. Pick a plan to keep your bot running.
          </p>
          <Link href="/pricing">
            <Button size="sm" variant="outline" className="h-7 text-xs border-warning/30 bg-white hover:bg-warning/10 text-warning-foreground">View plans</Button>
          </Link>
        </div>
      )}

      {/* Sidebar injected natively */}
      <AppSidebar 
        mobileOpen={mobileOpen} 
        setMobileOpen={setMobileOpen} 
      />
      
      {/* Main Structural Wrapper */}
      <div className={`flex-1 flex flex-col min-w-0 md:ml-[220px] transition-all ${showBanner ? 'mt-11' : ''}`}>
        {/* Topbar fully boxed structurally */}
        <DashboardHeader setMobileOpen={setMobileOpen} />
        
        {/* Full width main content */}
        <main className="flex-1 w-full p-6 md:p-8">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
