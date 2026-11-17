"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ClientBottomNav, { clientDestinations, NavigationIcon } from "./ClientBottomNav";
import { CLIENT_THEME_EVENT, CLIENT_THEME_STORAGE_KEY, isClientTheme } from "./client-theme";

export default function ClientPortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    const root = document.getElementById("client-portal-root");
    if (!root) return;
    const applyTheme = (value: unknown) => {
      root.dataset.clientTheme = isClientTheme(value) ? value : "padrao";
    };
    try {
      applyTheme(window.localStorage.getItem(CLIENT_THEME_STORAGE_KEY));
    } catch {
      applyTheme("padrao");
    }
    const onThemeChange = (event: Event) => applyTheme((event as CustomEvent<unknown>).detail);
    const onStorage = (event: StorageEvent) => {
      if (event.key === CLIENT_THEME_STORAGE_KEY) applyTheme(event.newValue);
    };
    window.addEventListener(CLIENT_THEME_EVENT, onThemeChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CLIENT_THEME_EVENT, onThemeChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  async function signOut() {
    setSignOutError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.replace("/login?force=1");
    } catch {
      setSignOutError("Não foi possível terminar a sessão. Tente novamente.");
    }
  }

  return (
    <div id="client-portal-root" data-client-theme="padrao" className="min-h-dvh overflow-x-hidden bg-[#F4F7FB] text-[#0B192C] [background-image:radial-gradient(circle_at_20%_0%,rgba(0,212,255,0.06),transparent_28rem)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-white/10 bg-[#061121] px-4 py-6 text-white md:flex md:flex-col">
        <Link href="/cliente" className="flex items-center gap-3 rounded-2xl px-2 py-2" aria-label="R&R Services, portal do cliente">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00D4FF] text-sm font-black text-[#0B192C]">R&amp;R</span>
          <span><span className="block text-sm font-extrabold tracking-wide">R&amp;R SERVICES</span><span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">Portal do cliente</span></span>
        </Link>
        <p className="mt-10 px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Área pessoal</p>
        <nav aria-label="Navegação do portal" className="mt-3 flex-1 space-y-1.5 overflow-visible">
          {clientDestinations.map(([href, label, icon]) => {
            const active = pathname === href || (href !== "/cliente" && pathname.startsWith(`${href}/`));
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl border-l-2 px-3 text-[13px] font-semibold transition ${active ? "border-cyan-400 bg-gradient-to-r from-cyan-400/15 to-blue-500/5 text-white shadow-lg shadow-cyan-950/20" : "border-transparent text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${active ? "bg-cyan-400 text-[#061121]" : "bg-white/5 text-slate-500"}`}><NavigationIcon name={icon} /></span>{label}{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400" />}
            </Link>;
          })}
        </nav>
        <a href="mailto:rrservices.pt@gmail.com?subject=Pedido%20de%20apoio%20-%20R%26R%20Services" className="mt-auto inline-flex min-h-8 items-center gap-1.5 px-3 text-xs text-slate-400 transition hover:text-cyan-400"><MessageCircle className="h-3.5 w-3.5" />Precisa de ajuda? Contactar equipa →</a>
        <p className="mt-2 px-3 text-[10px] text-slate-400">© 2026 R&amp;R Services</p>
      </aside>
      <div className="min-h-dvh min-w-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pl-[260px] md:pb-0">
        <header className="sticky top-0 z-30 flex w-full max-w-full items-center justify-between gap-2 overflow-x-hidden border-b border-slate-200/80 bg-white/80 px-4 py-3 text-[#0B1B34] shadow-sm backdrop-blur-md sm:px-6">
          <Link href="/cliente" className="flex min-h-11 items-center gap-3 md:hidden" aria-label="R&R Services, portal do cliente">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00D4FF] text-xs font-black text-[#0B192C]">R&amp;R</span>
            <span><span className="block text-sm font-extrabold tracking-wide">R&amp;R SERVICES</span><span className="block text-[9px] uppercase tracking-[0.16em] text-slate-400">Portal do cliente</span></span>
          </Link>
          <div className="hidden items-center gap-3 md:flex"><div><p className="text-sm font-extrabold">Área do cliente</p><p className="text-xs text-slate-500">{new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p></div><span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Sistema online</span></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void signOut()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#0B1B34] transition hover:border-cyan-300 hover:bg-cyan-50 sm:px-4 sm:text-sm"><LogOut className="h-4 w-4" />Terminar sessão</button>
          </div>
        </header>
        {signOutError && <p role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm font-semibold text-rose-800 sm:px-6">{signOutError}</p>}
        {children}
        <footer className="mx-auto flex max-w-7xl flex-wrap gap-x-4 gap-y-2 px-4 pb-24 pt-2 text-[11px] text-slate-400 sm:px-6 md:pb-6 lg:px-8">
          <a href="/privacidade" className="transition hover:text-sky-700">Política de Privacidade</a>
          <a href="/termos" className="transition hover:text-sky-700">Termos e Condições</a>
          <a href="https://www.livroreclamacoes.pt" target="_blank" rel="noreferrer" className="transition hover:text-sky-700">Livro de Reclamações Eletrónico</a>
        </footer>
      </div>
      <ClientBottomNav />
    </div>
  );
}
