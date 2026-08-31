import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchApi } from "@/lib/api"
import { QAPair } from "@/lib/types"

export function useQA(botId?: string) {
  return useQuery<QAPair[]>({
    queryKey: ["qa", botId],
    queryFn: async () => {
      return fetchApi(`/api/v1/bots/${botId}/qa`)
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
      return fetchApi(`/api/v1/bots/${botId}/qa`, {
        method: "POST",
        body: JSON.stringify(data)
      })
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
      return fetchApi(`/api/v1/bots/${botId}/qa/${qaId}`, {
        method: "PATCH",
        body: JSON.stringify(data)
      })
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
      return fetchApi(`/api/v1/bots/${botId}/qa/${qaId}`, {
        method: "DELETE"
      })
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["qa", botId] })
    },
  })
}
