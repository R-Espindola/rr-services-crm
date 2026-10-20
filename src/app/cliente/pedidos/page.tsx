"use client";

import Link from 'next/link';

export default function PedidosPage() {
  return (
    <div className="min-h-screen bg-slate-100 p-8 text-[#0B192C]">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold mb-4">Histórico de Pedidos e Intervenções</h1>
        <p className="text-sm text-slate-600 mb-6">Consulte o estado das suas limpezas, serviços extra e encomendas.</p>
        <Link href="/cliente" className="text-xs font-bold text-[#00D4FF] hover:underline">
          ← Voltar ao Painel do Cliente
        </Link>
      </div>
    </div>
  );
}