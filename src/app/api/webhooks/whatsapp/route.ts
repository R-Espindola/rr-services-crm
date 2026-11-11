import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validação do Webhook exigida pela Meta (WhatsApp)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  // Define o teu token secreto de verificação (configura o mesmo na Meta for Developers)
  const VERIFY_TOKEN = 'rr_services_whatsapp_token';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Token de verificação inválido' }, { status: 403 });
}

// Receber as mensagens do WhatsApp
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.messages?.[0]) {
      const messageObj = value.messages[0];
      const senderPhone = messageObj.from; // Número de telemóvel do cliente
      const messageText = messageObj.text?.body; // Texto enviado

      // Regista ou atualiza o lead/mensagem no Supabase
      await supabaseAdmin.from('incoming_leads').insert([
        {
          channel: 'whatsapp',
          sender_phone_or_username: senderPhone,
          last_message: messageText || 'Multimedia / Outro',
          status: 'new'
        }
      ]);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    console.error('Erro no webhook do WhatsApp:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Pedido inválido.' }, { status: 400 });
  }
}
