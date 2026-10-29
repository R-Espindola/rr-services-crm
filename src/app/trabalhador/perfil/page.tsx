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

  return <div className="min-h-dvh overflow-x-hidden bg-[#F3F6FA] text-[#0B192C]">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#081426]/95 text-white shadow-xl backdrop-blur-xl"><div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8"><Link href="/trabalhador/agenda" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D4FF] text-sm font-black text-[#0B192C]">R&amp;R</span><span><span className="block text-sm font-extrabold tracking-wide">R&amp;R SERVICES</span><span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">Portal do trabalhador</span></span></Link><span className="hidden text-sm text-slate-300 sm:block">Segurança da conta</span></div></header>
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:py-8 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:px-8">
      <aside className="hidden lg:block"><nav aria-label="Área de trabalho" className="space-y-1"><Link href="/trabalhador/agenda" className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-white"><span>▦</span>Agenda de hoje</Link><Link href="/trabalhador/horas" className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-white"><span>◷</span>Horas trabalhadas</Link><Link href="/trabalhador/perfil" aria-current="page" className="flex min-h-12 items-center gap-3 rounded-xl bg-[#0B192C] px-3 text-sm font-semibold text-white"><span className="text-[#00D4FF]">◎</span>Segurança</Link></nav></aside>
      <section className="min-w-0"><div className="relative isolate overflow-hidden rounded-[28px] bg-[#0B192C] p-6 text-white shadow-xl sm:p-8"><div className="absolute -right-12 -top-20 -z-10 h-56 w-56 rounded-full bg-[#00D4FF]/15 blur-3xl"/><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#70E8FF]">Conta do trabalhador</p><h1 className="mt-3 text-2xl font-black sm:text-3xl">Segurança</h1><p className="mt-2 text-sm leading-6 text-slate-300">Mantenha a sua conta protegida com uma palavra-passe pessoal.</p></div>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="border-b border-slate-100 pb-4"><h2 className="text-lg font-extrabold">Alterar palavra-passe</h2><p className="mt-1 text-sm text-slate-500">A palavra-passe deve ter pelo menos 12 caracteres.</p>{email && <p className="mt-3 text-xs text-slate-400">Conta: <span className="font-semibold text-slate-600">{email}</span></p>}</div>
          <form onSubmit={(event) => void changePassword(event)} className="mt-5 max-w-lg space-y-4"><div><label htmlFor="new-password" className="mb-1.5 block text-xs font-bold text-slate-700">Nova palavra-passe</label><input id="new-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading || saving} className="min-h-12 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50" /></div><div><label htmlFor="confirm-password" className="mb-1.5 block text-xs font-bold text-slate-700">Confirmar nova palavra-passe</label><input id="confirm-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={loading || saving} className="min-h-12 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50" /></div>
            {message && <p role={message.error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${message.error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{message.text}</p>}
            <button type="submit" disabled={loading || saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B192C] px-5 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto">{saving ? 'A atualizar...' : 'Atualizar palavra-passe'}</button>
          </form>
        </div>
      </section>
    </main>
    <nav aria-label="Navegação do trabalhador" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-slate-200 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-lg lg:hidden"><Link href="/trabalhador/agenda" className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500"><span>▦</span><span className="text-[10px] font-bold">Agenda</span></Link><Link href="/trabalhador/horas" className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500"><span>◷</span><span className="text-[10px] font-bold">Horas</span></Link><Link href="/trabalhador/perfil" aria-current="page" className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-sky-800"><span>◎</span><span className="text-[10px] font-extrabold">Segurança</span></Link></nav>
  </div>
}
