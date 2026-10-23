"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
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

  const linksMenu = [
    { href: '/admin', label: 'Visão Geral', icone: '📊' },
    { href: '/admin/orcamentos', label: 'Orçamentos', icone: '📄' },
    { href: '/admin/clientes', label: 'Clientes', icone: '👥' },
    { href: '/admin/servicos', label: 'Agenda & Equipas', icone: '📅' },
    { href: '/admin/loja', label: 'Loja & Stock', icone: '🛒' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-[#0B192C] font-sans flex flex-col md:flex-row">
      
      {/* 1. BARRA LATERAL DESKTOP */}
      <aside className="hidden md:flex md:w-64 bg-[#0B192C] text-white flex-col justify-between p-6 border-r border-slate-800 shrink-0 sticky top-0 h-screen">
        <div className="space-y-8">
          <Link href="/admin" className="flex items-center space-x-2">
            <span className="text-2xl font-extrabold text-[#00D4FF]">R&R</span>
            <span className="text-lg font-bold text-slate-100">CRM Gestor</span>
          </Link>

          <nav className="space-y-2">
            {linksMenu.map((item) => {
              const ativo = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-sm transition ${
                    ativo 
                      ? 'bg-[#00D4FF] text-[#0B192C] shadow' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>{item.icone}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800">
          <Link href="/" className="flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition">
            <span>🌐</span>
            <span>Voltar ao Site Principal</span>
          </Link>
        </div>
      </aside>

      {/* 2. HEADER E MENU MÓVEL PARA TELEMÓVEIS / IPHONES */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 sm:px-8 py-4 flex justify-between items-center shadow-sm">
          
          <div className="flex items-center space-x-3">
            {/* Botão Hambúrguer para Telemóvel */}
            <button
              onClick={() => setMenuMobileAberto(!menuMobileAberto)}
              className="md:hidden p-2.5 rounded-xl bg-slate-100 text-[#0B192C] font-bold text-lg focus:outline-none"
              aria-label="Abrir Menu"
            >
              ☰
            </button>
            
            <div>
              <h1 className="text-base sm:text-xl font-extrabold text-[#0B192C]">Painel de Gestão R&R</h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">Sistema Operacional & Comercial • Portugal</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleLogout}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-3.5 py-2 rounded-xl transition border border-rose-200"
            >
              Terminar Sessão
            </button>
          </div>
        </header>

        {/* Menu Deslizante para Telemóveis / iPhones */}
        {menuMobileAberto && (
          <div className="md:hidden bg-[#0B192C] text-white p-4 space-y-2 text-sm border-b border-slate-800 shadow-xl fixed inset-x-0 top-[73px] z-50">
            {linksMenu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuMobileAberto(false)}
                className="flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-sm text-slate-200 hover:bg-slate-800"
              >
                <span>{item.icone}</span>
                <span>{item.label}</span>
              </Link>
            ))}
            <div className="pt-3 border-t border-slate-800">
              <Link href="/" onClick={() => setMenuMobileAberto(false)} className="block py-2 text-slate-400 text-xs">
                🌐 Voltar ao Site Principal
              </Link>
            </div>
          </div>
        )}

        {/* Conteúdo Dinâmico das Páginas */}
        <main className="p-4 sm:p-8 flex-1 max-w-7xl w-full mx-auto">
          {children}
        </main>

      </div>
    </div>
  );
}