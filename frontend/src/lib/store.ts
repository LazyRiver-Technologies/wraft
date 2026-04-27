import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { Bot } from './types'

interface AppState {
  user: User | null
  token: string | null
  setUser: (user: User | null, token: string | null) => void
  currentBot: Bot | null
  setCurrentBot: (bot: Bot | null) => void
}

export const useStore = create<AppState>((set) => ({
  user: null,
  token: null,
  setUser: (user, token) => set({ user, token }),
  currentBot: null,
  setCurrentBot: (bot) => set({ currentBot: bot }),
}))
