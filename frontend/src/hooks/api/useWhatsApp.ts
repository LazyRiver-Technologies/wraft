import { useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchApi } from "@/lib/api"

export function useSaveWhatsAppToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, data }: { botId: string, data: { phone_number_id: string, waba_id: string, access_token: string } }) =>
      fetchApi(`/api/v1/bots/${botId}/whatsapp`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["bot", botId] })
    },
  })
}

export function useDisconnectWhatsApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId }: { botId: string }) =>
      fetchApi(`/api/v1/bots/${botId}/whatsapp`, { method: "DELETE" }),
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["bot", botId] })
    },
  })
}
