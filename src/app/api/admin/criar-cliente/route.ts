import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { name, phone, email, address } = await request.json()

    // 1. Gerar uma palavra-passe temporária automática (ex: RR + 4 dígitos)
    const passwordTemp = 'RR' + Math.floor(1000 + Math.random() * 9000)

    // 2. Verificar se o utilizador já existe no Supabase Auth
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = listData?.users.find((u) => u.email === email)

    if (existingUser) {
      // Se já existe, apenas atualizamos a palavra-passe
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { password: passwordTemp }
      )

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
      }
    } else {
      // Se não existe, criamos um novo utilizador no Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: passwordTemp,
        email_confirm: true,
      })

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true, password: passwordTemp })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}