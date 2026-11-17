'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Activity, ArrowUpRight, CalendarDays, CheckCircle2, CircleAlert, Clock3, FileText, PackagePlus, Plus, Receipt, TrendingUp, UserPlus, Users } from 'lucide-react';

interface Metric { titulo: string; valor: string | number; sub: string; link: string; icone: string; }
interface Order {
  id: string; client_id: string; service_type: string; scheduled_date: string; total_amount: number; status: string; notes?: string; worker_user_id?: string | null;
  clients?: { name: string; phone: string };
  worker_profiles?: { display_name: string } | null;
}

const formatarPreco = (valor: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(valor);
const inicioDoDia = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };
const fimDoDia = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString(); };
const inicioDoMes = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString(); };

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
      const { count: totalClientes } = await supabase.from('clients').select('*', { count: 'exact', head: true });
      const { data: ordersHoje, error: errorHoje } = await supabase
        .from('orders')
        .select('*, clients!orders_client_id_fkey(name, phone), worker_profiles!orders_assigned_worker_id_fkey(display_name)')
        .gte('scheduled_date', inicioDoDia()).lte('scheduled_date', fimDoDia()).order('scheduled_date', { ascending: true });
      if (errorHoje) throw errorHoje;
      setIntervencoesHoje((ordersHoje || []) as Order[]);

      const { count: orcamentosPendentes, error: orcamentosError } = await supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      if (orcamentosError) throw orcamentosError;
      const { count: servicosConcluidos, error: concluidosError } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'completed');
      if (concluidosError) throw concluidosError;
      const { data: faturacaoMes, error: faturacaoError } = await supabase.from('orders').select('total_amount, scheduled_date').eq('status', 'completed').gte('scheduled_date', inicioDoMes()).lte('scheduled_date', fimDoDia());
      if (faturacaoError) throw faturacaoError;
      const faturacaoTotal = (faturacaoMes || []).reduce((acc, item) => acc + (item.total_amount || 0), 0);
      const { data: pendentes, error: pendentesError } = await supabase.from('orders').select('total_amount').eq('status', 'pending');
      if (pendentesError) throw pendentesError;
      const valoresPendentes = (pendentes || []).reduce((acc, item) => acc + (item.total_amount || 0), 0);
      const { data: clientesRecentes, error: clientesRecentesError } = await supabase.from('clients').select('id, name, created_at').order('created_at', { ascending: false }).limit(3);
      if (clientesRecentesError) throw clientesRecentesError;
      const { data: ordensRecentes, error: ordensRecentesError } = await supabase.from('orders').select('*, clients!orders_client_id_fkey(name)').order('created_at', { ascending: false }).limit(3);
      if (ordensRecentesError) throw ordensRecentesError;

      const registos: { tipo: string; descricao: string; data: string; valor?: number }[] = [];
      (clientesRecentes || []).forEach((c) => registos.push({ tipo: 'Cliente', descricao: `Cliente ${c.name} adicionado`, data: c.created_at || '' }));
      (ordensRecentes || []).forEach((o) => registos.push({ tipo: 'Ordem de Serviço', descricao: `${o.service_type} - ${o.clients?.name || 'Cliente'}`, data: o.created_at || '', valor: o.total_amount }));
      registos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setUltimosRegistos(registos.slice(0, 5));
      setMetricas([
        { titulo: 'CLIENTES', valor: totalClientes || 0, sub: 'Carteira ativa', link: '/admin/clientes', icone: '👥' },
        { titulo: 'SERVIÇOS HOJE', valor: (ordersHoje || []).length, sub: 'Ver agenda', link: '/admin/servicos', icone: '🗓️' },
        { titulo: 'ORÇAMENTOS PENDENTES', valor: orcamentosPendentes || 0, sub: 'A aguardar resposta', link: '/admin/orcamentos', icone: '📄' },
        { titulo: 'SERVIÇOS CONCLUÍDOS', valor: servicosConcluidos || 0, sub: 'Faturados', link: '/admin/servicos', icone: '✅' },
        { titulo: 'FATURAÇÃO (MÊS)', valor: formatarPreco(faturacaoTotal), sub: 'Serviços concluídos', link: '/admin/orcamentos', icone: '💶' },
        { titulo: 'VALORES PENDENTES', valor: formatarPreco(valoresPendentes), sub: 'A receber', link: '/admin/servicos', icone: '⏳' },
      ]);
    } catch (err: unknown) {
      setDashboardError('Erro ao carregar métricas do dashboard.');
      const errorDetails = err instanceof Error ? err.message : (err as { message?: string; details?: string; code?: string } | null)?.message || (err as { message?: string; details?: string; code?: string } | null)?.details || (err as { message?: string; details?: string; code?: string } | null)?.code || JSON.stringify(err);
      console.error('Erro ao carregar métricas do dashboard:', errorDetails);
    } finally { setMetricasLoading(false); }
  }, []);

  useEffect(() => { const request = window.setTimeout(() => { void carregarMetricas(); }, 0); return () => window.clearTimeout(request); }, [carregarMetricas]);

  const intervencoesFiltradas = intervencoesHoje.filter((item) => filtroEstadoHoje === 'todos' || item.status === filtroEstadoHoje);
  const totalHoje = intervencoesHoje.length;
  const concluidasHoje = intervencoesHoje.filter((order) => order.status === 'completed').length;
  const progressoHoje = totalHoje ? Math.round((concluidasHoje / totalHoje) * 100) : 0;
  const metricByTitle = (title: string) => metricas.find((metric) => metric.titulo === title)?.valor ?? '—';
  const statusLabel = (status: string) => status === 'completed' ? 'Concluída' : status === 'cancelled' ? 'Cancelada' : status === 'en_route' ? 'A caminho' : status === 'confirmed' ? 'Confirmada' : status === 'in_progress' ? 'Em execução' : 'Pendente';
  const statusTone = (status: string) => status === 'completed' ? 'border-l-emerald-400' : status === 'cancelled' ? 'border-l-rose-400' : status === 'en_route' ? 'border-l-cyan-400' : status === 'in_progress' ? 'border-l-blue-500' : 'border-l-amber-400';
  const initials = (name?: string) => name?.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '';
  const operationalCards = [
    { icon: CalendarDays, label: 'SERVIÇOS HOJE', metric: 'SERVIÇOS HOJE', href: '/admin/servicos', tone: 'text-cyan-500' },
    { icon: CheckCircle2, label: 'SERVIÇOS CONCLUÍDOS', metric: 'SERVIÇOS CONCLUÍDOS', href: '/admin/servicos', tone: 'text-emerald-500' },
    { icon: Users, label: 'CLIENTES ATIVOS', metric: 'CLIENTES', href: '/admin/clientes', tone: 'text-blue-500' },
    { icon: FileText, label: 'ORÇAMENTOS PENDENTES', metric: 'ORÇAMENTOS PENDENTES', href: '/admin/orcamentos', tone: 'text-violet-500' },
  ];

  return (
    <div className="min-w-0 space-y-5 pb-12 sm:space-y-7">
      {dashboardError && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-xs font-bold text-rose-800 shadow-sm">{dashboardError}</div>}

      <section className="relative isolate overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[#061121] p-5 text-white shadow-[0_24px_60px_rgba(6,17,33,0.16)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-28 -top-36 -z-10 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(0,212,255,0.22),transparent_65%)] blur-2xl" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(330px,0.8fr)] lg:items-center">
          <div><span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" /> Operação em tempo real</span><h1 className="mt-5 max-w-xl text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">Bom dia. Aqui está o pulso da R&R.</h1><p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">Resumo operacional, financeiro e comercial num único centro de comando.</p><div className="mt-7 max-w-xl"><div className="mb-2 flex items-center justify-between text-xs font-bold"><span className="text-slate-300">Progresso do dia</span><span className="tabular-nums text-cyan-200">{concluidasHoje} de {totalHoje} concluídos · {progressoHoje}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-700" style={{ width: `${progressoHoje}%` }} /></div></div></div>
          <div className="grid grid-cols-2 gap-3"><Link href="/admin/servicos" className="col-span-2 flex min-h-14 items-center justify-between rounded-2xl bg-[#00D4FF] px-4 text-sm font-black text-[#061121] shadow-lg shadow-cyan-500/20 transition-all hover:-translate-y-0.5 hover:bg-cyan-300"><span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Agendar Limpeza</span><ArrowUpRight className="h-4 w-4" /></Link><Link href="/admin/clientes" className="flex min-h-14 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-3 text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-white/15"><UserPlus className="h-4 w-4 text-cyan-300" /> Novo Cliente</Link><Link href="/admin/orcamentos" className="flex min-h-14 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-3 text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-white/15"><Receipt className="h-4 w-4 text-cyan-300" /> Criar Orçamento</Link><Link href="/admin/loja" className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-slate-200 transition-all hover:-translate-y-0.5 hover:bg-white/10"><PackagePlus className="h-4 w-4 text-cyan-300" /> Produto / Stock</Link></div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <Link href="/admin/orcamentos" className="group relative overflow-hidden rounded-2xl bg-[#0B1B34] p-5 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl xl:col-span-4"><TrendingUp className="absolute right-5 top-5 h-6 w-6 text-cyan-300" /><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Faturação (mês)</p><p className="mt-4 tabular-nums text-3xl font-extrabold tracking-tight">{metricasLoading ? '—' : metricByTitle('FATURAÇÃO (MÊS)')}</p><p className="mt-2 text-xs font-bold text-cyan-200">Serviços concluídos <ArrowUpRight className="ml-1 inline h-3 w-3 transition-transform group-hover:translate-x-0.5" /></p><div className="mt-5 h-1.5 rounded-full bg-white/10"><div className="h-full w-2/3 rounded-full bg-cyan-400" /></div></Link>
        <Link href="/admin/servicos" className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-white to-amber-50/50 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg xl:col-span-3"><Clock3 className="h-6 w-6 text-amber-500" /><p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Valores pendentes</p><p className="mt-2 tabular-nums text-2xl font-bold text-[#0B1B34]">{metricasLoading ? '—' : metricByTitle('VALORES PENDENTES')}</p><p className="mt-1 text-xs font-bold text-amber-700">A receber</p></Link>
        <div className="grid grid-cols-2 gap-3 xl:col-span-5">{operationalCards.map(({ icon: Icon, label, metric, href, tone }) => <Link key={label} href={href} className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg"><Icon className={`h-5 w-5 ${tone}`} /><p className="mt-3 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-1 tabular-nums text-xl font-extrabold text-[#0B1B34]">{metricasLoading ? '—' : metricByTitle(metric)}</p></Link>)}</div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 xl:col-span-7"><div className="flex flex-col gap-4 border-b border-slate-100 pb-5"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-cyan-500" /><h2 className="text-base font-black text-[#0B1B34]">Agenda de hoje</h2></div><p className="mt-1 text-xs text-slate-500"><span className="tabular-nums font-bold text-slate-700">{totalHoje}</span> serviços planeados para hoje</p></div><Link href="/admin/servicos" className="text-xs font-black text-[#0B1B34] transition hover:text-cyan-600">Ver agenda <ArrowUpRight className="ml-1 inline h-3 w-3" /></Link></div><div className="flex gap-1.5 overflow-x-auto pb-1">{[['todos', 'Todas'], ['pending', 'Pendentes'], ['confirmed', 'Confirmadas'], ['en_route', 'A caminho'], ['in_progress', 'Em Execução'], ['completed', 'Concluídas']].map(([key, label]) => <button key={key} type="button" onClick={() => setFiltroEstadoHoje(key)} className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black transition ${filtroEstadoHoje === key ? 'bg-[#0B1B34] text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{label}</button>)}</div></div>{intervencoesHoje.length === 0 ? <div className="py-14 text-center text-xs font-bold text-slate-400">Nenhuma intervenção agendada para hoje.</div> : intervencoesFiltradas.length === 0 ? <div className="py-14 text-center text-xs font-bold text-slate-400">Nenhum serviço encontrado com este filtro.</div> : <div className="mt-5 space-y-4">{intervencoesFiltradas.map((intervencao, index) => <div key={intervencao.id} className="grid grid-cols-[54px_1fr] gap-3"><div className="relative pt-2 text-right"><p className="tabular-nums text-sm font-black text-slate-900">{new Date(intervencao.scheduled_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</p>{index < intervencoesFiltradas.length - 1 && <span className="absolute right-[-19px] top-9 h-[calc(100%+1rem)] w-px bg-slate-200" />}</div><div className={`rounded-xl border border-slate-200 border-l-4 ${statusTone(intervencao.status)} bg-slate-50/60 p-4 transition hover:bg-white hover:shadow-md`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-[#0B1B34]">{intervencao.clients?.name || 'Cliente'}</p><p className="mt-1 truncate text-xs font-medium text-slate-500">{intervencao.service_type}</p></div><span className="shrink-0 tabular-nums rounded-lg bg-white px-2.5 py-1 text-xs font-black text-[#0B1B34] shadow-sm">{formatarPreco(intervencao.total_amount)}</span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{statusLabel(intervencao.status)}</span>{intervencao.worker_profiles?.display_name ? <span className="flex items-center gap-2 text-[11px] font-bold text-slate-600"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#0B1B34] text-[9px] text-cyan-200">{initials(intervencao.worker_profiles.display_name)}</span>{intervencao.worker_profiles.display_name}</span> : <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800"><CircleAlert className="h-3 w-3" /> Sem funcionário</span>}</div></div></div>)}</div>}</section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 xl:col-span-5"><div className="flex items-center justify-between border-b border-slate-100 pb-5"><div><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-violet-500" /><h2 className="text-base font-black text-[#0B1B34]">Atividade recente</h2></div><p className="mt-1 text-xs text-slate-500">O que mudou no sistema</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">LIVE</span></div>{ultimosRegistos.length === 0 ? <div className="py-14 text-center text-xs font-bold text-slate-400">Sem registos recentes.</div> : <div className="mt-2 divide-y divide-slate-100">{ultimosRegistos.map((registo, index) => <div key={`${registo.tipo}-${index}`} className="group flex items-start gap-3 py-4 transition hover:px-2"><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${registo.tipo === 'Cliente' ? 'bg-emerald-50 text-emerald-600' : 'bg-cyan-50 text-cyan-600'}`}>{registo.tipo === 'Cliente' ? <Users className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{registo.tipo}</p><p className="mt-1 truncate text-xs font-bold text-slate-800">{registo.descricao}</p></div><time className="shrink-0 tabular-nums text-[10px] font-semibold text-slate-400">{new Date(registo.data).toLocaleDateString('pt-PT')}</time></div>)}</div>}</section>
      </div>
    </div>
  );
}
