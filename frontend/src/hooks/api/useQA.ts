import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { QAPair } from "@/lib/types"

export function useQA(botId?: string) {
  return useQuery<QAPair[]>({
    queryKey: ["qa", botId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('qa_pairs')
        .select('*')
        .eq('bot_id', botId!)
        .eq('is_active', true)
        .order('hit_count', { ascending: false })
      if (error) throw error
      return data as QAPair[]
    },
    enabled: !!botId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useCreateQA() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ botId, data }: { botId: string, data: Partial<QAPair> }) => {
      const supabase = createClient()
      const { data: result, error } = await supabase
        .from('qa_pairs')
        .insert({ ...data, bot_id: botId })
        .select()
        .single()
      if (error) throw error
      return result as QAPair
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["qa", botId] })
    },
  })
}

export function useUpdateQA() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ botId, qaId, data }: { botId: string, qaId: string, data: Partial<QAPair> }) => {
      const supabase = createClient()
      const { data: result, error } = await supabase
        .from('qa_pairs')
        .update(data)
        .eq('id', qaId)
        .eq('bot_id', botId)
        .select()
        .single()
      if (error) throw error
      return result as QAPair
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["qa", botId] })
    },
  })
}

export function useDeleteQA() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ botId, qaId }: { botId: string, qaId: string }) => {
      const supabase = createClient()
      // We perform a soft delete by marking is_active = false
      const { error } = await supabase
        .from('qa_pairs')
        .update({ is_active: false })
        .eq('id', qaId)
        .eq('bot_id', botId)
      if (error) throw error
      return true
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["qa", botId] })
    },
  })
}
