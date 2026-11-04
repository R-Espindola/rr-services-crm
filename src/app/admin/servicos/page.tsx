'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ServiceMetrics from './ServiceMetrics';
import BookingDetailsModal from './BookingDetailsModal';
import { agendarLimpezasRecorrentes, atribuirFuncionarioAMarcacao, listAssignableWorkers, type AssignableWorker } from './actions';

export interface Order {
  id: string;
  client_id: string;
  service_type: string;
  scheduled_date: string;
  total_amount: number;
  status: string;
  payment_status?: string | null; // Adicionado para controlo financeiro
  worker_user_id?: string | null;
  notes?: string;
  clients?: {
    name: string;
    phone: string;
  };
}

export type ServiceBooking = Order;

export interface ClientOption {
  id: string;
  name: string;
  phone: string;
}

interface PricingRule {
  id: string;
  valid_from: string;
  service_type: string;
  frequency: string;
  typology: string;
  base_price: number | string;
  extra_hourly_rate: number | string;
}

const SERVICE_TYPES = [
  'Limpeza Residencial',
  'Limpeza Comercial / Escritórios',
  'Higienização de Estofados',
  'Limpeza Profunda / Pós-Obra',
  'Vidros e Caixilharia',
] as const;

const defaultPricingFrequency = (type: string) => {
  if (type === 'Higienização de Estofados' || type === 'Limpeza Profunda / Pós-Obra' || type === 'Vidros e Caixilharia') return 'pontual';
  if (type === 'Limpeza Comercial / Escritórios') return 'semanal';
  return 'semanal';
};

const todayLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

function latestPricingRules(rules: PricingRule[], serviceType: string, frequency: string) {
  const latestByTypology = new Map<string, PricingRule>();
  rules
    .filter((rule) => rule.service_type === serviceType && rule.frequency === frequency && rule.valid_from <= todayLocal())
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from))
    .forEach((rule) => {
      if (!latestByTypology.has(rule.typology)) latestByTypology.set(rule.typology, rule);
    });
  return [...latestByTypology.values()];
}

