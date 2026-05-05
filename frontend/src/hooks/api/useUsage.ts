import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'

export interface UsageData {
  plan_name: string
  messages_used: number
  messages_limit: number
  days_in_cycle: number
  trial_days_remaining: number
  overage_messages: number
  overage_cost_inr: number
  billing_cycle_start: string
}

export function useUsage() {
  return useQuery({
    queryKey: ['usage', 'me'],
    queryFn: async (): Promise<UsageData> => {
      return fetchApi('/usage/me')
    }
  })
}
