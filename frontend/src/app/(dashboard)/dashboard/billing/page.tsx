"use client"

import { motion } from "framer-motion"
import { Check, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"

const plans = [
  {
    name: "Trial",
    price: "0",
    period: "30 days",
    messages: "50 messages/mo",
    description: "Try Wraft with no commitment",
    features: [
      "Web widget",
      "50 AI messages per month",
      "1 bot",
      "2 data sources",
      "5 Q&A pairs",
      "English only",
    ],
    cta: "Current Plan",
    popular: false,
    accent: false,
    planId: "trial"
  },
  {
    name: "Starter",
    price: "999",
    period: "/mo",
    messages: "2,000 messages/mo",
    description: "Get your bot live",
    features: [
      "WhatsApp agent",
      "2,000 AI messages per month",
      "1 bot",
      "10 data sources",
      "Basic document upload",
      "Community support",
    ],
    cta: "Choose Starter",
    popular: false,
    accent: false,
    planId: "starter"
  },
  {
    name: "Growth",
    price: "1,999",
    period: "/mo",
    messages: "5,000 messages/mo",
    description: "Capture leads automatically",
    features: [
      "Everything in Starter",
      "5,000 AI messages per month",
      "5 bots",
      "Lead capture & WA alerts",
      "Advanced Analytics",
      "Unlimited document uploads",
      "Email support",
    ],
    cta: "Choose Growth",
    popular: true,
    accent: true,
    planId: "growth"
  },
  {
    name: "Scale",
    price: "4,999",
    period: "/mo",
    messages: "15,000 messages/mo",
    description: "Automate your business",
    features: [
      "Everything in Growth",
      "15,000 AI messages per month",
      "50 bots",
      "AI Actions & API access",
      "Custom branding (white-label)",
      "Priority support",
      "Dedicated account manager",
    ],
    cta: "Choose Scale",
    popular: false,
    accent: false,
    planId: "scale"
  },
]

import { useUsage } from "@/hooks/api/useUsage"

export default function Billing() {
  const router = useRouter()
  const { data: usage } = useUsage()
  const currentPlan = usage?.plan_name || "trial"

  const handleUpgrade = (planId: string) => {
    // Redirect to the checkout flow with the selected plan
    router.push(`/checkout?plan=${planId}&yearly=false`)
  }

  return (
    <section className="py-6 sm:py-10 bg-transparent animate-in fade-in duration-500">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="uppercase tracking-[0.2em] text-xs font-bold text-brand mb-4">Billing & Plans</p>
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-4"
          >
            Upgrade your capabilities
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto">
            Scale your AI agents securely. Unbound API vectors. No hidden fees.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative"
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="bg-brand text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                    Most Popular
                  </span>
                </div>
              )}
              <div
                className={`h-full rounded-2xl border p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  plan.accent
                    ? "bg-bg-primary border-brand shadow-[0_0_30px_rgba(var(--brand-rgb),0.15)] ring-1 ring-brand/20"
                    : "bg-bg-secondary border-border-default shadow-sm"
                }`}
              >
                <div className="mb-6">
                  <h3
                    className={`text-xl font-bold mb-1 text-text-primary`}
                  >
                    {plan.name}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-base text-text-tertiary">&#8377;</span>
                    <span
                      className="text-4xl font-bold tracking-tight text-text-primary"
                    >
                      {plan.price}
                    </span>
                    <span className="text-sm text-text-secondary">
                      {plan.period}
                    </span>
                  </div>
                  <p className="text-xs mt-2 font-medium text-text-secondary">
                    {plan.messages}
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand" />
                      <span className="text-sm text-text-primary">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  disabled={currentPlan === plan.planId}
                  onClick={() => handleUpgrade(plan.planId)}
                  className={`w-full py-3 rounded-full text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                    currentPlan === plan.planId 
                      ? "bg-bg-tertiary text-text-secondary cursor-not-allowed opacity-70"
                      : plan.accent
                        ? "bg-brand text-white hover:bg-brand-hover shadow-md hover:-translate-y-0.5"
                        : "bg-bg-elevated border border-border-default text-text-primary hover:bg-bg-tertiary hover:-translate-y-0.5"
                  }`}
                >
                  {currentPlan === plan.planId ? "Current Plan" : plan.cta}
                  {currentPlan !== plan.planId && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
