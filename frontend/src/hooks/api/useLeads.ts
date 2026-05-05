import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Lead } from "@/lib/types"
import { fetchApi } from "@/lib/api"

interface LeadsQueryArgs {
  botId?: string;
  search?: string;
  contacted?: boolean;
}

export function useLeads({ botId, search, contacted }: LeadsQueryArgs) {
  return useQuery<Lead[]>({
    queryKey: ["leads", botId, search, contacted],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (contacted !== undefined) params.set("is_contacted", String(contacted))
      const res = await fetchApi(`/api/v1/bots/${botId}/leads${params.toString() ? `?${params}` : ""}`)
      const rows = (res.data || []) as Lead[]
      if (!search) return rows
      const term = search.toLowerCase()
      return rows.filter((lead) =>
        [lead.name, lead.email, lead.phone].some((value) => value?.toLowerCase().includes(term))
      )
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
      const res = await fetchApi(`/api/v1/bots/leads?page=${page}`)
      return (res.data || []) as Lead[]
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, leadId, is_contacted }: { botId: string, leadId: string, is_contacted: boolean }) =>
      fetchApi(`/api/v1/bots/${botId}/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_contacted }),
      }) as Promise<Lead>,
    onSuccess: (_, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["leads", botId] })
      queryClient.invalidateQueries({ queryKey: ["leads", "all"] })
    },
  })
}
