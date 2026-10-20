import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Protege as rotas /admin e /cliente
  if (path.startsWith('/admin') || path.startsWith('/cliente')) {
    const token = request.cookies.get('sb-access-token')?.value

    if (!token) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}