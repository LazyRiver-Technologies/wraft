"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { Loader2, Store, ShoppingCart, Briefcase, Laptop, GraduationCap, HeartPulse } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCreateBot } from "@/hooks/api/useBots"

const TEMPLATES = [
  { id: "retail", name: "Retail & E-commerce", icon: ShoppingCart, prompt: "You are a customer support agent for a retail store. Help customers track orders, understand return policies, and find products." },
  { id: "services", name: "Local Services", icon: Store, prompt: "You are a booking assistant for a local service business. Help customers schedule appointments and answer pricing questions." },
  { id: "b2b", name: "B2B SaaS / Tech", icon: Laptop, prompt: "You are a technical sales engineer. Answer product capabilities, API questions, and qualify high-value enterprise leads." },
  { id: "healthcare", name: "Healthcare / Clinic", icon: HeartPulse, prompt: "You are a patient coordinator. Help patients book consultations and answer general FAQ. Never give medical advice." },
  { id: "education", name: "Education / Course", icon: GraduationCap, prompt: "You are an admissions counselor. Help students understand course curriculum, fees, and application deadlines." },
  { id: "custom", name: "Custom / Blank", icon: Briefcase, prompt: "You are a helpful AI assistant. Always answer politely and use the provided context to answer questions." },
]

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50) || "bot-" + Math.floor(Math.random() * 10000);
}

export default function OnboardingStep1() {
  const [companyName, setCompanyName] = React.useState("")
  const [role, setRole] = React.useState("")
  const [selectedTemplate, setSelectedTemplate] = React.useState("custom")
  const [loading, setLoading] = React.useState(false)
  
  const router = useRouter()
  const { toast } = useToast()
  const { mutateAsync: createBotAsync } = useCreateBot()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) return

    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error("No authenticated user found.")

      const { error } = await supabase.auth.updateUser({
        data: {
          company_name: companyName,
          role: role,
          onboarding_complete: true
        }
      })

      if (error) throw error

      // Automatically create their first bot based on the template
      const template = TEMPLATES.find(t => t.id === selectedTemplate) || TEMPLATES[5]
      const botName = `${companyName} Assistant`
      const slug = generateSlug(botName)

      const newBot = await createBotAsync({
        name: botName,
        slug: slug,
      })

      // Update the bot settings with the template prompt
      if (newBot && newBot.id) {
         const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
         const { data: { session } } = await supabase.auth.getSession()
         if (session) {
           await fetch(`${apiBase}/api/v1/bots/${newBot.id}/settings`, {
             method: "PATCH",
             headers: {
               "Content-Type": "application/json",
               "Authorization": `Bearer ${session.access_token}`
             },
             body: JSON.stringify({ system_prompt: template.prompt })
           })
         }
      }

      toast({ title: "Workspace Ready", description: "Your first bot has been deployed." })
      router.push("/dashboard")
      
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] animate-in fade-in slide-in-from-bottom-4 duration-500 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Welcome to Wraft</h1>
        <p className="mt-2 text-text-secondary max-w-md mx-auto">Let's set up your workspace and automatically build your first AI agent.</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-bg-secondary border border-border-default rounded-2xl p-8 shadow-sm">
        <div className="space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">Company Name <span className="text-danger">*</span></label>
              <Input 
                placeholder="Acme Corp" 
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="h-12 bg-bg-primary focus:border-brand"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">Your Role</label>
              <Input 
                placeholder="e.g. Founder, Support Manager" 
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-12 bg-bg-primary focus:border-brand"
              />
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border-default">
            <label className="text-sm font-semibold text-text-primary">What best describes your business?</label>
            <p className="text-xs text-text-tertiary -mt-1">We will pre-configure your first bot's system prompt based on this.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
              {TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon
                const isSelected = selectedTemplate === tmpl.id
                return (
                  <div 
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    className={`
                      flex flex-col items-center justify-center gap-2 p-4 rounded-xl border cursor-pointer transition-all text-center
                      ${isSelected 
                        ? 'border-brand bg-brand/5 text-brand shadow-sm' 
                        : 'border-border-default bg-bg-primary text-text-secondary hover:border-text-tertiary'}
                    `}
                  >
                    <Icon className={`h-6 w-6 ${isSelected ? 'text-brand' : 'text-text-tertiary'}`} />
                    <span className={`text-sm font-medium ${isSelected ? 'text-brand' : 'text-text-primary'}`}>{tmpl.name}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="pt-6">
            <Button type="submit" disabled={loading || !companyName.trim()} className="w-full h-12 text-base">
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {loading ? "Deploying workspace..." : "Complete Setup & Deploy Bot"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
