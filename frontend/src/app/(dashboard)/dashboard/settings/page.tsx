"use client"

import * as React from "react"
import { useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Key, CreditCard, User, LogOut, CheckCircle2 } from "lucide-react"
import { useStore } from "@/lib/store"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useProfileWithPlan, useUpdateProfile } from "@/hooks/api/useBilling"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const user = useStore(state => state.user)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const { data: profile, isLoading: profileLoading } = useProfileWithPlan()
  const { mutate: updateProfile, isPending: isUpdatingProfile } = useUpdateProfile()

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    business_name: "",
    city: "",
    primary_language: "english",
  })

  React.useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        business_name: profile.business_name || "",
        city: profile.city || "",
        primary_language: profile.primary_language || "english",
      })
    }
  }, [profile])

  const handleSaveProfile = () => {
    updateProfile(formData, {
      onSuccess: () => {
        toast({ title: "Profile saved", description: "Your account details have been updated." })
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" })
      }
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const handleResetPassword = async () => {
    setLoading(true)
    setMessage("")
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email || "")
      if (error) throw error
      setMessage("Password reset link sent to your email!")
    } catch (e: any) {
      setMessage(e.message || "Failed to send reset link.")
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "api-keys", label: "API Keys", icon: Key },
    { id: "billing", label: "Billing", icon: CreditCard },
  ]

  return (
    <>
      <PageHeader 
        title="Global Settings" 
        description="Manage your account profile, API access, and billing details."
      />

      <div className="flex flex-col md:flex-row gap-8">
        
        {/* SIDEBAR TABS */}
        <div className="w-full md:w-64 flex flex-col gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors text-left
                ${activeTab === tab.id 
                  ? 'bg-bg-elevated text-text-primary shadow-sm border border-border-default' 
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'}
              `}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
          
          <div className="my-4 border-t border-border-default pt-4">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg text-danger hover:bg-danger/5 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 max-w-3xl">
          
          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="rounded-xl border border-border-default bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-text-primary mb-6">Account Details</h3>
                
                <div className="grid gap-6">
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-text-primary">Full Name</label>
                      <Input 
                        value={formData.full_name} 
                        onChange={e => setFormData(p => ({...p, full_name: e.target.value}))} 
                        placeholder="John Doe" 
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-text-primary">Phone Number</label>
                      <Input 
                        value={formData.phone} 
                        onChange={e => setFormData(p => ({...p, phone: e.target.value}))} 
                        placeholder="+91 98765 43210" 
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-text-primary">Business Name</label>
                      <Input 
                        value={formData.business_name} 
                        onChange={e => setFormData(p => ({...p, business_name: e.target.value}))} 
                        placeholder="Acme Corp" 
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-text-primary">City</label>
                      <Input 
                        value={formData.city} 
                        onChange={e => setFormData(p => ({...p, city: e.target.value}))} 
                        placeholder="Bengaluru" 
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-text-primary">Primary Language</label>
                    <Select value={formData.primary_language} onValueChange={v => setFormData(p => ({...p, primary_language: v}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="hindi">Hindi</SelectItem>
                        <SelectItem value="kannada">Kannada</SelectItem>
                        <SelectItem value="hinglish">Hinglish</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveProfile} disabled={isUpdatingProfile}>
                      {isUpdatingProfile ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>

                  <div className="grid gap-2 pt-4 border-t border-border-default">
                    <label className="text-sm font-medium text-text-primary">Email Address</label>
                    <Input value={user?.email || ""} readOnly className="bg-bg-tertiary text-text-secondary cursor-not-allowed" />
                    <p className="text-xs text-text-tertiary mt-1">Email address cannot be changed currently.</p>
                  </div>

                  <div className="grid gap-2 pt-4 border-t border-border-default">
                    <h4 className="text-sm font-medium text-text-primary">Password Authentication</h4>
                    <p className="text-sm text-text-secondary mb-2">Send a secure link to your email to reset your password.</p>
                    <div className="flex items-center gap-4">
                      <Button onClick={handleResetPassword} disabled={loading} variant="secondary">
                        {loading ? "Sending..." : "Send Reset Link"}
                      </Button>
                      {message && <span className="text-sm text-brand font-medium">{message}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* API KEYS TAB */}
          {activeTab === "api-keys" && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="rounded-xl border border-border-default bg-white p-6 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">API Keys</h3>
                    <p className="text-sm text-text-secondary mt-1">Use these keys to authenticate your application with our API.</p>
                  </div>
                  <Button size="sm">Generate New Key</Button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-bg-secondary border border-border-default rounded-lg">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-text-primary">Default Project Key</span>
                    <span className="text-xs font-mono text-text-tertiary">sk_live_••••••••••••••••••••••••</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm">Reveal</Button>
                    <Button variant="danger" size="sm" className="bg-danger/10 text-danger hover:bg-danger/20 border-transparent">Revoke</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BILLING TAB */}
          {activeTab === "billing" && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="rounded-xl border border-border-default bg-white p-6 shadow-sm flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-text-primary">Current Plan: Pro</h3>
                    <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-brand/10 text-brand rounded-full">Active</span>
                  </div>
                  <p className="text-sm text-text-secondary mt-1">You are currently on the Pro plan ($29/mo).</p>
                </div>
                <Link href="/dashboard/billing">
                  <Button variant="secondary">Manage Subscription</Button>
                </Link>
              </div>

              <div className="rounded-xl border border-border-default bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Plan Features</h3>
                <ul className="flex flex-col gap-3">
                  {['Up to 5 AI Assistants', '10,000 Messages / month', 'Priority Support', 'Custom Branding'].map(feature => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-text-secondary">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
