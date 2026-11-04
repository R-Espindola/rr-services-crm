"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
    <div id="client-portal-root" data-client-theme="padrao" className="min-h-dvh overflow-x-hidden bg-[#F3F6FA] text-[#0B192C]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-slate-200 bg-white px-4 py-6 md:flex md:flex-col">
        <Link href="/cliente" className="flex items-center gap-3 rounded-2xl px-2 py-2" aria-label="R&R Services, portal do cliente">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00D4FF] text-sm font-black text-[#0B192C]">R&amp;R</span>
          <span><span className="block text-sm font-extrabold tracking-wide">R&amp;R SERVICES</span><span className="block text-[10px] uppercase tracking-[0.16em] text-slate-400">Portal do cliente</span></span>
        </Link>
        <p className="mt-10 px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Menu principal</p>
        <nav aria-label="Navegação do portal" className="mt-3 space-y-1.5">
          {clientDestinations.map(([href, label, icon]) => {
            const active = pathname === href || (href !== "/cliente" && pathname.startsWith(`${href}/`));
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition ${active ? "bg-[#0B192C] text-white shadow-lg" : "text-slate-600 hover:bg-slate-100 hover:text-[#0B192C]"}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${active ? "bg-[#00D4FF] text-[#0B192C]" : "bg-slate-100 text-slate-500"}`}><NavigationIcon name={icon} /></span>{label}{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00D4FF]" />}
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
      <div className="min-h-dvh min-w-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pl-[260px] md:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#081426]/95 px-4 py-3 text-white shadow-lg backdrop-blur-xl sm:px-6">
          <Link href="/cliente" className="flex min-h-11 items-center gap-3 md:hidden" aria-label="R&R Services, portal do cliente">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00D4FF] text-xs font-black text-[#0B192C]">R&amp;R</span>
            <span><span className="block text-sm font-extrabold tracking-wide">R&amp;R SERVICES</span><span className="block text-[9px] uppercase tracking-[0.16em] text-slate-400">Portal do cliente</span></span>
          </Link>
          <span className="hidden text-sm font-bold text-slate-200 md:block">Portal do cliente</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void signOut()} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-bold text-slate-100 transition hover:bg-white/10 sm:px-4 sm:text-sm">Terminar sessão</button>
          </div>
        </header>
        {signOutError && <p role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm font-semibold text-rose-800 sm:px-6">{signOutError}</p>}
        {children}
      </div>
      <ClientBottomNav />
    </div>
  );
}
