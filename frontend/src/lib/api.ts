import { useStore } from './store'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = useStore.getState().token
  
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let message = 'API Error'
    try {
      const err = await response.json()
      message = err.detail || message
    } catch {}
    throw new Error(message)
  }

  if (response.status === 204) return null
  return response.json()
}
