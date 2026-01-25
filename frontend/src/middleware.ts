import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const isAuthenticated = request.cookies.get('auth_token');
  
  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }
  
  // Redirect authenticated users away from auth pages (login, register, forgot-password)
  // But allow access to update-password, confirm, callback
  const isAuthPage = request.nextUrl.pathname.startsWith('/auth');
  const isExcluded = ['/auth/update-password', '/auth/confirm', '/auth/callback'].some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  if (isAuthPage && !isExcluded) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/auth/:path*'
  ]
}