import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"

export interface Plan {
  id: string
  name: string
  max_bots: number
  max_chunks_per_bot: number
  max_messages_per_month: number
  max_data_sources_per_bot: number
  api_access?: boolean
  advanced_analytics?: boolean
  custom_branding?: boolean
  leads_export?: boolean
}

export interface Profile {
  id: string
  email: string
  plan_id: string
  monthly_message_count: number
  plans: Plan
}

export function useProfileWithPlan() {
  return useQuery<Profile>({
    queryKey: ["profile_plan"],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("No session")

      const { data, error } = await supabase
        .from('profiles')
        .select('*, plans(*)')
        .eq('id', session.user.id)
        .single()
        
      if (error) throw error
      return data as Profile
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
