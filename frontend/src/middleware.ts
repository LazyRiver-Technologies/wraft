import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Update session natively synchronizes standard Supabase JS Auth Cookies via SSR
  // and natively refreshes expired tokens inside the middleware response dynamically.
  const { supabaseResponse, user, supabase } = await updateSession(request)

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

  // Onboarding routing rules
  if (isAuthenticated && supabase) {
    // We only check DB if we are authenticated and hitting a protected or onboarding route
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/bots') || pathname.startsWith('/onboarding')) {
      const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).single()
      const isCompleted = profile?.onboarding_completed === true

      if (!isCompleted && !pathname.startsWith('/onboarding')) {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return Response.redirect(url)
      }

      if (isCompleted && pathname.startsWith('/onboarding')) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return Response.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/bots/:path*', 
    '/login', 
    '/signup',
    '/onboarding'
  ]
}
