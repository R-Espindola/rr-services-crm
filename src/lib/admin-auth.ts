import 'server-only'

import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

export type AdminSessionResult =
  | { success: true; supabase: ServerSupabaseClient; user: User }
  | { success: false; status: 401 | 403 | 500; error: string }

export async function getAdminSession(): Promise<AdminSessionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, status: 401, error: 'A sua sessão terminou. Inicie sessão novamente.' }
  }

  const { data: isAdmin, error: permissionError } = await supabase.rpc('is_admin')
  if (permissionError) {
    return { success: false, status: 500, error: 'Não foi possível validar as permissões.' }
  }
  if (isAdmin !== true) {
    return { success: false, status: 403, error: 'Não tem autorização para gerir esta área.' }
  }

  return { success: true, supabase, user }
}
