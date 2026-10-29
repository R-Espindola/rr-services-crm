import { randomBytes } from 'node:crypto'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('Supabase server configuration is missing')
const admin = createSupabaseAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

export async function POST(request: Request) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: profile, error: profileError } = await authClient.from('clients')
      .select('role').eq('email', user.email).maybeSingle()
    if (profileError) return NextResponse.json({ error: 'Não foi possível validar as permissões.' }, { status: 500 })
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })

    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > 10_000) return NextResponse.json({ error: 'Pedido demasiado grande.' }, { status: 413 })
    const input: unknown = await request.json()
    if (!input || typeof input !== 'object' || Array.isArray(input)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
    const { name, phone, email } = input as Record<string, unknown>
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 120 ||
        typeof phone !== 'string' || phone.trim().length < 9 || phone.length > 30 ||
        typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Dados do cliente inválidos.' }, { status: 400 })
    }
    const normalizedEmail = email.trim().toLowerCase()
    const { data: profileByEmail, error: clientLookupError } = await admin.from('clients')
      .select('id').eq('email', normalizedEmail).maybeSingle()
    if (clientLookupError) return NextResponse.json({ error: 'Não foi possível verificar o cliente.' }, { status: 500 })
    if (!profileByEmail) return NextResponse.json({ error: 'Registe primeiro o cliente.' }, { status: 409 })

    const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (usersError) return NextResponse.json({ error: 'Não foi possível verificar a conta.' }, { status: 500 })
    if (users.users.some((account) => account.email?.toLowerCase() === normalizedEmail)) {
      return NextResponse.json({ error: 'Já existe uma conta para este e-mail. A palavra-passe não foi alterada.' }, { status: 409 })
    }

    const temporaryPassword = randomBytes(24).toString('base64url')
    const { error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail, password: temporaryPassword, email_confirm: true,
      user_metadata: { name: name.trim() },
    })
    if (createError) return NextResponse.json({ error: 'Não foi possível criar a conta.' }, { status: 500 })
    return NextResponse.json({ success: true, password: temporaryPassword }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Não foi possível criar a conta.' }, { status: 500 })
  }
}
