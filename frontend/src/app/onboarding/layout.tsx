"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  
  // Basic visual progress map based on typical step paths
  const currentStep = pathname.includes("step-2") ? 2 
    : pathname.includes("step-3") ? 3 
    : 1

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col pt-12 p-4">
      {/* Centered Progress Dots Header */}
      <div className="w-full flex justify-center mb-12">
        <div className="flex items-center gap-3">
          {[1, 2, 3].map((step) => (
             <div 
               key={step}
               className={cn(
                 "h-2 rounded-full transition-all duration-300",
                 step === currentStep ? "w-8 bg-brand" : "w-2 bg-bg-tertiary",
                 step < currentStep && "bg-brand/40"
               )} 
             />
          ))}
        </div>
      </div>

      {/* Onboarding Main Content Container Wrapper */}
      <div className="flex-1 flex justify-center w-full max-w-2xl mx-auto">
        <div className="w-full">
           {children}
        </div>
      </div>
    </div>
  )
}
