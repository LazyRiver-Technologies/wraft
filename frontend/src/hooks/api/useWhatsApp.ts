import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"

export function useSaveWhatsAppToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ botId, data }: { botId: string, data: { phone_number_id: string, waba_id: string, access_token: string } }) => {
      const supabase = createClient()
      
      // WhatsApp tokens are saved in whatsapp_configs.
      // First, check if config exists
      const { data: existing } = await supabase
        .from('whatsapp_configs')
        .select('id')
        .eq('bot_id', botId)
        .single()
        
      if (existing) {
        const { data: result, error } = await supabase
          .from('whatsapp_configs')
          .update({
             phone_number_id: data.phone_number_id,
             waba_id: data.waba_id,
             access_token: data.access_token,
             verify_token: `lr_ws_verified_token_${botId}`
          })
          .eq('id', existing.id)
          .select()
          .single()
        if (error) throw error
        return result
      } else {
        const { data: result, error } = await supabase
          .from('whatsapp_configs')
          .insert({
             bot_id: botId,
             phone_number_id: data.phone_number_id,
             waba_id: data.waba_id,
             access_token: data.access_token,
             verify_token: `lr_ws_verified_token_${botId}`
          })
          .select()
          .single()
        if (error) throw error
        return result
      }
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["bot", botId] })
    },
  })
}

export function useDisconnectWhatsApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ botId }: { botId: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('whatsapp_configs')
        .delete()
        .eq('bot_id', botId)
      if (error) throw error
      return true
    },
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["bot", botId] })
    },
  })
}
