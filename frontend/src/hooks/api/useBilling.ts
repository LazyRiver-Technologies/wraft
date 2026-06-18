import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { useStore } from "@/lib/store"

export interface Plan {
  id: string
  name: string
  max_bots: number
  max_chunks_per_bot: number
  max_messages_per_month: number
  max_data_sources_per_bot: number
  price_inr: number
  max_qa_pairs?: number
  languages_supported?: string
  show_watermark?: boolean
  remove_watermark?: boolean
  api_access?: boolean
  max_actions?: number
  auto_retrain_frequency?: string | null
  overage_price_paise?: number
  lead_capture?: boolean
  wa_notifications?: boolean
  advanced_analytics?: boolean
  leads_export?: boolean
  check_availability?: boolean
  calculate_quote?: boolean
  custom_actions?: boolean
  shareable_playground?: boolean
  custom_branding?: boolean
  custom_domain?: boolean
  white_label?: boolean
  webhook_access?: boolean
  sitemap_source?: boolean
}

export interface Profile {
  id: string
  email: string
  plan_id: string
  monthly_message_count: number
  full_name?: string
  phone?: string
  business_name?: string
  city?: string
  primary_language?: string
  avatar_url?: string
  billing_cycle_start?: string
  razorpay_customer_id?: string | null
  razorpay_subscription_id?: string | null
  onboarding_completed?: boolean
  trial_started_at?: string
  trial_expired?: boolean
  overage_messages?: number
  business_type?: string
  main_use_case?: string
  plans: Plan
}

export function useProfileWithPlan() {
  const user = useStore(state => state.user)
  return useQuery<Profile>({
    queryKey: ["profile_plan", user?.id],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("No session")

      const { data, error } = await supabase
        .from('profiles')
        .select('*, plans(*, plan_features(*))')
        .eq('id', session.user.id)
        .single()
        
      if (error) throw error

      if (data?.plans?.plan_features) {
        data.plans.plan_features.forEach((f: any) => {
          data.plans[f.feature_key] = f.feature_value
        })
        delete data.plans.plan_features
      }
      return data as Profile
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

import { fetchApi } from "@/lib/api"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Profile>) => 
      fetchApi("/api/v1/profiles/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile_plan"] })
    },
  })
}
