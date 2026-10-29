import { randomBytes } from 'node:crypto'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('Supabase server configuration is missing')

const admin = createSupabaseAdmin(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

function toE164Phone(value: string) {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('351')) return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : null
  if (digits.length === 9) return `+351${digits}`
  return digits.length >= 7 && digits.length <= 15 ? `+${digits}` : null
}

function loginEmailFor(clientId: string, phone: string, storedEmail: string | null) {
  const email = storedEmail?.trim().toLowerCase() ?? ''
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const phoneDigits = phone.replace(/\D/g, '')
  const localPart = email.split('@')[0]?.replace(/\D/g, '') ?? ''
  const isLegacyPhonePlaceholder = email.endsWith('@rrservices.pt') && localPart === phoneDigits
  if (validEmail && !email.endsWith('@rrservices.internal') && !isLegacyPhonePlaceholder) return email
  return `cliente_${clientId.replaceAll('-', '')}@rrservices.internal`
}

export async function POST(request: Request) {
  try {
    const requestOrigin = request.headers.get('origin')
    if (!requestOrigin || requestOrigin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Origem do pedido inválida.' }, { status: 403 })
    }
    if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      return NextResponse.json({ error: 'Formato do pedido inválido.' }, { status: 415 })
    }

    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: requester, error: roleError } = await authClient.from('clients')
      .select('role').eq('auth_user_id', user.id).maybeSingle()
    if (roleError) return NextResponse.json({ error: 'Não foi possível validar as permissões.' }, { status: 500 })
    if (requester?.role !== 'admin') return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })

    const declaredLength = Number(request.headers.get('content-length') ?? 0)
    if (declaredLength > 2_000) return NextResponse.json({ error: 'Pedido demasiado grande.' }, { status: 413 })
    const rawBody = await request.text()
    if (rawBody.length > 2_000) return NextResponse.json({ error: 'Pedido demasiado grande.' }, { status: 413 })

    let input: unknown
    try {
      input = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
    }
    const { clientId } = input as Record<string, unknown>
    if (!isUuid(clientId)) return NextResponse.json({ error: 'Cliente inválido.' }, { status: 400 })

    // The browser sends only the row ID. All identity/contact data comes from
    // the trusted database, never from a client-controlled request payload.
    const { data: client, error: clientError } = await admin.from('clients')
      .select('id, name, phone, email, auth_user_id').eq('id', clientId).maybeSingle()
    if (clientError) return NextResponse.json({ error: 'Não foi possível carregar o cliente.' }, { status: 500 })
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    if (client.auth_user_id) {
      return NextResponse.json({ error: 'Este cliente já tem uma conta vinculada ao portal.' }, { status: 409 })
    }

    const phone = toE164Phone(client.phone ?? '')
    if (!phone) return NextResponse.json({ error: 'O cliente precisa de um número de telemóvel válido.' }, { status: 400 })
    const loginEmail = loginEmailFor(client.id, phone, client.email)
    const temporaryPassword = randomBytes(24).toString('base64url')

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: loginEmail,
      email_confirm: true,
      phone,
      phone_confirm: true,
      password: temporaryPassword,
      user_metadata: { name: client.name, client_id: client.id },
    })
    if (createError || !created.user) {
      return NextResponse.json({ error: 'Não foi possível criar a conta. Verifique se este e-mail ou telemóvel já está associado a outra conta.' }, { status: 409 })
    }

    const { data: linked, error: linkError } = await admin.from('clients')
      .update({ auth_user_id: created.user.id })
      .eq('id', client.id)
      .is('auth_user_id', null)
      .select('id')
      .maybeSingle()

    if (linkError || !linked) {
      // Auth and Postgres cannot share one transaction. Compensate if the
      // guarded profile link fails, avoiding an orphan login account.
      await admin.auth.admin.deleteUser(created.user.id)
      return NextResponse.json({ error: 'Não foi possível vincular a conta ao perfil. Nenhuma credencial foi emitida.' }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      clientId: client.id,
      userId: created.user.id,
      phone,
      loginEmail,
      password: temporaryPassword,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Não foi possível criar o acesso ao portal.' }, { status: 500 })
  }
}
