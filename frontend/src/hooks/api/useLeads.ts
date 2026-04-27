import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { Lead } from "@/lib/types"

interface LeadsQueryArgs {
  botId?: string;
  search?: string;
  contacted?: boolean;
}

export function useLeads({ botId, search, contacted }: LeadsQueryArgs) {
  return useQuery<Lead[]>({
    queryKey: ["leads", botId, search, contacted],
    queryFn: async () => {
      const supabase = createClient()
      let query = supabase.from('leads').select('*').eq('bot_id', botId!)
      
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
      }
      
      if (contacted !== undefined) {
        query = query.eq('is_contacted', contacted)
      }
      
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data as Lead[]
    },
    enabled: !!botId,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useAllLeads(page: number = 1) {
  return useQuery<Lead[]>({
    queryKey: ["leads", "all", page],
    queryFn: async () => {
      const supabase = createClient()
      const limit = 50
      const from = (page - 1) * limit
      const to = from + limit - 1
      
      const { data, error } = await supabase
        .from('leads')
        .select('*, bots!inner(name, slug)')
        .order('created_at', { ascending: false })
        .range(from, to)
        
      if (error) throw error
      return data as Lead[]
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ botId, leadId, is_contacted }: { botId: string, leadId: string, is_contacted: boolean }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('leads')
        .update({ is_contacted })
        .eq('id', leadId)
        .select()
        .single()
        
      if (error) throw error
      return data as Lead
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["leads", botId] })
      queryClient.invalidateQueries({ queryKey: ["leads", "all"] })
    },
  })
}
