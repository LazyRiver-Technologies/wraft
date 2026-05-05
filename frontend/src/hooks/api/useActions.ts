import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchApi } from "@/lib/api"

export function useActions(botId?: string) {
  return useQuery({
    queryKey: ["actions", botId],
    queryFn: () => fetchApi(`/api/v1/bots/${botId}/actions`),
    enabled: !!botId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useCreateAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, data }: { botId: string, data: any }) =>
      fetchApi(`/api/v1/bots/${botId}/actions`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["actions", botId] })
    },
  })
}

export function useUpdateAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, actionId, data }: { botId: string, actionId: string, data: any }) =>
      fetchApi(`/api/v1/bots/${botId}/actions/${actionId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["actions", botId] })
    },
  })
}

export function useDeleteAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, actionId }: { botId: string, actionId: string }) =>
      fetchApi(`/api/v1/bots/${botId}/actions/${actionId}`, { method: "DELETE" }),
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["actions", botId] })
    },
  })
}
