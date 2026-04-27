import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchApi } from "@/lib/api"
import { useStore } from "@/lib/store"
import { Bot, BotSettings, BotAppearance } from "@/lib/types"
import { createClient } from "@/utils/supabase/client"

export function useBots() {
  return useQuery<Bot[]>({
    queryKey: ["bots"],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("No session")
      
      const { data, error } = await supabase
        .from('bots')
        .select('*, bot_settings(*), bot_appearance(*), whatsapp_configs(*)')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false })
        
      if (error) throw error
      return data as Bot[]
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useBot(botId?: string) {
  return useQuery<Bot>({
    queryKey: ["bot", botId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bots')
        .select('*, bot_settings(*), bot_appearance(*), whatsapp_configs(*)')
        .eq('id', botId!)
        .single()
        
      if (error) throw error
      return data as Bot
    },
    enabled: !!botId,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useCreateBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; slug: string }) => 
      fetchApi("/api/v1/bots", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] })
    },
  })
}

export function useDeleteBot() {
  const queryClient = useQueryClient()
  const setCurrentBot = useStore(state => state.setCurrentBot)
  const currentBot = useStore(state => state.currentBot)
  
  return useMutation({
    mutationFn: async (botId: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('bots').delete().eq('id', botId)
      if (error) throw error
      return { success: true }
    },
    onSuccess: (_, botId) => {
      queryClient.invalidateQueries({ queryKey: ["bots"] })
      if (currentBot?.id === botId) {
        setCurrentBot(null)
      }
    },
  })
}

export function useUpdateBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ botId, data }: { botId: string, data: Partial<Bot> }) => {
      const supabase = createClient()
      const { data: result, error } = await supabase
        .from('bots')
        .update(data)
        .eq('id', botId)
        .select()
        .single()
        
      if (error) throw error
      return result
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["bot", botId] })
      queryClient.invalidateQueries({ queryKey: ["bots"] })
    },
  })
}

export function useUpdateBotSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ botId, data }: { botId: string, data: Partial<BotSettings> }) => {
      const supabase = createClient()
      const { data: result, error } = await supabase
        .from('bot_settings')
        .update(data)
        .eq('bot_id', botId)
        .select()
        .single()
        
      if (error) throw error
      return result
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["bot", botId] })
      queryClient.invalidateQueries({ queryKey: ["bots"] })
    },
  })
}

export function useUpdateBotAppearance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ botId, data }: { botId: string, data: Partial<BotAppearance> }) => {
      const supabase = createClient()
      const { data: result, error } = await supabase
        .from('bot_appearance')
        .update(data)
        .eq('bot_id', botId)
        .select()
        .single()
        
      if (error) throw error
      return result
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["bot", botId] })
    },
  })
}

export function useUpdateBotNotifications() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ botId, data }: { botId: string, data: Partial<BotSettings> }) => {
      const supabase = createClient()
      const { data: result, error } = await supabase
        .from('bot_settings')
        .update(data)
        .eq('bot_id', botId)
        .select()
        .single()
        
      if (error) throw error
      return result
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["bot", botId] })
    },
  })
}

export function useSharePlayground() {
  return useMutation({
    mutationFn: (botId: string) => 
      fetchApi(`/api/v1/bots/${botId}/playground/share`, {
        method: "POST",
      }),
  })
}
