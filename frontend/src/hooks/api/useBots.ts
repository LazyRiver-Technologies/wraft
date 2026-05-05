import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchApi } from "@/lib/api"
import { useStore } from "@/lib/store"
import { Bot, BotSettings, BotAppearance, NotificationSettings } from "@/lib/types"
import { createClient } from "@/utils/supabase/client"

export function useBots() {
  return useQuery<Bot[]>({
    queryKey: ["bots"],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("No session")
      
      const currentYearMonth = parseInt(
        new Date().toISOString().slice(0, 7).replace('-', '')
      )
      
      const { data, error } = await supabase
        .from('bots')
        .select(`
          *,
          bot_settings(*),
          bot_appearance(*),
          whatsapp_configs(*),
          notification_settings(*),
          conversations(count),
          leads(count)
        `)
        .eq('owner_id', session.user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        
      if (error) throw error
      
      // Usage logs are owner-scoped in the current schema, not bot-scoped.
      return (data as any[]).map(bot => ({
        ...bot,
        this_month: { message_count: 0, web_count: 0, whatsapp_count: 0, year_month: currentYearMonth }
      }))
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
        .select('*, bot_settings(*), bot_appearance(*), whatsapp_configs(*), notification_settings(*)')
        .eq('id', botId!)
        .is('deleted_at', null)
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
    mutationFn: (botId: string) => 
      fetchApi(`/api/v1/bots/${botId}`, { method: "DELETE" }),
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
    mutationFn: ({ botId, data }: { botId: string, data: Partial<Bot> }) => 
      fetchApi(`/api/v1/bots/${botId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["bot", botId] })
      queryClient.invalidateQueries({ queryKey: ["bots"] })
    },
  })
}

export function useUpdateBotSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, data }: { botId: string, data: Partial<BotSettings> }) =>
      fetchApi(`/api/v1/bots/${botId}/settings`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["bot", botId] })
      queryClient.invalidateQueries({ queryKey: ["bots"] })
    },
  })
}

export function useUpdateBotAppearance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, data }: { botId: string, data: Partial<BotAppearance> }) =>
      fetchApi(`/api/v1/bots/${botId}/appearance`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["bot", botId] })
    },
  })
}

export function useUpdateBotNotifications() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, data }: { botId: string, data: Partial<NotificationSettings> }) =>
      fetchApi(`/api/v1/bots/${botId}/notifications`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
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
