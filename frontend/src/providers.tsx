"use client"

import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import { Toaster } from '@/components/ui/toaster'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes optimal caching before silent refetch
        gcTime: 1000 * 60 * 15,   // 15 minutes of memory sweeping persistence
        refetchOnWindowFocus: false,
        retry: 1, // Only retry once natively limiting failing calls
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

// IndexedDB Persister Configuration
const createIDBPersister = (idbValidKey: IDBValidKey = "reactQuery") => {
  return {
    getItem: async (key: string) => {
      const val = await get(`${idbValidKey}-${key}`)
      return val ? JSON.parse(val) : null
    },
    setItem: async (key: string, value: any) => {
      await set(`${idbValidKey}-${key}`, JSON.stringify(value))
    },
    removeItem: async (key: string) => {
      await del(`${idbValidKey}-${key}`)
    },
  }
}

let persister: ReturnType<typeof createAsyncStoragePersister> | undefined = undefined

function getPersister() {
  if (typeof window === 'undefined') return undefined
  if (!persister) {
    persister = createAsyncStoragePersister({
      storage: createIDBPersister(),
    })
  }
  return persister
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  const browserPersister = getPersister()
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

  if (!browserPersister) {
    return (
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: undefined as any }}>
        {children}
        <Toaster />
      </PersistQueryClientProvider>
    )
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: browserPersister }}>
      {children}
      <Toaster />
    </PersistQueryClientProvider>
  )
}
