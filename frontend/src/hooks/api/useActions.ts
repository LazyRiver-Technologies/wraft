import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"

export function useActions(botId?: string) {
  return useQuery({
    queryKey: ["actions", botId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bot_actions')
        .select('*')
        .eq('bot_id', botId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!botId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useCreateAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ botId, data }: { botId: string, data: any }) => {
      const supabase = createClient()
      const { data: result, error } = await supabase
        .from('bot_actions')
        .insert({ ...data, bot_id: botId })
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["actions", botId] })
    },
  })
}

export function useUpdateAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ botId, actionId, data }: { botId: string, actionId: string, data: any }) => {
      const supabase = createClient()
      const { data: result, error } = await supabase
        .from('bot_actions')
        .update(data)
        .eq('id', actionId)
        .eq('bot_id', botId)
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["actions", botId] })
    },
  })
}

export function useDeleteAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ botId, actionId }: { botId: string, actionId: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('bot_actions')
        .delete()
        .eq('id', actionId)
        .eq('bot_id', botId)
      if (error) throw error
      return true
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["actions", botId] })
    },
  })
}
