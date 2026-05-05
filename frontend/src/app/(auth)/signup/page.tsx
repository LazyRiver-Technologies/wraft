"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function SignupPage() {
  const [fullName, setFullName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const router = useRouter()
  const [planParam, setPlanParam] = React.useState<string | null>(null)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const plan = params.get("plan")
    if (plan) setPlanParam(plan)
    
    if (plan && plan !== "trial") {
      localStorage.setItem("intended_plan", plan)
    }
  }, [])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      })

      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        // Automatically redirect to onboarding to initialize their profile/workspace
        router.push("/onboarding")
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during signup. Please try again.")
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/onboarding`
      }
    })
  }

  // Set default plan selection UI feedback if needed
  const planNameDisplay = planParam && planParam !== "trial" 
    ? <div className="text-brand text-sm font-medium mt-1">Signing up for the <span className="capitalize">{planParam}</span> plan</div>
    : <p className="mt-1 text-sm text-text-secondary">Start building AI assistants in seconds.</p>;


  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-text-primary">Create an account</h2>
        {planNameDisplay}
      </div>

      <form onSubmit={handleSignup} className="grid gap-4">
        {error && <div className="p-3 bg-danger-muted text-danger rounded-lg text-sm border border-danger/20">{error}</div>}
        <div className="grid gap-2">
          <label className="text-sm font-medium text-text-primary">Full name</label>
          <Input 
            type="text" 
            placeholder="John Doe" 
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-text-primary">Email address</label>
          <Input 
            type="email" 
            placeholder="name@example.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-text-primary">Password</label>
          <Input 
            type="password" 
            placeholder="••••••••" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={loading}
          />
        </div>

        <Button type="submit" disabled={loading} className="mt-4 w-full">
          {loading ? "Creating account..." : "Sign up"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border-default"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-bg-secondary px-2 text-text-tertiary font-medium">Or continue with</span>
        </div>
      </div>

      <Button variant="secondary" type="button" onClick={handleGoogleSignup} className="w-full">
        <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
          <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
        </svg>
        Google
      </Button>

      <div className="mt-2 text-center text-sm text-text-secondary flex flex-col gap-2">
        <span>
          By signing up you agree to our{" "}
          <Link href="/terms" className="underline hover:text-text-primary">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="underline hover:text-text-primary">Privacy Policy</Link>.
        </span>
        <span>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:text-brand-hover hover:underline">
            Sign in
          </Link>
        </span>
      </div>
    </div>
  )
}
