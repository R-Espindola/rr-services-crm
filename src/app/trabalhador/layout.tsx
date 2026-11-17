'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, Clock3, House, LogOut, UserRound } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const destinations = [
  ['/trabalhador/agenda', 'Agenda de hoje', CalendarDays],
  ['/trabalhador/turno', 'Turno e pausas', Clock3],
  ['/trabalhador/horas', 'Horas trabalhadas', Clock3],
  ['/trabalhador/perfil', 'Segurança / Perfil', UserRound],
] as const

export default function WorkerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#F4F7FB] text-[#0B192C]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[270px] flex-col border-r border-slate-800/80 bg-[#061121] px-5 py-6 text-white lg:flex">
        <Link href="/trabalhador/agenda" className="flex items-center gap-3 rounded-2xl px-2 py-2" aria-label="R&R Services, portal do trabalhador">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00D4FF] text-sm font-black text-[#061121]">R&amp;R</span>
          <span><span className="block text-sm font-extrabold tracking-wide">R&amp;R SERVICES</span><span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">Portal do trabalhador</span></span>
        </Link>
        <p className="mt-10 px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Operação</p>
        <nav aria-label="Navegação do trabalhador" className="mt-3 flex-1 space-y-1.5">
          {destinations.map(([href, label, Icon]) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl border-l-2 px-3 text-[13px] font-semibold transition ${active ? 'border-cyan-400 bg-gradient-to-r from-cyan-400/15 to-blue-500/5 text-white shadow-lg shadow-cyan-950/20' : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-cyan-400 text-[#061121]' : 'bg-white/5 text-cyan-300'}`}><Icon className="h-4 w-4" strokeWidth={1.8} /></span>{label}{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400" />}
            </Link>
          })}
        </nav>
        <p className="px-3 pb-16 text-[10px] font-semibold text-slate-500">© 2026 R&amp;R Services</p>
      </aside>

      <div className="min-h-dvh min-w-0 lg:pl-[270px]">
        <header className="sticky top-0 z-50 flex w-full max-w-full items-center justify-between gap-3 overflow-x-hidden border-b border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-md sm:px-6 lg:px-10">
          <Link href="/trabalhador/agenda" className="flex min-h-11 items-center gap-3 lg:hidden" aria-label="R&R Services, portal do trabalhador">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00D4FF] text-xs font-black text-[#061121]">R&amp;R</span>
            <span><span className="block text-sm font-extrabold tracking-wide text-[#061121]">R&amp;R SERVICES</span><span className="block text-[9px] uppercase tracking-[0.16em] text-cyan-700">Portal do trabalhador</span></span>
          </Link>
          <div className="hidden items-center gap-2 text-sm font-bold text-[#061121] lg:flex"><House className="h-4 w-4 text-cyan-600" />Equipa operacional</div>
          <button type="button" disabled={signingOut} onClick={() => void signOut()} className="ml-auto inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#061121] transition hover:border-cyan-300 hover:bg-cyan-50 disabled:opacity-60 sm:px-4 sm:text-sm"><LogOut className="h-4 w-4" />{signingOut ? 'A terminar...' : 'Terminar sessão'}</button>
        </header>
        <main className="min-w-0">{children}</main>
      </div>

      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-slate-200/80 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_rgba(11,25,44,0.08)] backdrop-blur-xl lg:hidden">
        {destinations.map(([href, label, Icon]) => { const active = pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border-t-2 text-[10px] font-bold transition ${active ? 'border-cyan-400 text-[#061121]' : 'border-transparent text-slate-500'}`}><Icon className={`h-5 w-5 ${active ? 'text-cyan-600' : ''}`} strokeWidth={1.8} /><span>{label}</span></Link> })}
      </nav>
    </div>
  )
}
