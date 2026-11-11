import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validação do Webhook exigida pela Meta (Instagram)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const VERIFY_TOKEN = 'rr_services_instagram_token';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Token de verificação inválido' }, { status: 403 });
}

// Receber as mensagens/comentários do Instagram
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const entry = body.entry?.[0];
    
    // Tratamento para DMs do Instagram
    if (entry?.messaging?.[0]) {
      const messagingObj = entry.messaging[0];
      const senderId = messagingObj.sender?.id; // ID do utilizador do Instagram
      const messageText = messagingObj.message?.text;

      await supabaseAdmin.from('incoming_leads').insert([
        {
          channel: 'instagram',
          sender_phone_or_username: `ig_${senderId}`,
          last_message: messageText || 'Mensagem direta',
          status: 'new'
        }
      ]);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    console.error('Erro no webhook do Instagram:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Pedido inválido.' }, { status: 400 });
  }
}
