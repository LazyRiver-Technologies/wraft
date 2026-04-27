import { useQuery } from "@tanstack/react-query"
import { fetchApi } from "@/lib/api"

export interface AnalyticsFilter {
  botId?: string
  startDate?: string
  endDate?: string
  channel?: "all" | "web" | "whatsapp"
}

function buildQueryString(filter: AnalyticsFilter) {
  const params = new URLSearchParams()
  if (filter.startDate) params.append("start_date", filter.startDate)
  if (filter.endDate) params.append("end_date", filter.endDate)
  if (filter.channel) params.append("channel", filter.channel)
  return params.toString() ? `?${params.toString()}` : ""
}

export function useGlobalOverviewQuery(filter: AnalyticsFilter = {}) {
  return useQuery({
    queryKey: ["analytics", "global_overview", filter],
    queryFn: () => fetchApi(`/api/v1/analytics/overview${buildQueryString(filter)}`),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useGlobalTrendsQuery(filter: AnalyticsFilter = {}) {
  return useQuery({
    queryKey: ["analytics", "global_trends", filter],
    queryFn: () => fetchApi(`/api/v1/analytics/conversations-over-time${buildQueryString(filter)}`),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useOverviewQuery({ botId, ...filter }: AnalyticsFilter) {
  return useQuery({
    queryKey: ["analytics", "overview", botId, filter],
    queryFn: () => fetchApi(`/api/v1/analytics/${botId}/overview${buildQueryString(filter)}`),
    enabled: !!botId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useTrendsQuery({ botId, ...filter }: AnalyticsFilter) {
  return useQuery({
    queryKey: ["analytics", "trends", botId, filter],
    queryFn: () => fetchApi(`/api/v1/analytics/${botId}/conversations-over-time${buildQueryString(filter)}`),
    enabled: !!botId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useDropOffQuery({ botId, ...filter }: AnalyticsFilter) {
  return useQuery({
    queryKey: ["analytics", "dropoff", botId, filter],
    queryFn: () => fetchApi(`/api/v1/analytics/${botId}/drop-off${buildQueryString(filter)}`),
    enabled: !!botId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useSentimentQuery({ botId, ...filter }: AnalyticsFilter) {
  return useQuery({
    queryKey: ["analytics", "sentiment", botId, filter],
    queryFn: () => fetchApi(`/api/v1/analytics/${botId}/sentiment${buildQueryString(filter)}`),
    enabled: !!botId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useSourcesPerformanceQuery({ botId, ...filter }: AnalyticsFilter) {
  return useQuery({
    queryKey: ["analytics", "sources_performance", botId, filter],
    queryFn: () => fetchApi(`/api/v1/analytics/${botId}/sources-performance${buildQueryString(filter)}`),
    enabled: !!botId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useTopicsQuery({ botId, ...filter }: AnalyticsFilter) {
  return useQuery({
    queryKey: ["analytics", "topics", botId, filter],
    queryFn: () => fetchApi(`/api/v1/analytics/${botId}/topics${buildQueryString(filter)}`),
    enabled: !!botId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useSuggestionsQuery(botId?: string) {
  return useQuery({
    queryKey: ["analytics", "suggestions", botId],
    queryFn: () => fetchApi(`/api/v1/analytics/${botId}/suggestions`),
    enabled: !!botId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
