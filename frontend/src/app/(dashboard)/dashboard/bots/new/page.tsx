"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Bot, Sparkles, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCreateBot, useBots } from "@/hooks/api/useBots"
import { useProfileWithPlan } from "@/hooks/api/useBilling"
import { useToast } from "@/hooks/use-toast"

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50) || "bot-" + Math.floor(Math.random() * 10000);
}

export default function CreateBotPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { mutate: createBot, isPending } = useCreateBot()
  const { data: bots, isLoading: botsLoading } = useBots()
  const { data: profile, isLoading: profileLoading } = useProfileWithPlan()

  const [name, setName] = useState("")

  const planLimits = profile?.plans
  const currentBotCount = bots?.length || 0
  const isLimitReached = planLimits ? currentBotCount >= planLimits.max_bots : false

  // Automatically redirect if plan limit is reached
  useEffect(() => {
    if (!botsLoading && !profileLoading && isLimitReached) {
      toast({
        title: "Plan Limit Reached",
        description: `You have reached your limit of ${planLimits?.max_bots} bot(s). Upgrade to create more.`,
        variant: "destructive"
      })
      router.push("/dashboard/billing")
    }
  }, [isLimitReached, botsLoading, profileLoading, router, toast, planLimits])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || isLimitReached) return

    const slug = generateSlug(name)

    createBot(
      { 
        name, 
        slug
      },
      {
        onSuccess: () => {
          toast({ title: "Bot Created", description: "Your new AI assistant is ready." })
          router.push("/dashboard/bots")
        },
        onError: (err: Error) => {
          toast({ title: "Failed to create bot", description: err.message, variant: "destructive" })
        }
      }
    )
  }

  if (botsLoading || profileLoading || isLimitReached) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="pb-10 animate-in fade-in duration-500 max-w-3xl mx-auto mt-8">
      <Link href="/dashboard/bots" className="inline-flex items-center text-sm font-medium text-text-tertiary hover:text-text-primary mb-6 transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to bots
      </Link>
      
      <div className="flex items-center gap-4 mb-8">
        <div className="h-12 w-12 rounded-xl bg-brand/10 flex items-center justify-center border border-brand/20">
          <Bot className="h-6 w-6 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Create a new bot</h1>
          <p className="text-sm text-text-secondary mt-1">Deploy a new AI assistant in seconds.</p>
        </div>
      </div>

      <div className="bg-bg-secondary border border-border-default rounded-xl p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary">Bot Name <span className="text-danger">*</span></label>
            <Input 
              placeholder="e.g. Customer Support Agent" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-bg-primary border-border-default focus:border-brand h-11"
            />
            <p className="text-[11px] text-text-tertiary">This is how the bot will be identified in your dashboard.</p>
          </div>

          <div className="pt-6 border-t border-border-default flex justify-end gap-3">
            <Link href="/dashboard/bots">
              <Button type="button" variant="ghost" className="h-11">Cancel</Button>
            </Link>
            <Button type="submit" disabled={!name.trim() || isPending || isLimitReached} className="h-11 px-8">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
              Create Bot
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
