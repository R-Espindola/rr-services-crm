import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const path = request.nextUrl.pathname
  const protectedRoute = path.startsWith('/admin') || path.startsWith('/cliente')
  const loginRoute = path === '/login'
  if (!protectedRoute && !loginRoute) return response

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    if (protectedRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', path)
      return NextResponse.redirect(url)
    }
    return response
  }

  const { data: profile, error: profileError } = await supabase
    .from('clients')
    .select('role')
    .eq('email', user.email ?? '')
    .maybeSingle()

  // Fail closed: missing profile or lookup failure never grants admin access.
  const role = profileError ? null : profile?.role ?? 'client'
  if (path.startsWith('/admin') && role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/cliente'
    url.search = ''
    return NextResponse.redirect(url)
  }
  if (path.startsWith('/cliente') && role === 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    url.search = ''
    return NextResponse.redirect(url)
  }
  if (loginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = role === 'admin' ? '/admin' : '/cliente'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
