import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchApi } from "@/lib/api"
import { createClient } from "@/utils/supabase/client"
import { DataSource } from "@/lib/types"

export function useSources(botId?: string) {
  return useQuery<DataSource[]>({
    queryKey: ["sources", botId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('data_sources')
        .select('*')
        .eq('bot_id', botId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        
      if (error) throw error
      return data as DataSource[] || []
    },
    enabled: !!botId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useCreateSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, type, payload }: { botId: string, type: 'text' | 'url' | 'sitemap' | 'pdf', payload: any }) => {
      const isFormData = payload instanceof FormData;
      return fetchApi(`/api/v1/bots/${botId}/sources/${type}`, {
        method: "POST",
        body: isFormData ? payload : JSON.stringify(payload),
        headers: isFormData ? {} : { "Content-Type": "application/json" }
      });
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["sources", botId] })
    },
  })
}

export function useDeleteSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, sourceId }: { botId: string, sourceId: string }) => 
      fetchApi(`/api/v1/bots/${botId}/sources/${sourceId}`, {
        method: "DELETE",
      }),
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["sources", botId] })
    },
  })
}

export function useRetrainSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, sourceId }: { botId: string, sourceId: string }) => 
      fetchApi(`/api/v1/bots/${botId}/sources/${sourceId}/retrain`, {
        method: "POST",
      }),
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["sources", botId] })
    },
  })
}

export function useUpdateSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, sourceId, options }: { botId: string, sourceId: string, options: Partial<DataSource> }) => 
      fetchApi(`/api/v1/bots/${botId}/sources/${sourceId}`, {
        method: "PATCH",
        body: JSON.stringify(options),
      }),
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["sources", botId] })
    },
  })
}
