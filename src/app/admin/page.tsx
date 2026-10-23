'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Metric {
  titulo: string;
  valor: string | number;
  sub: string;
  link: string;
  icone: string;
}

interface Order {
  id: string;
  client_id: string;
  service_type: string;
  scheduled_date: string;
  total_amount: number;
  status: string;
  notes?: string;
  clients?: {
    name: string;
    phone: string;
  };
}

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
}

const formatarPreco = (valor: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(valor);

const formatarDataHora = (dateString: string) => {
  return new Date(dateString).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const inicioDoDia = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const fimDoDia = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

const inicioDoMes = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export default function AdminDashboard() {
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [metricas, setMetricas] = useState<Metric[]>([]);
  const [metricasLoading, setMetricasLoading] = useState(true);
  const [intervencoesHoje, setIntervencoesHoje] = useState<Order[]>([]);
  const [ultimosRegistos, setUltimosRegistos] = useState<{ tipo: string; descricao: string; data: string; valor?: number }[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const carregarMetricas = async () => {
    setMetricasLoading(true);
    setDashboardError(null);

    try {
      // 1. Número de clientes
      const { count: totalClientes } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });

      // 2. Serviços agendados para hoje
      const { data: ordersHoje, error: errorHoje } = await supabase
        .from('orders')
        .select('*, clients(name, phone)')
        .gte('scheduled_date', inicioDoDia())
        .lte('scheduled_date', fimDoDia())
        .order('scheduled_date', { ascending: true });

      if (errorHoje) throw errorHoje;
      setIntervencoesHoje((ordersHoje || []) as Order[]);

      // 3. Orçamentos pendentes
      const { count: orcamentosPendentes } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // 4. Serviços concluídos
      const { count: servicosConcluidos } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      // 5. Faturação registada no mês (ordens concluídas)
      const { data: faturacaoMes } = await supabase
        .from('orders')
        .select('total_amount, scheduled_date')
        .eq('status', 'completed')
        .gte('scheduled_date', inicioDoMes())
        .lte('scheduled_date', fimDoDia());

      const faturacaoTotal = (faturacaoMes || [])
        .reduce((acc, item) => acc + (item.total_amount || 0), 0);

      // 6. Valores pendentes (ordens pendentes)
      const { data: pendentes } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'pending');

      const valoresPendentes = (pendentes || [])
        .reduce((acc, item) => acc + (item.total_amount || 0), 0);

      // Últimos registos (clientes criados recentemente e ordens recentes)
      const { data: clientesRecentes } = await supabase
        .from('clients')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      const { data: ordensRecentes } = await supabase
        .from('orders')
        .select('*, clients(name)')
        .order('created_at', { ascending: false })
        .limit(3);

      const registos: { tipo: string; descricao: string; data: string; valor?: number }[] = [];

      (clientesRecentes || []).forEach((c) => {
        registos.push({
          tipo: 'Cliente',
          descricao: `Cliente ${c.name} adicionado`,
          data: c.created_at || '',
        });
      });

      (ordensRecentes || []).forEach((o) => {
        registos.push({
          tipo: 'Ordem de Serviço',
          descricao: `${o.service_type} - ${o.clients?.name || 'Cliente'}`,
          data: o.created_at || '',
          valor: o.total_amount,
        });
      });

      registos.sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      );
      setUltimosRegistos(registos.slice(0, 5));

      setMetricas([
        {
          titulo: 'CLIENTES',
          valor: totalClientes || 0,
          sub: 'Carteira ativa',
          link: '/admin/clientes',
          icone: '👥',
        },
        {
          titulo: 'SERVIÇOS HOJE',
          valor: (ordersHoje || []).length,
          sub: 'Ver agenda',
          link: '/admin/servicos',
          icone: '🗓️',
        },
        {
          titulo: 'ORÇAMENTOS PENDENTES',
          valor: orcamentosPendentes || 0,
          sub: 'A aguardar resposta',
          link: '/admin/orcamentos',
          icone: '📄',
        },
        {
          titulo: 'SERVIÇOS CONCLUÍDOS',
          valor: servicosConcluidos || 0,
          sub: 'Faturados',
          link: '/admin/servicos',
          icone: '✅',
        },
        {
          titulo: 'FATURAÇÃO (MÊS)',
          valor: formatarPreco(faturacaoTotal),
          sub: 'Serviços concluídos',
          link: '/admin/orcamentos',
          icone: '💶',
        },
        {
          titulo: 'VALORES PENDENTES',
          valor: formatarPreco(valoresPendentes),
          sub: 'A receber',
          link: '/admin/servicos',
          icone: '⏳',
        },
      ]);
    } catch (err) {
      setDashboardError('Erro ao carregar métricas do dashboard.');
      console.error(err);
    } finally {
      setMetricasLoading(false);
    }
  };

  useEffect(() => {
    carregarMetricas();
  }, []);

  return (
    <div className="space-y-6">
      {dashboardError && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 text-sm font-medium text-center">
          {dashboardError}
        </div>
      )}

      {/* 1. AÇÕES RÁPIDAS DE GESTÃO (FIXO NO TOPO) */}
      <section className="bg-[#0B192C] text-white p-5 sm:p-6 rounded-3xl shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#00D4FF]">Ações Rápidas de Gestão</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Crie registos instantâneos sem navegar entre páginas.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full lg:w-auto">
            <Link
              href="/admin/clientes"
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-3 px-3.5 rounded-xl border border-slate-700 transition text-center shadow-sm"
            >
              + Novo Cliente
            </Link>

            <Link
              href="/admin/servicos"
              className="bg-[#00D4FF] hover:bg-[#00c2ea] text-[#0B192C] font-extrabold text-xs py-3 px-3.5 rounded-xl transition text-center shadow-sm"
            >
              + Agendar Limpeza
            </Link>

            <Link
              href="/admin/orcamentos"
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-3 px-3.5 rounded-xl border border-slate-700 transition text-center shadow-sm"
            >
              + Criar Orçamento
            </Link>

            <Link
              href="/admin/loja"
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-3 px-3.5 rounded-xl border border-slate-700 transition text-center shadow-sm"
            >
              + Produto / Stock
            </Link>
          </div>
        </div>
      </section>

      {/* 2. TÍTULO E RESUMO DA PÁGINA */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B192C]">Painel de Controlo Operacional</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Resumo em tempo real da atividade diária, marcações, propostas e stock da R&R Services.
        </p>
      </div>

      {/* 3. CARTÕES DE MÉTRICAS OPERACIONAIS */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {metricasLoading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between group">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Carregando...</span>
                <span className="text-2xl sm:text-3xl font-black text-[#0B192C] block my-2 animate-pulse">-</span>
              </div>
              <span className="text-xs font-bold text-[#00D4FF] group-hover:underline flex items-center gap-1 mt-2">-</span>
            </div>
          ))
        ) : (
          metricas.map((item, idx) => (
            <Link
              key={idx}
              href={item.link}
              className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-[#00D4FF] transition flex flex-col justify-between group"
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
                  {item.titulo}
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[#0B192C] block my-2">
                  {item.valor}
                </span>
              </div>
              <span className="text-xs font-bold text-[#00D4FF] group-hover:underline flex items-center gap-1 mt-2">
                {item.icone} {item.sub}
              </span>
            </Link>
          ))
        )}
      </section>

      {/* 4. BLOCOS DE REGISTOS RECENTES & INTERVENÇÕES DO DIA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Intervenções de Hoje */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-base text-[#0B192C]">🧹 Intervenções Agendadas</h3>
            <Link href="/admin/servicos" className="text-xs font-bold text-[#00D4FF] hover:underline">
              Ver Agenda Completa →
            </Link>
          </div>

          {intervencoesHoje.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center text-slate-400 text-sm">
              Nenhuma intervenção agendada para hoje.
            </div>
          ) : (
            <div className="space-y-3">
              {intervencoesHoje.map((intervencao) => (
                <div key={intervencao.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-md">
                      Hoje • {new Date(intervencao.scheduled_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <h4 className="font-bold text-sm text-[#0B192C] mt-1">{intervencao.clients?.name || 'Cliente'}</h4>
                    <p className="text-xs text-slate-500">{intervencao.service_type}</p>
                  </div>
                  <span className="text-sm font-extrabold text-[#0B192C]">{formatarPreco(intervencao.total_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Últimos Registos */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-base text-[#0B192C]">📋 Últimos Registos do Sistema</h3>
            <Link href="/admin/clientes" className="text-xs font-bold text-[#00D4FF] hover:underline">
              Ver Clientes →
            </Link>
          </div>

          {ultimosRegistos.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">Sem registos recentes.</div>
          ) : (
            <div className="space-y-2 text-xs text-slate-600">
              {ultimosRegistos.map((registo, idx) => (
                <div key={idx} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                  <span>
                    <strong>{registo.descricao}</strong>
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    {new Date(registo.data).toLocaleDateString('pt-PT')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
