import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cliente do Supabase com service_role para atualizar dados com segurança
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // ID da limpeza e estado enviados pelo fornecedor de pagamentos (Stripe / EuPago / easypay)
    const { order_id, status_pagamento } = body 

    if (status_pagamento === 'PAID' || status_pagamento === 'success' || status_pagamento === 'succeeded') {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid'
        })
        .eq('id', order_id)

      if (error) throw error
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}