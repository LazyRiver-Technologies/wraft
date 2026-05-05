import React from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'

interface FeatureGateProps {
  hasAccess: boolean
  requiredPlan: string
  children: React.ReactNode
}

export function FeatureGate({ hasAccess, requiredPlan, children }: FeatureGateProps) {
  if (hasAccess) {
    return <>{children}</>
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden group">
      {/* Blurred background content - rendered in normal document flow so it retains dimensions */}
      <div className="filter blur-[5px] pointer-events-none select-none opacity-60 transition-all duration-300 group-hover:blur-[6px]">
        {children}
      </div>
      
      {/* Chatbase-style Overlay Card */}
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-primary/40">
        <div className="bg-bg-primary border border-border-default shadow-xl rounded-xl p-6 sm:p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-brand/10 flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-brand" />
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-2">
            Available on {requiredPlan}
          </h3>
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">
            Upgrade your plan to unlock this feature and get the most out of your AI assistant.
          </p>
          <Link href="/dashboard/billing" className="w-full">
            <button className="w-full bg-text-primary hover:bg-text-secondary text-bg-primary font-medium py-2.5 px-4 rounded-lg transition-colors">
              Upgrade to {requiredPlan}
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
