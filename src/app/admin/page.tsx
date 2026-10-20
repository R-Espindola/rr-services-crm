"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [stats, setStats] = useState({
    pendentes: 0,
    agendadas: 18,
    faturacao: "2.450 €",
    clientesAtivos: 34
  });

  useEffect(() => {
    fetchAdminData();
  }, []);

  async function fetchAdminData() {
    setLoading(true);

    const { data: quotesData } = await supabase
      .from('quotes')
      .select('*, clients(name, phone, email)')
      .order('created_at', { ascending: false });

    const { data: clientsData } = await supabase
      .from('clients')
      .select('*');

    if (quotesData) {
      setOrcamentos(quotesData);
      const pendentesCount = quotesData.filter(o => o.status === 'pending' || o.status === 'Pendente').length;
      setStats(prev => ({ ...prev, pendentes: pendentesCount }));
    }

    if (clientsData) {
      setStats(prev => ({ ...prev, clientesAtivos: clientsData.length }));
    }

    setLoading(false);
  }

  async function handleMudarStatus(id: string, novoStatus: string) {
    const { error } = await supabase
      .from('quotes')
      .update({ status: novoStatus })
      .eq('id', id);

    if (!error) {
      fetchAdminData();
    } else {
      alert('Erro ao atualizar estado: ' + error.message);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      
      {/* Header Superior */}
      <header className="bg-white border-b border-slate-200 py-4 px-8 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#0B192C]">Painel de Gestão Operacional</h1>
          <p className="text-xs text-slate-500">R&R Services • Portugal (Lisboa/Margem Sul)</p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <span className="block text-sm font-bold text-[#0B192C]">Gestão R&R</span>
            <span className="block text-xs text-slate-500">admin@rrservices.pt</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#0B192C] text-[#00D4FF] flex items-center justify-center font-bold shadow">
            R
          </div>
        </div>
      </header>

      {/* Corpo da Visão Geral */}
      <div className="p-6 md:p-8 space-y-8 max-w-7xl w-full mx-auto">
        
        {/* CARDS KPIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Orçamentos Pendentes</span>
            <div className="text-3xl font-extrabold text-[#0B192C] mt-2">{stats.pendentes}</div>
            <span className="text-xs text-amber-600 font-semibold mt-1 inline-block">Aguardam validação</span>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Limpezas Agendadas</span>
            <div className="text-3xl font-extrabold text-[#0B192C] mt-2">{stats.agendadas}</div>
            <span className="text-xs text-emerald-600 font-semibold mt-1 inline-block">Esta semana</span>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Faturação Estimada</span>
            <div className="text-3xl font-extrabold text-[#00D4FF] mt-2">{stats.faturacao}</div>
            <span className="text-xs text-slate-500 mt-1 inline-block">Mês Corrente</span>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clientes Ativos</span>
            <div className="text-3xl font-extrabold text-[#0B192C] mt-2">{stats.clientesAtivos}</div>
            <span className="text-xs text-indigo-600 font-semibold mt-1 inline-block">Total registados</span>
          </div>
        </div>

        {/* TABELA DE PEDIDOS DE ORÇAMENTO */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-[#0B192C]">Pedidos de Orçamento Recebidos</h2>
              <p className="text-xs text-slate-500">Solicitações vindas do simulador da página inicial</p>
            </div>
            <Link
              href="/admin/dashboard/orcamentos"
              className="text-xs font-bold text-[#00D4FF] hover:underline"
            >
              Ver Todos os Orçamentos →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-600">
                <tr>
                  <th className="p-4">ID / Data</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Serviço / Tipologia</th>
                  <th className="p-4">Frequência</th>
                  <th className="p-4">Estimativa</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">A carregar dados do Supabase...</td></tr>
                ) : orcamentos.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">Nenhum orçamento registado até ao momento.</td></tr>
                ) : (
                  orcamentos.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="p-4">
                        <span className="font-bold text-[#0B192C]">#{String(item.id).substring(0, 6)}</span>
                        <span className="block text-xs text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleDateString('pt-PT') : 'Recente'}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-800">{item.clients?.name || 'Cliente'}</span>
                        <span className="block text-xs text-slate-500">{item.clients?.phone}</span>
                      </td>
                      <td className="p-4">
                        <span>{item.service_type}</span>
                        <span className="block text-xs text-slate-400">Tipo: {item.typology || 'N/A'}</span>
                      </td>
                      <td className="p-4">
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                          {item.frequency || 'Pontual'}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-[#0B192C]">
                        {Number(item.total || item.subtotal || 0).toFixed(2)} €
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          item.status === 'approved' || item.status === 'Aprovado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.status || 'Pendente'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => handleMudarStatus(item.id, 'approved')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          Aprovar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}