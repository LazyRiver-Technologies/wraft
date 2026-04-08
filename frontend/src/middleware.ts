import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Since we rely on Zustand (client-side) for active token memory according to specs,
  // we proxy standard Supabase local session persistence checks to cookies. 
  // For a strictly robust Edge middleware check, we usually read cookies bounded by Supabase JS.
  // We'll look for a generic "sb-access-token" or similar cookie you can set on login,
  // or simply the universal "sb-refresh-token".
  
  const hasSession = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))
  
  // Custom fallback: you might set `app_auth_token` physically into cookies during login 
  // to make this middleware seamlessly generic if standard Supabase localstorage is used.
  const hasCustomAuthCookie = request.cookies.has('sb-access-token')

  const isAuthenticated = hasSession || hasCustomAuthCookie

  // Protect Dashboard
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/bots')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Redirect away from Auth links if logged in
  if (pathname.startsWith('/login') || pathname.startsWith('/signup')) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/bots/:path*', 
    '/login', 
    '/signup'
  ]
}
