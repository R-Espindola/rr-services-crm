"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; path=/; max-age=0';
    router.push('/login');
  };

  const navItems = [
    { href: '/admin', label: 'Visão Geral', icon: '📊' },
    { href: '/admin/dashboard/orcamentos', label: 'Orçamentos', icon: '📋' },
    { href: '/admin/dashboard/clientes', label: 'Clientes', icon: '👥' },
    { href: '/admin/dashboard/servicos', label: 'Agenda & Equipas', icon: '📅' },
    { href: '/admin/dashboard/loja', label: 'Loja & Stock', icon: '🛒' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex text-[#0B192C]">
      
      {/* MENU LATERAL FIXO */}
      <aside className="w-64 bg-[#0B192C] text-white flex flex-col justify-between hidden md:flex shrink-0">
        <div>
          {/* Logo */}
          <div className="p-6 border-b border-slate-800 flex items-center space-x-2">
            <span className="text-2xl font-extrabold text-[#00D4FF]">R&R</span>
            <span className="text-lg font-semibold text-slate-200">CRM Gestor</span>
          </div>

          {/* Navegação */}
          <nav className="p-4 space-y-1 text-sm font-medium">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${
                    isActive
                      ? 'bg-[#00D4FF] text-[#0B192C] font-bold shadow-md'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Rodapé da Sidebar */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <Link
            href="/"
            className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
          >
            <span>🌐 Voltar ao Site</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <span>🚪 Terminar Sessão</span>
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL DE CADA PÁGINA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </div>

    </div>
  );
}