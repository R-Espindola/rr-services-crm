'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function WorkerSecurityPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  useEffect(() => {
    const request = window.setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email ?? '')
      setLoading(false)
    }, 0)
    return () => window.clearTimeout(request)
  }, [])

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    if (password.length < 12) {
      setMessage({ text: 'A nova palavra-passe deve ter pelo menos 12 caracteres.', error: true })
      return
    }
    if (password !== confirmation) {
      setMessage({ text: 'As palavras-passe não coincidem.', error: true })
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPassword('')
      setConfirmation('')
      setMessage({ text: 'Palavra-passe alterada com sucesso.', error: false })
    } catch {
      setMessage({ text: 'Não foi possível alterar a palavra-passe. Confirme a sessão e tente novamente.', error: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F6FA] text-[#0B192C]">
      {/* Header Superior Moderno */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#081426]/95 text-white shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1550px] items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/trabalhador" className="flex items-center gap-3.5 group">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00D4FF] text-sm font-black text-[#0B192C] shadow-lg shadow-[#00D4FF]/20 group-hover:scale-105 transition">R&R</span>
            <div>
              <span className="block text-sm font-black tracking-wider">R&R SERVICES</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.25em] text-[#00D4FF]">Portal do Trabalhador</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs font-semibold text-slate-300 sm:block bg-white/[0.06] px-3.5 py-2 rounded-xl border border-white/5">🔒 Segurança da Conta</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1550px] lg:grid-cols-[270px_minmax(0,1fr)]">
        {/* Sidebar Moderna */}
        <aside className="hidden border-r border-slate-200/80 bg-white/85 backdrop-blur-md px-5 py-8 lg:block min-h-[calc(100vh-5rem)]">
          <p className="px-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Navegação</p>
          <nav aria-label="Área de trabalho" className="mt-4 space-y-2">
            <Link href="/trabalhador" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">🏠</span>Início (Dashboard)
            </Link>
            <Link href="/trabalhador/agenda" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">📅</span>Agenda de hoje
            </Link>
            <Link href="/trabalhador/turno" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">⏱️</span>Turno e pausas
            </Link>
            <Link href="/trabalhador/horas" className="flex h-12 items-center gap-3.5 rounded-2xl px-4 text-xs font-bold text-slate-600 hover:bg-slate-100/80 transition">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">⏱️</span>Horas trabalhadas
            </Link>
            <Link href="/trabalhador/perfil" aria-current="page" className="flex h-12 items-center gap-3.5 rounded-2xl bg-[#0B192C] px-4 text-xs font-bold text-white shadow-xl shadow-[#0B192C]/15">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#00D4FF] text-[#0B192C] text-xs font-black">🔒</span>Segurança / Perfil
              <span className="ml-auto h-2 w-2 rounded-full bg-[#00D4FF]" />
            </Link>
          </nav>
          
          <div className="mt-12 rounded-3xl bg-gradient-to-br from-[#0B192C] to-[#173957] p-5 text-white shadow-xl relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-[#00D4FF]/10 blur-xl" />
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00D4FF] text-sm text-[#0B192C] font-black">✦</span>
            <p className="mt-4 text-xs font-black tracking-wide">Segurança reforçada</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">Atualize regularmente a sua palavra-passe para proteger a sua conta.</p>
          </div>
          <p className="mt-10 px-3 text-[10px] font-semibold text-slate-400">© 2026 R&R Services</p>
        </aside>

        {/* Conteúdo Principal */}
        <main className="min-w-0 px-6 pb-28 pt-8 sm:px-10 lg:px-12 space-y-8 max-w-4xl">
          {/* Banner de Segurança */}
          <section className="relative isolate overflow-hidden rounded-[32px] bg-[#0B192C] p-8 text-white shadow-2xl sm:p-10">
            <div className="absolute -right-16 -top-28 -z-10 h-80 w-80 rounded-full bg-[#00D4FF]/15 blur-3xl pointer-events-none" />
            
            <span className="inline-flex items-center gap-2 rounded-full border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#70E8FF]">
              <span className="h-2 w-2 rounded-full bg-[#00D4FF] animate-pulse" /> Conta do Trabalhador
            </span>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Segurança</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">Mantenha a sua conta protegida com uma palavra-passe pessoal e segura.</p>
          </section>

          {/* Formulário de Alteração de Palavra-passe */}
          <div className="rounded-[32px] border border-slate-200/80 bg-white p-8 shadow-sm">
            <div className="border-b border-slate-100 pb-5">
              <h2 className="text-lg font-black text-slate-900">Alterar palavra-passe</h2>
              <p className="mt-1 text-xs text-slate-500">A nova palavra-passe deve conter pelo menos 12 caracteres.</p>
              {email && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600">
                  <span>✉️ Conta associada:</span> <strong className="text-slate-900 font-bold">{email}</strong>
                </div>
              )}
            </div>

            <form onSubmit={(event) => void changePassword(event)} className="mt-6 max-w-lg space-y-5">
              <div>
                <label htmlFor="new-password" className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-700">Nova palavra-passe</label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading || saving}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 text-xs font-semibold text-slate-800 outline-none focus:border-[#00D4FF] focus:ring-2 focus:ring-[#00D4FF]/30 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-700">Confirmar nova palavra-passe</label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={loading || saving}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 text-xs font-semibold text-slate-800 outline-none focus:border-[#00D4FF] focus:ring-2 focus:ring-[#00D4FF]/30 disabled:bg-slate-100"
                />
              </div>

              {message && (
                <div role={message.error ? 'alert' : 'status'} className={`rounded-2xl border p-4 text-xs font-bold ${message.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || saving}
                className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-[#0B192C] px-8 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 shadow-md"
              >
                {saving ? 'A atualizar...' : 'Atualizar palavra-passe'}
              </button>
            </form>
          </div>
        </main>
      </div>

      {/* Barra de Navegação Móvel Inferior (Bottom Nav) */}
      <nav aria-label="Navegação do trabalhador" className="fixed inset-x-4 bottom-4 z-40 grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-2xl backdrop-blur-xl lg:hidden">
        <Link href="/trabalhador/agenda" className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500 transition hover:bg-slate-100 font-bold">
          <span className="text-base">📅</span>
          <span className="text-[10px]">Agenda</span>
        </Link>
        <Link href="/trabalhador/horas" className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500 transition hover:bg-slate-100 font-bold">
          <span className="text-base">⏱️</span>
          <span className="text-[10px]">Horas</span>
        </Link>
        <Link href="/trabalhador/perfil" aria-current="page" className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-[#0B192C] text-[#00D4FF] shadow-md">
          <span className="text-base">🔒</span>
          <span className="text-[10px] font-black">Segurança</span>
        </Link>
      </nav>
    </div>
  )
}
