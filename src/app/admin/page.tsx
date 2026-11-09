'use client';

import { useEffect, useState, useCallback } from 'react';
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
  worker_user_id?: string | null;
  clients?: {
    name: string;
    phone: string;
  };
  worker_profiles?: { display_name: string } | null;
}

const formatarPreco = (valor: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(valor);

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
  const [metricas, setMetricas] = useState<Metric[]>([]);
  const [metricasLoading, setMetricasLoading] = useState(true);
  const [intervencoesHoje, setIntervencoesHoje] = useState<Order[]>([]);
  const [filtroEstadoHoje, setFiltroEstadoHoje] = useState<string>('todos');
  const [ultimosRegistos, setUltimosRegistos] = useState<{ tipo: string; descricao: string; data: string; valor?: number }[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const carregarMetricas = useCallback(async () => {
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
        .select('*, clients(name, phone), worker_profiles(display_name)')
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
  }, []);

  useEffect(() => {
    const request = window.setTimeout(() => { void carregarMetricas(); }, 0);
    return () => window.clearTimeout(request);
  }, [carregarMetricas]);

  const intervencoesFiltradas = intervencoesHoje.filter(i => {
    if (filtroEstadoHoje === 'todos') return true;
    return i.status === filtroEstadoHoje;
  });

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8 pb-12">
      {dashboardError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-rose-800 text-xs font-bold text-center shadow-sm">
          {dashboardError}
        </div>
      )}

      {/* 1. AÇÕES RÁPIDAS DE GESTÃO (TOPO) */}
      <section className="relative isolate overflow-hidden bg-[#0B192C] text-white p-6 sm:p-8 rounded-[32px] shadow-xl border border-slate-800">
        <div className="absolute -right-16 -top-28 -z-10 h-80 w-80 rounded-full bg-[#00D4FF]/15 blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#70E8FF]">
              <span className="h-2 w-2 rounded-full bg-[#00D4FF] animate-pulse" /> Gestão Executiva
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-3">Ações Rápidas de Gestão</h2>
            <p className="text-xs text-slate-300 mt-1">
              Crie novos registos instantâneos e navegue diretamente para as ferramentas centrais.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
            <Link
              href="/admin/clientes"
              className="bg-white/[0.08] hover:bg-white/[0.15] text-white font-extrabold text-xs h-12 px-4 rounded-2xl border border-white/10 transition flex items-center justify-center text-center shadow-sm"
            >
              + Novo Cliente
            </Link>

            <Link
              href="/admin/servicos"
              className="bg-[#00D4FF] hover:bg-[#00c2ea] text-[#0B192C] font-black text-xs h-12 px-4 rounded-2xl transition flex items-center justify-center text-center shadow-lg shadow-[#00D4FF]/20"
            >
              + Agendar Limpeza
            </Link>

            <Link
              href="/admin/orcamentos"
              className="bg-white/[0.08] hover:bg-white/[0.15] text-white font-extrabold text-xs h-12 px-4 rounded-2xl border border-white/10 transition flex items-center justify-center text-center shadow-sm"
            >
              + Criar Orçamento
            </Link>

            <Link
              href="/admin/loja"
              className="bg-white/[0.08] hover:bg-white/[0.15] text-white font-extrabold text-xs h-12 px-4 rounded-2xl border border-white/10 transition flex items-center justify-center text-center shadow-sm"
            >
              + Produto / Stock
            </Link>
          </div>
        </div>
      </section>

      {/* 2. TÍTULO E RESUMO DA PÁGINA */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#0B192C]">Painel de Controlo Operacional</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Resumo em tempo real da atividade diária, marcações, propostas e stock da R&R Services.
        </p>
      </div>

      {/* 3. CARTÕES DE MÉTRICAS OPERACIONAIS */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {metricasLoading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">A carregar...</span>
                <span className="text-2xl font-black text-[#0B192C] block my-2 animate-pulse">-</span>
              </div>
              <span className="text-xs font-bold text-slate-300">-</span>
            </div>
          ))
        ) : (
          metricas.map((item, idx) => (
            <Link
              key={idx}
              href={item.link}
              className="group flex flex-col justify-between rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:border-[#00D4FF] hover:shadow-xl"
            >
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                  {item.titulo}
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#0B192C] block my-2 tracking-tight">
                  {item.valor}
                </span>
              </div>
              <span className="text-xs font-extrabold text-[#0B192C] group-hover:text-[#00D4FF] flex items-center gap-1.5 transition-colors">
                <span>{item.icone}</span> {item.sub}
              </span>
            </Link>
          ))
        )}
      </section>

      {/* 4. BLOCOS DE REGISTOS RECENTES & INTERVENÇÕES DO DIA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Intervenções de Hoje com Filtros Rápidos */}
        <section className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <h3 className="font-black text-base text-[#0B192C]">🧹 Intervenções Agendadas Hoje</h3>
            <Link href="/admin/servicos" className="text-xs font-extrabold text-[#0B192C] hover:text-[#00D4FF] transition">
              Ver Agenda Completa →
            </Link>
          </div>

          {/* Filtros rápidos de estado */}
          <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/60">
            {[
              ['todos', 'Todas'],
              ['pending', 'Pendentes'],
              ['in_progress', 'Em Execução'],
              ['completed', 'Concluídas']
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFiltroEstadoHoje(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${filtroEstadoHoje === key ? 'bg-[#0B192C] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {intervencoesHoje.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 text-center text-slate-400 text-xs font-bold">
              Nenhuma intervenção agendada para hoje.
            </div>
          ) : intervencoesFiltradas.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 text-center text-slate-400 text-xs font-bold">
              Nenhum serviço encontrado com este filtro.
            </div>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {intervencoesFiltradas.map((intervencao) => (
                <div key={intervencao.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition hover:bg-slate-50">
                  <div className="space-y-1">
                    <span className={`inline-flex rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider ${intervencao.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : intervencao.status === 'cancelled' ? 'bg-rose-100 text-rose-800' : intervencao.status === 'in_progress' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                      {intervencao.status === 'completed' ? 'Concluído' : intervencao.status === 'cancelled' ? 'Cancelado' : intervencao.status === 'in_progress' ? 'Em execução' : 'Pendente'} · {new Date(intervencao.scheduled_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <h4 className="font-extrabold text-sm text-[#0B192C]">{intervencao.clients?.name || 'Cliente'}</h4>
                    <p className="text-xs font-semibold text-slate-600">{intervencao.service_type}</p>
                    <p className="text-xs font-bold text-slate-500">👷 {intervencao.worker_profiles?.display_name || 'Sem funcionário atribuído'}</p>
                  </div>
                  <span className="text-sm font-black text-[#0B192C] bg-white px-3 py-1.5 rounded-xl border border-slate-200/60 shadow-2xs">
                    {formatarPreco(intervencao.total_amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Últimos Registos */}
        <section className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <h3 className="font-black text-base text-[#0B192C]">📋 Últimos Registos do Sistema</h3>
            <Link href="/admin/clientes" className="text-xs font-extrabold text-[#0B192C] hover:text-[#00D4FF] transition">
              Ver Clientes →
            </Link>
          </div>

          {ultimosRegistos.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold">Sem registos recentes.</div>
          ) : (
            <div className="space-y-3">
              {ultimosRegistos.map((registo, idx) => (
                <div key={idx} className="flex justify-between items-center p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#00D4FF] block">{registo.tipo}</span>
                    <strong className="text-xs font-black text-slate-800 block">{registo.descricao}</strong>
                  </div>
                  <span className="text-slate-400 text-xs font-semibold">
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