"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const destinations = [
  ["/cliente", "Visão geral", "⌂"],
  ["/cliente/pedidos", "As minhas marcações", "▦"],
  ["/cliente/extras", "Serviços extra", "✦"],
  ["/cliente/loja", "Loja de produtos", "▣"],
  ["/cliente/perfil", "O meu perfil", "◎"],
] as const;

export default function ClientPortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function signOut() {
    setSignOutError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setMobileMenuOpen(false);
      window.location.replace("/login?force=1");
    } catch {
      setSignOutError("Não foi possível terminar a sessão. Tente novamente.");
    }
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#F3F6FA] text-[#0B192C]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-slate-200 bg-white px-4 py-6 lg:flex lg:flex-col">
        <Link href="/cliente" className="flex items-center gap-3 rounded-2xl px-2 py-2" aria-label="R&R Services, portal do cliente">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00D4FF] text-sm font-black text-[#0B192C]">R&amp;R</span>
          <span><span className="block text-sm font-extrabold tracking-wide">R&amp;R SERVICES</span><span className="block text-[10px] uppercase tracking-[0.16em] text-slate-400">Portal do cliente</span></span>
        </Link>
        <p className="mt-10 px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Menu principal</p>
        <nav aria-label="Navegação do portal" className="mt-3 space-y-1.5">
          {destinations.map(([href, label, icon]) => {
            const active = pathname === href || (href !== "/cliente" && pathname.startsWith(`${href}/`));
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition ${active ? "bg-[#0B192C] text-white shadow-lg" : "text-slate-600 hover:bg-slate-100 hover:text-[#0B192C]"}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${active ? "bg-[#00D4FF] text-[#0B192C]" : "bg-slate-100 text-slate-500"}`}>{icon}</span>{label}{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00D4FF]" />}
            </Link>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl bg-gradient-to-br from-[#0B192C] to-[#173957] p-4 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00D4FF] text-[#0B192C]">✦</span>
          <p className="mt-4 text-sm font-extrabold">Um apoio sempre por perto</p>
          <p className="mt-2 text-xs leading-5 text-slate-300">Precisa de ajuda com uma marcação? Estamos disponíveis para si.</p>
          <a href="mailto:rrservices.pt@gmail.com?subject=Pedido%20de%20apoio%20-%20R%26R%20Services" className="mt-4 inline-flex min-h-11 items-center text-xs font-bold text-[#00D4FF] hover:underline">Contactar equipa →</a>
        </div>
        <p className="mt-5 px-3 text-[10px] text-slate-400">© 2026 R&amp;R Services</p>
      </aside>
      <div className="min-h-dvh lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#081426]/95 px-4 py-3 text-white shadow-lg backdrop-blur-xl sm:px-6">
          <Link href="/cliente" className="flex min-h-11 items-center gap-3 lg:hidden" aria-label="R&R Services, portal do cliente">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00D4FF] text-xs font-black text-[#0B192C]">R&amp;R</span>
            <span><span className="block text-sm font-extrabold tracking-wide">R&amp;R SERVICES</span><span className="block text-[9px] uppercase tracking-[0.16em] text-slate-400">Portal do cliente</span></span>
          </Link>
          <span className="hidden text-sm font-bold text-slate-200 lg:block">Portal do cliente</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void signOut()} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-bold text-slate-100 transition hover:bg-white/10 sm:px-4 sm:text-sm">Terminar sessão</button>
            <button type="button" aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileMenuOpen} aria-controls="client-mobile-sidebar" onClick={() => setMobileMenuOpen((open) => !open)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-lg transition hover:bg-white/10 lg:hidden">{mobileMenuOpen ? "×" : "☰"}</button>
          </div>
        </header>
        {signOutError && <p role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm font-semibold text-rose-800 sm:px-6">{signOutError}</p>}
        {mobileMenuOpen && <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-[#06101e]/60" />
          <aside id="client-mobile-sidebar" className="relative flex h-full w-[min(86vw,320px)] flex-col bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-1 pb-4">
              <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Menu do cliente</span>
              <button type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-xl text-slate-500 hover:bg-slate-100">×</button>
            </div>
            <nav aria-label="Navegação do portal" className="mt-4 space-y-1.5">
              {destinations.map(([href, label, icon]) => {
                const active = pathname === href || (href !== "/cliente" && pathname.startsWith(`${href}/`));
                return <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${active ? "bg-[#0B192C] text-white" : "text-slate-600 hover:bg-slate-100"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-[#00D4FF] text-[#0B192C]" : "bg-slate-100 text-slate-500"}`}>{icon}</span>{label}</Link>;
              })}
            </nav>
          </aside>
        </div>}
        {children}
      </div>
    </div>
  );
}
