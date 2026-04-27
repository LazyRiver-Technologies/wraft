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
    <div className="relative overflow-hidden rounded-xl group">
      <div className="filter blur-[4px] pointer-events-none opacity-80 transition-opacity group-hover:opacity-60 select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-auto">
        <Link 
          href="/pricing"
          className="bg-bg-elevated border border-border-default shadow-sm hover:shadow-md transition-shadow rounded-full px-5 py-2.5 text-sm font-medium flex items-center gap-2 hover:bg-bg-tertiary"
        >
          <Lock className="h-4 w-4 text-text-secondary" />
          <span className="text-text-primary">Requires {requiredPlan} plan</span>
          <span className="text-brand font-bold ml-1">Upgrade</span>
        </Link>
      </div>
    </div>
  )
}
