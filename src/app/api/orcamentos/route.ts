import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface QuoteRequest {
  nome: string
  email: string
  telefone: string
  tipoServico: string
  tipologia: string
  frequencia: string
  servicosAdicionais: string[]
  observacoes?: string
}

const PRECOS_BASE: Record<string, Record<string, number>> = {
  residencial_regular: {
    t1: 45,
    t2: 65,
    t3: 85,
    t4_plus: 120,
    comercial: 65,
  },
  profunda: {
    t1: 80,
    t2: 110,
    t3: 145,
    t4_plus: 190,
    comercial: 110,
  },
  pos_obra: {
    t1: 150,
    t2: 200,
    t3: 260,
    t4_plus: 340,
    comercial: 200,
  },
  estofos: {
    t1: 60,
    t2: 80,
    t3: 100,
    t4_plus: 130,
    comercial: 80,
  },
  comercial: {
    comercial: 80,
  },
}

const PRECOS_EXTRAS: Record<string, number> = {
  'Vidros & Estores': 35,
  'Interior do Forno': 20,
  'Interior do Frigorífico': 18,
  'Limpeza de Varandas': 25,
  'Passagem de Roupa': 15,
}

function calcularSubtotal(req: QuoteRequest): number {
  const base = PRECOS_BASE[req.tipoServico]?.[req.tipologia] || 50
  const extraTotal = req.servicosAdicionais.reduce(
    (acc, extra) => acc + (PRECOS_EXTRAS[extra] || 0),
    0
  )
  const fatorFrequencia: Record<string, number> = {
    pontual: 1,
    semanal: 0.9,
    quinzenal: 0.95,
    mensal: 1,
  }
  return Math.round((base * fatorFrequencia[req.frequencia] || base + extraTotal) * 100) / 100
}

export async function POST(request: Request) {
  try {
    const body: QuoteRequest = await request.json() as QuoteRequest;

    // Validação dos campos obrigatórios
    if (!body.nome || body.nome.trim().length < 2) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    }
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    }
    if (!body.telefone || body.telefone.trim().length < 9) {
      return NextResponse.json({ error: 'Telefone é obrigatório.' }, { status: 400 })
    }
    if (!body.tipoServico || !body.tipologia || !body.frequencia) {
      return NextResponse.json({ error: 'Dados do serviço incompletos.' }, { status: 400 })
    }

    const subtotal = calcularSubtotal(body)
    const vatRate = 23
    const total = Math.round((subtotal * (1 + vatRate / 100)) * 100) / 100

    // 1. Encontrar ou criar cliente pelo email
    let clientId: string
    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('email', body.email.toLowerCase())
      .single()

    if (existingClient) {
      clientId = existingClient.id
      // Atualizar telefone e nome se fornecidos
      await supabaseAdmin
        .from('clients')
        .update({ name: body.nome.trim(), phone: body.telefone.trim() })
        .eq('id', clientId)
    } else {
      const { data: newClient, error: clientError } = await supabaseAdmin
        .from('clients')
        .insert([
          {
            name: body.nome.trim(),
            email: body.email.toLowerCase(),
            phone: body.telefone.trim(),
            address: null,
            role: 'client',
          },
        ])
        .select('id')
        .single()

      if (clientError || !newClient) {
        return NextResponse.json(
          { error: 'Não foi possível registar os dados do cliente.' },
          { status: 500 }
        )
      }
      clientId = newClient.id
    }

    // 2. Gerar referência do orçamento
    const ano = new Date().getFullYear()
    const mes = String(new Date().getMonth() + 1).padStart(2, '0')
    const aleatorio = Math.floor(1000 + Math.random() * 9000)
    const referencia = `ORC-${ano}${mes}-${aleatorio}`

    // 3. Criar o orçamento com estado pendente
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 30)

    const { error: quoteError } = await supabaseAdmin.from('quotes').insert([
      {
        id: referencia,
        client_id: clientId,
        service_type: body.tipoServico,
        typology: body.tipologia,
        frequency: body.frequencia,
        subtotal,
        discount: 0,
        vat_rate: vatRate,
        total,
        estimated_cost: 0,
        margin_percentage: 0,
        status: 'pending',
        valid_until: validUntil.toISOString().split('T')[0],
        notes: `Pedido público via simulador. Extras: ${body.servicosAdicionais.join(', ') || 'Nenhum'}. Observações: ${body.observacoes || 'Nenhuma'}.`,
      },
    ])

    if (quoteError) {
      return NextResponse.json({ error: quoteError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      reference: referencia,
      total,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
