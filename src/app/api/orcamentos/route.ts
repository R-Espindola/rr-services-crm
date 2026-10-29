import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) throw new Error('Supabase server configuration is missing')
const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const BASE: Record<string, Record<string, number>> = {
  residencial_regular: { t1: 45, t2: 65, t3: 85, t4_plus: 120, comercial: 65 },
  profunda: { t1: 80, t2: 110, t3: 145, t4_plus: 190, comercial: 110 },
  pos_obra: { t1: 150, t2: 200, t3: 260, t4_plus: 340, comercial: 200 },
  estofos: { t1: 60, t2: 80, t3: 100, t4_plus: 130, comercial: 80 },
  comercial: { comercial: 80 },
}
const EXTRAS: Record<string, number> = {
  'Vidros & Estores': 35, 'Interior do Forno': 20, 'Interior do Frigorífico': 18,
  'Limpeza de Varandas': 25, 'Passagem de Roupa': 15,
}
const FREQUENCY: Record<string, number> = { pontual: 1, semanal: 0.9, quinzenal: 0.95, mensal: 1 }
const json = (body: object, status = 200) => NextResponse.json(body, { status })

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get('content-length') ?? 0)
    if (length > 10_000) return json({ error: 'Pedido demasiado grande.' }, 413)
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Pedido inválido.' }, 400)
    const input = body as Record<string, unknown>
    const { nome, email, telefone, tipoServico, tipologia, frequencia, servicosAdicionais, observacoes } = input

    if (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 120) return json({ error: 'Nome inválido.' }, 400)
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'E-mail inválido.' }, 400)
    if (typeof telefone !== 'string' || telefone.trim().length < 9 || telefone.length > 30) return json({ error: 'Telefone inválido.' }, 400)
    if (typeof tipoServico !== 'string' || typeof tipologia !== 'string' || typeof frequencia !== 'string' ||
        !BASE[tipoServico]?.[tipologia] || FREQUENCY[frequencia] === undefined) return json({ error: 'Dados do serviço inválidos.' }, 400)
    if (!Array.isArray(servicosAdicionais) || servicosAdicionais.length > Object.keys(EXTRAS).length ||
        !servicosAdicionais.every((item): item is string => typeof item === 'string' && item in EXTRAS) ||
        new Set(servicosAdicionais).size !== servicosAdicionais.length) return json({ error: 'Serviços adicionais inválidos.' }, 400)
    if (observacoes !== undefined && (typeof observacoes !== 'string' || observacoes.length > 2000)) return json({ error: 'Observações demasiado longas.' }, 400)

    const subtotal = Math.round((BASE[tipoServico][tipologia] * FREQUENCY[frequencia] +
      servicosAdicionais.reduce((sum, item) => sum + EXTRAS[item], 0)) * 100) / 100
    const total = Math.round(subtotal * 1.23 * 100) / 100
    const normalizedEmail = email.trim().toLowerCase()

    // Never mutate an existing account based on an unauthenticated email claim.
    const { data: existing, error: lookupError } = await supabaseAdmin.from('clients')
      .select('id').eq('email', normalizedEmail).maybeSingle()
    if (lookupError) return json({ error: 'Não foi possível processar o orçamento.' }, 500)
    let clientId = existing?.id
    if (!clientId) {
      const { data: created, error } = await supabaseAdmin.from('clients').insert({
        name: nome.trim(), email: normalizedEmail, phone: telefone.trim(), address: null, role: 'client',
      }).select('id').single()
      if (error || !created) return json({ error: 'Não foi possível registar os dados do cliente.' }, 500)
      clientId = created.id
    }

    const now = new Date()
    const reference = `ORC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${randomInt(100000, 1_000_000)}`
    const validUntil = new Date(now)
    validUntil.setDate(validUntil.getDate() + 30)
    const safeNotes = `Pedido público via simulador. Extras: ${servicosAdicionais.join(', ') || 'Nenhum'}. Observações: ${typeof observacoes === 'string' ? observacoes.trim() : 'Nenhuma'}.`
    const { error } = await supabaseAdmin.from('quotes').insert({
      id: reference, client_id: clientId, service_type: tipoServico, typology: tipologia,
      frequency: frequencia, subtotal, discount: 0, vat_rate: 23, total, estimated_cost: 0,
      margin_percentage: 0, status: 'pending', valid_until: validUntil.toISOString().slice(0, 10), notes: safeNotes,
    })
    if (error) return json({ error: 'Não foi possível criar o orçamento.' }, 500)
    return json({ success: true, reference, total }, 201)
  } catch {
    return json({ error: 'Não foi possível processar o orçamento.' }, 500)
  }
}
