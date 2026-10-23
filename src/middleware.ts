import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  const response = NextResponse.next()

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  // Rotas protegidas que requerem autenticação
  if (path.startsWith('/admin') || path.startsWith('/cliente')) {
    if (userError || !user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Obter o role do utilizador a partir da tabela clients
    const { data: clientProfile } = await supabase
      .from('clients')
      .select('role')
      .eq('email', user.email)
      .single()

    const userRole = clientProfile?.role || 'client'

    // /admin apenas para utilizadores com role 'admin'
    if (path.startsWith('/admin') && userRole !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/cliente'
      return NextResponse.redirect(url)
    }

    // /cliente para utilizadores autenticados (qualquer role)
    if (path.startsWith('/cliente') && userRole === 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }
  }

  // Se o utilizador está autenticado e tenta aceder ao login, redirecionar conforme o role
  if (path === '/login' && user && !userError) {
    const { data: clientProfile } = await supabase
      .from('clients')
      .select('role')
      .eq('email', user.email)
      .single()

    const userRole = clientProfile?.role || 'client'
    const url = request.nextUrl.clone()
    url.pathname = userRole === 'admin' ? '/admin' : '/cliente'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
