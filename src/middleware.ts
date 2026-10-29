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
  const adminRoute = path.startsWith('/admin')
  const clientRoute = path.startsWith('/cliente')
  const workerRoute = path.startsWith('/trabalhador')
  const protectedRoute = adminRoute || clientRoute || workerRoute
  const loginRoute = path === '/login'
  const forceLogin = loginRoute && request.nextUrl.searchParams.get('force') === '1'
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
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const { data: workerProfile, error: workerError } = await supabase
    .from('worker_profiles')
    .select('active')
    .eq('user_id', user.id)
    .maybeSingle()

  // Fail closed: a worker must have an active, explicitly provisioned profile.
  const role = !profileError && profile?.role === 'admin'
    ? 'admin'
    : !workerError && workerProfile?.active
      ? 'worker'
      : 'client'
  if (adminRoute && role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = role === 'worker' ? '/trabalhador/agenda' : '/cliente'
    url.search = ''
    return NextResponse.redirect(url)
  }
  if (clientRoute && role !== 'client') {
    const url = request.nextUrl.clone()
    url.pathname = role === 'admin' ? '/admin' : '/trabalhador/agenda'
    url.search = ''
    return NextResponse.redirect(url)
  }
  if (workerRoute && role !== 'worker') {
    const url = request.nextUrl.clone()
    url.pathname = role === 'admin' ? '/admin' : '/cliente'
    url.search = ''
    return NextResponse.redirect(url)
  }
  if (loginRoute && !forceLogin) {
    const url = request.nextUrl.clone()
    url.pathname = role === 'admin' ? '/admin' : role === 'worker' ? '/trabalhador/agenda' : '/cliente'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