export default function AgendaPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [clientsList, setClientsList] = useState<ClientOption[]>([]);
  const [workersList, setWorkersList] = useState<AssignableWorker[]>([]);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [assignmentBusy, setAssignmentBusy] = useState<string | null>(null);
  const [assignmentFeedback, setAssignmentFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'tabela' | 'calendario'>('tabela');
  const [calendarSubView, setCalendarSubView] = useState<'mensal' | 'semanal' | 'diario'>('mensal');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Modais e Seleções
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Order | null>(null);
  
  // Filtros e Ordenação
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Estado do Modal de Novo Agendamento
  const [submitting, setSubmitting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedWorkerUserId, setSelectedWorkerUserId] = useState('');
  const [frequency, setFrequency] = useState<'once' | 'weekly' | 'biweekly'>('once');
  const [occurrences, setOccurrences] = useState(6);
  const [serviceType, setServiceType] = useState('Limpeza Residencial');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [totalAmount, setTotalAmount] = useState('60.00');
  const [notes, setNotes] = useState('');
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [pricingRulesLoading, setPricingRulesLoading] = useState(true);
  const [pricingRulesError, setPricingRulesError] = useState(false);
  const [pricingFrequency, setPricingFrequency] = useState('semanal');
  const [typology, setTypology] = useState('');
  const [matchedPrice, setMatchedPrice] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchClients();
    fetchWorkers();
    fetchPricingRules();
  }, []);

  async function fetchPricingRules() {
    setPricingRulesLoading(true);
    setPricingRulesError(false);
    try {
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('id, valid_from, service_type, frequency, typology, base_price, extra_hourly_rate')
        .lte('valid_from', todayLocal())
        .order('valid_from', { ascending: false });
      if (error) throw error;
      const loadedRules = (data ?? []) as PricingRule[];
      setPricingRules(loadedRules);
      const initialRule = latestPricingRules(loadedRules, 'Limpeza Residencial', 'semanal')[0];
      if (initialRule) {
        setTypology(initialRule.typology);
        setTotalAmount(Number(initialRule.base_price).toFixed(2));
        setMatchedPrice(true);
      }
    } catch {
      setPricingRulesError(true);
    } finally {
      setPricingRulesLoading(false);
    }
  }

  function handlePricingSelection(nextServiceType: string, nextFrequency: string, requestedTypology?: string) {
    setServiceType(nextServiceType);
    setPricingFrequency(nextFrequency);
    const options = latestPricingRules(pricingRules, nextServiceType, nextFrequency);
    const nextRule = options.find((rule) => rule.typology === requestedTypology) ?? options[0];
    setTypology(nextRule?.typology ?? '');
    if (nextRule) {
      setTotalAmount(Number(nextRule.base_price).toFixed(2));
      setMatchedPrice(true);
    } else {
      setTotalAmount('');
      setMatchedPrice(false);
    }
  }

  const availableFrequencies = [...new Set(pricingRules
    .filter((rule) => rule.service_type === serviceType && rule.valid_from <= todayLocal())
    .map((rule) => rule.frequency))];
  const availablePricingRules = latestPricingRules(pricingRules, serviceType, pricingFrequency);
  const selectedPricingRule = availablePricingRules.find((rule) => rule.typology === typology);

  async function fetchWorkers() {
    setWorkersLoading(true);
    try {
      const result = await listAssignableWorkers();
      if (result.success) setWorkersList(result.data);
      else setAssignmentFeedback({ message: result.error, error: true });
    } catch {
      setAssignmentFeedback({ message: 'Não foi possível carregar os funcionários.', error: true });
    } finally {
      setWorkersLoading(false);
    }
  }

  async function fetchOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, clients(name, phone)')
      .order('scheduled_date', { ascending: sortOrder === 'asc' });

    if (!error && data) {
      setOrders(data as Order[]);
    }
    setLoading(false);
  }

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, phone')
      .order('name', { ascending: true });

    if (data) {
      setClientsList(data as ClientOption[]);
    }
  }

  function handleOpenAddModalForDate(dateStr?: string, timeStr?: string) {
    if (dateStr) setScheduledDate(dateStr);
    else {
      const today = new Date().toISOString().split('T')[0];
      setScheduledDate(today);
    }
    if (timeStr) setScheduledTime(timeStr);
    setAssignmentFeedback(null);
    setShowAddModal(true);
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId) {
      setAssignmentFeedback({ message: 'Por favor, selecione um cliente.', error: true });
      return;
    }

    setSubmitting(true);
    setAssignmentFeedback(null);
    try {
      const result = await agendarLimpezasRecorrentes({
        clientId: selectedClientId,
        serviceType,
        date: scheduledDate,
        time: scheduledTime,
        totalAmount: Number(totalAmount),
        notes,
        workerUserId: selectedWorkerUserId || null,
        frequency,
        occurrences: frequency === 'once' ? 1 : occurrences,
      });

      if (!result.success) {
        setAssignmentFeedback({ message: result.error, error: true });
        return;
      }

      const count = result.data.count;
      setAssignmentFeedback({
        message: `${count} ${count === 1 ? 'limpeza agendada' : 'limpezas agendadas'} com sucesso!`,
        error: false,
      });
      setShowAddModal(false);
      setSelectedClientId('');
      setSelectedWorkerUserId('');
      setScheduledDate('');
      setNotes('');
      setFrequency('once');
      setOccurrences(6);
      await fetchOrders();
    } catch {
      setAssignmentFeedback({ message: 'Ocorreu um erro ao agendar as limpezas. Tente novamente.', error: true });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      alert('Erro ao atualizar estado: ' + error.message);
    } else {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    }
  }

  // Função para atualizar o estado de pagamento (Pago / Falta Pagar)
  async function handlePaymentStatusChange(id: string, newPaymentStatus: string) {
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: newPaymentStatus })
      .eq('id', id);

    if (error) {
      alert('Erro ao atualizar pagamento: ' + error.message);
    } else {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, payment_status: newPaymentStatus } : o));
    }
  }

  async function handleWorkerAssignment(orderId: string, workerUserId: string) {
    const previous = orders.find((order) => order.id === orderId)?.worker_user_id ?? null;
    setAssignmentBusy(orderId);
    setAssignmentFeedback(null);
    try {
      const result = await atribuirFuncionarioAMarcacao(orderId, workerUserId);
      if (!result.success) {
        setAssignmentFeedback({ message: result.error, error: true });
        return;
      }
      setOrders((current) => current.map((order) => order.id === orderId
        ? { ...order, worker_user_id: result.data.workerUserId }
        : order));
      setAssignmentFeedback({
        message: result.data.workerName ? `Marcação atribuída a ${result.data.workerName}.` : 'A marcação ficou sem funcionário atribuído.',
        error: false,
      });
    } catch {
      setAssignmentFeedback({ message: 'Não foi possível guardar a atribuição. Tente novamente.', error: true });
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, worker_user_id: previous } : order));
    } finally {
      setAssignmentBusy(null);
    }
  }

  async function handleDeleteOrder(id: string, clientName: string) {
    if (!confirm(`Tem a certeza de que pretende eliminar a limpeza de ${clientName}?`)) {
      return;
    }

    const { error } = await supabase.from('orders').delete().eq('id', id);

    if (error) {
      alert('Erro ao eliminar limpeza: ' + error.message);
    } else {
      setOrders(prev => prev.filter(o => o.id !== id));
    }
  }

  const filteredOrders = orders
    .filter(order => {
      const clientName = order.clients?.name || 'Cliente sem nome';
      const service = order.service_type || '';
      const term = searchTerm.toLowerCase();
      return clientName.toLowerCase().includes(term) || service.toLowerCase().includes(term);
    })
    .sort((a, b) => {
      const dateA = new Date(a.scheduled_date).getTime();
      const dateB = new Date(b.scheduled_date).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

  // Funções de navegação do calendário
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (calendarSubView === 'mensal') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (calendarSubView === 'semanal') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  return (
    <main className="flex min-w-0 flex-1 flex-col space-y-5 overflow-x-hidden bg-[#F5F7FA] text-[#0B192C] sm:space-y-7 p-4 sm:p-6 md:p-8">
      
      {/* TÍTULO E NAVEGAÇÃO SUPERIOR */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">CRM · Operações</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#0B192C] sm:text-3xl">Agenda Operacional</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Gira as marcações de limpeza em formato de tabela ou calendário interativo.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="bg-slate-200 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setViewMode('tabela')}
              className={`flex-1 sm:flex-initial px-4 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
                viewMode === 'tabela' ? 'bg-[#0B192C] text-white shadow' : 'text-slate-600 hover:text-[#0B192C]'
              }`}
            >
              Tabela
            </button>
            <button
              onClick={() => setViewMode('calendario')}
              className={`flex-1 sm:flex-initial px-4 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
                viewMode === 'calendario' ? 'bg-[#0B192C] text-white shadow' : 'text-slate-600 hover:text-[#0B192C]'
              }`}
            >
              Calendário
            </button>
          </div>

          <button
            onClick={() => handleOpenAddModalForDate()}
            className="min-h-11 rounded-xl bg-[#0B192C] px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 sm:py-2.5 cursor-pointer"
          >
            + Agendar Limpeza
          </button>
        </div>
      </div>

      {/* COMPONENTE DE MÉTRICAS */}
      <ServiceMetrics bookings={orders} />
      {assignmentFeedback && <p role={assignmentFeedback.error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${assignmentFeedback.error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{assignmentFeedback.message}</p>}

      {/* BARRA DE FILTROS E PESQUISA */}
      <div className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 md:flex-row md:items-center">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="🔍 Pesquisar por nome de cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full md:w-auto">
          {viewMode === 'tabela' && (
            <>
              <label className="text-xs font-bold text-slate-500">Ordem:</label>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-2.5 sm:py-2 border border-slate-300 rounded-xl bg-white text-xs font-bold text-[#0B192C] hover:bg-slate-50 transition cursor-pointer flex items-center gap-2"
              >
                <span>{sortOrder === 'asc' ? '📅 Mais Antigas / Próximas ↑' : '📅 Mais Recentes ↓'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* VISÃO 1: TABELA */}
      {viewMode === 'tabela' && (
        <>
        <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[850px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                <tr>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Serviço</th>
                  <th className="p-4">Data & Hora</th>
                  <th className="p-4">Funcionário</th>
                  <th className="p-4">Valor (€)</th>
                  <th className="p-4">Pagamento</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">A carregar marcações...</td></tr>
                ) : filteredOrders.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">Nenhuma limpeza encontrada.</td></tr>
                ) : (
                  filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-bold text-[#0B192C]">{order.clients?.name || 'Cliente Não Associado'}</td>
                      <td className="p-4 text-slate-600 text-xs">{order.service_type}</td>
                      <td className="p-4 text-slate-600 text-xs">
                        {new Date(order.scheduled_date).toLocaleString('pt-PT', {
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="p-4">
                        <select
                          value={order.worker_user_id ?? ''}
                          disabled={workersLoading || assignmentBusy === order.id}
                          onChange={(event) => void handleWorkerAssignment(order.id, event.target.value)}
                          aria-label={`Funcionário atribuído a ${order.clients?.name || order.service_type}`}
                          className="min-h-10 min-w-36 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:cursor-wait disabled:opacity-60"
                        >
                          <option value="">Sem funcionário</option>
                          {workersList.filter((worker) => worker.active || worker.user_id === order.worker_user_id).map((worker) => <option key={worker.user_id} value={worker.user_id} disabled={!worker.active}>{worker.display_name}{worker.active ? '' : ' (inativo)'}</option>)}
                        </select>
                      </td>
                      <td className="p-4 font-extrabold text-[#0B192C]">{Number(order.total_amount).toFixed(2)} €</td>
                      
                      {/* COLUNA DE CONTROLO DE PAGAMENTO (PAGO / FALTA PAGAR) */}
                      <td className="p-4">
                        <select
                          value={order.payment_status || 'pending'}
                          onChange={(e) => handlePaymentStatusChange(order.id, e.target.value)}
                          aria-label="Estado do pagamento"
                          className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border outline-none cursor-pointer ${
                            order.payment_status === 'paid' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-800'
                          }`}
                        >
                          <option value="pending">⏳ Falta Pagar</option>
                          <option value="paid">✅ Pago</option>
                        </select>
                      </td>

                      <td className="p-4">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          aria-label="Estado operacional do serviço"
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl border outline-none cursor-pointer ${
                            order.status === 'completed' || order.status === 'Concluído' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
                            order.status === 'cancelled' || order.status === 'Cancelado' ? 'bg-rose-50 border-rose-300 text-rose-800' :
                            'bg-amber-50 border-amber-300 text-amber-800'
                          }`}
                        >
                          <option value="pending">Agendado / Pendente</option>
                          <option value="in_progress">Em Execução</option>
                          <option value="completed">Concluído</option>
                          <option value="cancelled">Cancelado</option>
                        </select>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button onClick={() => setSelectedBooking(order)} className="text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-lg border transition cursor-pointer">✏️ Editar</button>
                        <button onClick={() => handleDeleteOrder(order.id, order.clients?.name || 'Cliente')} className="text-xs font-bold text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer">🗑️</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* VERSÃO MOBILE CARDS */}
        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">A carregar marcações...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Nenhuma limpeza encontrada.</div>
          ) : filteredOrders.map(order => (
            <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{order.clients?.name || 'Cliente Não Associado'}</p>
                  <h2 className="mt-1 break-words text-sm font-bold text-[#0B192C]">{order.service_type}</h2>
                </div>
                <span className="shrink-0 rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-800">{Number(order.total_amount).toFixed(2)} €</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Pagamento</label>
                  <select value={order.payment_status || 'pending'} onChange={(e) => handlePaymentStatusChange(order.id, e.target.value)} aria-label="Estado do pagamento" className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold">
                    <option value="pending">⏳ Falta Pagar</option>
                    <option value="paid">✅ Pago</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Estado</label>
                  <select value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value)} aria-label="Estado operacional" className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold">
                    <option value="pending">Pendente</option>
                    <option value="in_progress">Em execução</option>
                    <option value="completed">Concluído</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500">{new Date(order.scheduled_date).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedBooking(order)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">Editar</button>
                  <button onClick={() => handleDeleteOrder(order.id, order.clients?.name || 'Cliente')} className="p-1.5 text-rose-600">🗑️</button>
                </div>
              </div>
            </article>
          ))}
        </div>
        </>
      )}

      {/* VISÃO 2: CALENDÁRIO */}
      {viewMode === 'calendario' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
            <div className="flex items-center gap-2">
              <button onClick={() => navigateDate('prev')} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-xs cursor-pointer">◀ Anterior</button>
              <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-xs cursor-pointer">Hoje</button>
              <button onClick={() => navigateDate('next')} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-xs cursor-pointer">Seguinte ▶</button>
              <h3 className="font-extrabold text-base sm:text-lg text-[#0B192C] ml-2">
                {currentDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric', ...(calendarSubView === 'diario' ? { day: 'numeric' } : {}) })}
              </h3>
            </div>

            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 self-start sm:self-auto">
              <button onClick={() => setCalendarSubView('mensal')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${calendarSubView === 'mensal' ? 'bg-[#0B192C] text-white' : 'text-slate-600'}`}>Mensal</button>
              <button onClick={() => setCalendarSubView('semanal')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${calendarSubView === 'semanal' ? 'bg-[#0B192C] text-white' : 'text-slate-600'}`}>Semanal</button>
              <button onClick={() => setCalendarSubView('diario')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${calendarSubView === 'diario' ? 'bg-[#0B192C] text-white' : 'text-slate-600'}`}>Diário</button>
            </div>
          </div>

          {/* VISTA MENSAL */}
          {calendarSubView === 'mensal' && (
            <div className="grid grid-cols-7 gap-2">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                <div key={d} className="text-center text-xs font-bold text-slate-400 py-2">{d}</div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[100px] rounded-2xl bg-slate-50/50 border border-transparent"></div>
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const dayOrders = orders.filter(o => o.scheduled_date.startsWith(dateStr));

                return (
                  <div
                    key={dateStr}
                    onClick={() => handleOpenAddModalForDate(dateStr)}
                    className="min-h-[110px] rounded-2xl border border-slate-200 bg-white p-2.5 flex flex-col justify-between hover:border-sky-500 transition cursor-pointer group shadow-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">{dayNum}</span>
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 text-sky-600 font-bold">+ Adicionar</span>
                    </div>
                    <div className="space-y-1 overflow-y-auto max-h-[80px]">
                      {dayOrders.map(o => (
                        <div
                          key={o.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedBooking(o); }}
                          className="bg-sky-50 border border-sky-200 hover:bg-sky-100 p-1 rounded-lg text-[10px] truncate text-sky-900 font-semibold cursor-pointer"
                          title={`${o.clients?.name} - ${o.service_type}`}
                        >
                          🕒 {o.scheduled_date.split('T')[1]?.slice(0, 5) || '09:00'} - {o.clients?.name || 'Cliente'}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VISTA SEMANAL */}
          {calendarSubView === 'semanal' && (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {Array.from({ length: 7 }).map((_, i) => {
                const startOfWeek = new Date(currentDate);
                startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1 + i);
                const dateStr = startOfWeek.toISOString().split('T')[0];
                const dayOrders = orders.filter(o => o.scheduled_date.startsWith(dateStr));

                return (
                  <div key={dateStr} onClick={() => handleOpenAddModalForDate(dateStr)} className="min-h-[250px] rounded-2xl border border-slate-200 bg-slate-50/50 p-3 flex flex-col justify-between cursor-pointer hover:border-sky-500 transition">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold uppercase text-slate-500">{startOfWeek.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                        <span className="text-[10px] text-sky-600 font-bold">+</span>
                      </div>
                      <div className="space-y-2">
                        {dayOrders.map(o => (
                          <div key={o.id} onClick={(e) => { e.stopPropagation(); setSelectedBooking(o); }} className="bg-white border p-2 rounded-xl shadow-xs text-xs cursor-pointer">
                            <p className="font-bold text-[#0B192C]">{o.clients?.name}</p>
                            <p className="text-slate-500 text-[10px]">{o.service_type} ({o.scheduled_date.split('T')[1]?.slice(0, 5)})</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VISTA DIÁRIA */}
          {calendarSubView === 'diario' && (
            <div className="space-y-2">
              {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map(hour => {
                const dateStr = currentDate.toISOString().split('T')[0];
                const hourOrders = orders.filter(o => o.scheduled_date.startsWith(dateStr) && o.scheduled_date.includes(hour));

                return (
                  <div key={hour} onClick={() => handleOpenAddModalForDate(dateStr, hour)} className="flex items-center border-b border-slate-100 py-3 px-4 hover:bg-slate-50 rounded-xl cursor-pointer transition">
                    <span className="w-20 text-xs font-bold text-slate-400">{hour}</span>
                    <div className="flex-1 flex gap-2 flex-wrap">
                      {hourOrders.map(o => (
                        <div key={o.id} onClick={(e) => { e.stopPropagation(); setSelectedBooking(o); }} className="bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl text-xs font-bold text-sky-900 shadow-xs cursor-pointer">
                          {o.clients?.name} — {o.service_type} ({Number(o.total_amount).toFixed(2)}€)
                        </div>
                      ))}
                      {hourOrders.length === 0 && <span className="text-xs text-slate-400 italic">Clique para agendar</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE DETALHES / EDIÇÃO DE MARCAÇÃO */}
      {selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          clients={clientsList}
          workers={workersList}
          onClose={() => setSelectedBooking(null)}
          onUpdated={() => {
            setSelectedBooking(null);
            fetchOrders();
          }}
        />
      )}

      {/* MODAL DE NOVO AGENDAMENTO */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-3">
              <h3 className="text-lg sm:text-xl font-extrabold text-[#0B192C]">Agendar Nova Limpeza</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 font-bold p-2 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Cliente *</label>
                <select
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                >
                  <option value="">-- Selecione o Cliente --</option>
                  {clientsList.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Tipo de Serviço *</label>
                <select
                  value={serviceType}
                  onChange={(e) => handlePricingSelection(e.target.value, defaultPricingFrequency(e.target.value), typology)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                >
                  {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Hora *</label>
                  <input
                    type="time"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Frequência *</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                  >
                    <option value="once">Pontual (Apenas 1 vez)</option>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quinzenal</option>
                  </select>
                </div>
                {frequency !== 'once' && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Nº de Ocorrências *</label>
                    <input
                      type="number"
                      min={2}
                      max={24}
                      value={occurrences}
                      onChange={(e) => setOccurrences(Number(e.target.value))}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Atribuir Funcionário</label>
                <select
                  value={selectedWorkerUserId}
                  onChange={(e) => setSelectedWorkerUserId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                >
                  <option value="">-- Sem funcionário atribuído --</option>
                  {workersList.filter((worker) => worker.active).map(w => (
                    <option key={w.user_id} value={w.user_id}>{w.display_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Valor Total (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Observações</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalhes ou instruções especiais..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-slate-50 h-20 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#0B192C] text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'A agendar...' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}