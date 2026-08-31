import { useStore } from './store'

const rawApiBase = process.env.NEXT_PUBLIC_API_URL || ''
const API_BASE = rawApiBase.replace(/\/+$/, '')

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function fetchApi(endpoint: string, options: RequestInit & { timeout?: number } = {}) {
  const { timeout = 15000, ...fetchOptions } = options;
  const token = useStore.getState().token
  
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const fullUrl = API_BASE ? `${API_BASE}${formattedEndpoint}` : formattedEndpoint

  try {
    const response = await fetch(fullUrl, {
      ...fetchOptions,
      headers,
      signal: controller.signal
    })
    
    clearTimeout(id);

    if (!response.ok) {
    let message = 'API Error'
    try {
      const err = await response.json()
      if (err.detail) {
        if (typeof err.detail === 'string') {
          message = err.detail
        } else if (Array.isArray(err.detail)) {
          message = err.detail.map((e: any) => `${e.loc?.slice(-1) || 'Field'}: ${e.msg}`).join(', ')
        } else if (typeof err.detail === 'object' && err.detail.message) {
          message = err.detail.message
        } else {
          message = JSON.stringify(err.detail)
        }
      } else if (err.message) {
        message = err.message
      }
    } catch {}
    
    // Global 402 handling for plan/trial expiration
    if (response.status === 402 && typeof window !== 'undefined') {
      // Optional: Store a message in localStorage to show a toast on the billing page
      localStorage.setItem("billing_error", message)
      window.location.href = '/dashboard/billing'
    }
    
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return null
  return response.json()
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please try again.', 408);
    }
    throw err;
  }
}
