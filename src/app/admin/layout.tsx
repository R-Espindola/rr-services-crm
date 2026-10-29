'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const linksMenu = [
  { href: '/admin', label: 'Visão Geral', short: 'Início', icone: '📊' },
  { href: '/admin/orcamentos', label: 'Orçamentos', short: 'Orçamentos', icone: '📄' },
  { href: '/admin/clientes', label: 'Clientes', short: 'Clientes', icone: '👥' },
  { href: '/admin/servicos', label: 'Agenda & Equipas', short: 'Agenda', icone: '📅' },
  { href: '/admin/loja', label: 'Loja & Stock', short: 'Loja', icone: '🛒' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/login');
    } catch (err) {
      console.error('Erro ao terminar sessão:', err);
    }
  };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#F5F7FA] text-[#0B192C] dark:bg-slate-950 dark:text-slate-100 lg:flex">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/10 bg-[#0B192C] text-white shadow-xl shadow-slate-950/10 transition-[width] duration-200 lg:flex ${collapsed ? 'w-[76px]' : 'w-64'}`}>
        <Link href="/admin" className={`flex h-20 shrink-0 items-center ${collapsed ? 'justify-center' : 'gap-3 px-6'}`}>
          <span className="text-2xl font-extrabold text-[#00D4FF]">R&amp;R</span>
          {!collapsed && <span className="font-bold text-slate-100">CRM Gestor</span>}
        </Link>
        <nav aria-label="Navegação principal" className="flex-1 space-y-1 px-3 py-4">
          {linksMenu.map((item) => {
            const ativo = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`));
            return (
              <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} aria-current={ativo ? 'page' : undefined}
                className={`flex min-h-12 items-center rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF] ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} ${ativo ? 'bg-[#00D4FF] text-[#0B192C] shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                <span aria-hidden="true" className="text-base">{item.icone}</span>
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-white/10 p-3">
          <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} className="min-h-11 w-full rounded-xl text-sm text-slate-300 hover:bg-white/10 hover:text-white">
            {collapsed ? '»' : 'Recolher menu «'}
          </button>
          {!collapsed && <Link href="/" className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white"><span>🌐</span><span>Voltar ao Site Principal</span></Link>}
        </div>
      </aside>

      <div className={`flex min-h-dvh min-w-0 flex-1 flex-col transition-[margin] duration-200 ${collapsed ? 'lg:ml-[76px]' : 'lg:ml-64'}`}>
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/90 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold tracking-tight sm:text-lg">Painel de Gestão R&amp;R</h1>
            <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">Sistema Operacional &amp; Comercial · Portugal</p>
          </div>
          <button type="button" onClick={handleLogout} className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-3.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            Terminar Sessão
          </button>
        </header>
        <div className="mx-auto w-full min-w-0 flex-1 px-3 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 lg:px-8 lg:py-8 lg:pb-8">
          {children}
        </div>
      </div>

      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-12px_36px_rgba(15,23,42,0.10)] backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-slate-900/95">
        {linksMenu.map((item) => {
          const ativo = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`));
          return <Link key={item.href} href={item.href} aria-current={ativo ? 'page' : undefined} className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold transition-colors sm:text-[11px] ${ativo ? 'bg-cyan-50 text-[#007F99] dark:bg-cyan-950/50 dark:text-[#00D4FF]' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5'}`}>
            <span aria-hidden="true" className="text-lg leading-5">{item.icone}</span><span className="max-w-full truncate">{item.short}</span>
          </Link>;
        })}
      </nav>
    </div>
  );
}
