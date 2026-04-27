import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Update session natively synchronizes standard Supabase JS Auth Cookies via SSR
  // and natively refreshes expired tokens inside the middleware response dynamically.
  const { supabaseResponse, user } = await updateSession(request)

  const { pathname } = request.nextUrl
  const isAuthenticated = !!user

  // Protect Dashboard
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/bots')) {
    if (!isAuthenticated) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return Response.redirect(url)
    }
  }

  // Redirect away from Auth links if logged in
  if (pathname.startsWith('/login') || pathname.startsWith('/signup')) {
    if (isAuthenticated) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return Response.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/bots/:path*', 
    '/login', 
    '/signup'
  ]
}
