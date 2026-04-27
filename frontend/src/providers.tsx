"use client"

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { ApiError } from '@/lib/api'
import { Toaster } from '@/components/ui/toaster'

export default function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { toast } = useToast()

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes optimal caching before silent refetch
        gcTime: 1000 * 60 * 15,     // 15 minutes of memory sweeping persistence
        refetchOnWindowFocus: false,
        retry: 1, // Only retry once natively limiting failing calls
      },
    },
    mutationCache: new MutationCache({
      onError: (error: unknown) => {
        if (error instanceof ApiError && error.status === 402) {
          toast({ 
            title: "Plan Limit Exceeded", 
            description: "You've reached your plan limits. Routing to billing...", 
            variant: "destructive"
          })
          router.push('/dashboard/billing')
        }
      }
    }),
    queryCache: new QueryCache({
      onError: (error: unknown) => {
        if (error instanceof ApiError && error.status === 402) {
          router.push('/dashboard/billing')
        }
      }
    })
  }))
  const setUser = useStore(state => state.setUser)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user, session.access_token)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setUser(session.user, session.access_token)
        } else {
          setUser(null, null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  )
}
