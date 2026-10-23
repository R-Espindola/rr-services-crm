'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ServiceMetrics from './ServiceMetrics';
import BookingDetailsModal from './BookingDetailsModal';

export interface Order {
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

export type ServiceBooking = Order;

export interface ClientOption {
  id: string;
  name: string;
  phone: string;
}

export default function AgendaPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [clientsList, setClientsList] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'tabela' | 'calendario'>('tabela');
  
  // Modais e Seleções
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Order | null>(null);
  
  // Filtros e Ordenação
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Estado do Modal de Novo Agendamento
  const [submitting, setSubmitting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [serviceType, setServiceType] = useState('Limpeza Residencial');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [totalAmount, setTotalAmount] = useState('60.00');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchOrders();
    fetchClients();
  }, []);

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

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId) {
      alert('Por favor, selecione um cliente.');
      return;
    }

    setSubmitting(true);
    const fullDateTime = `${scheduledDate}T${scheduledTime}:00`;

    const { error } = await supabase.from('orders').insert([
      {
        client_id: selectedClientId,
        service_type: serviceType,
        scheduled_date: fullDateTime,
        total_amount: parseFloat(totalAmount) || 0,
        status: 'pending',
        notes: notes
      }
    ]);

    if (error) {
      alert('Erro ao agendar limpeza: ' + error.message);
    } else {
      alert('Limpeza agendada com sucesso!');
      setShowAddModal(false);
      setSelectedClientId('');
      setScheduledDate('');
      setNotes('');
      fetchOrders();
    }
    setSubmitting(false);
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

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 text-[#0B192C] p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* TÍTULO E NAVEGAÇÃO SUPERIOR */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B192C]">Agenda Operacional</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Gira as marcações de limpeza em formato de tabela ou calendário.</p>
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
            onClick={() => setShowAddModal(true)}
            className="bg-[#0B192C] text-white px-5 py-3.5 sm:py-2.5 rounded-xl font-bold text-xs hover:bg-slate-800 transition cursor-pointer shadow-sm text-center"
          >
            + Agendar Limpeza
          </button>
        </div>
      </div>

      {/* COMPONENTE DE MÉTRICAS */}
      <ServiceMetrics bookings={orders} />

      {/* BARRA DE FILTROS E PESQUISA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="🔍 Pesquisar por nome de cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 sm:py-2.5 border border-slate-300 rounded-xl bg-slate-50 text-base sm:text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#00D4FF]"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full md:w-auto">
          <label className="text-xs font-bold text-slate-500">Ordem:</label>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-4 py-2.5 sm:py-2 border border-slate-300 rounded-xl bg-white text-xs font-bold text-[#0B192C] hover:bg-slate-50 transition cursor-pointer flex items-center gap-2"
          >
            <span>{sortOrder === 'asc' ? '📅 Mais Antigas / Próximas ↑' : '📅 Mais Recentes ↓'}</span>
          </button>
        </div>
      </div>

      {/* VISÃO 1: TABELA */}
      {viewMode === 'tabela' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[750px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                <tr>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Serviço</th>
                  <th className="p-4">Data & Hora</th>
                  <th className="p-4">Valor (€)</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-400">A carregar marcações...</td></tr>
                ) : filteredOrders.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-400">Nenhuma limpeza encontrada.</td></tr>
                ) : (
                  filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-bold text-[#0B192C]">{order.clients?.name || 'Cliente Não Associado'}</td>
                      <td className="p-4 text-slate-600 text-xs">{order.service_type}</td>
                      <td className="p-4 text-slate-600 text-xs">
                        {new Date(order.scheduled_date).toLocaleString('pt-PT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="p-4 font-extrabold text-[#0B192C]">{Number(order.total_amount).toFixed(2)} €</td>
                      <td className="p-4">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
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
                        <button
                          onClick={() => setSelectedBooking(order)}
                          className="text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-lg border transition cursor-pointer"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleDeleteOrder(order.id, order.clients?.name || 'Cliente')}
                          className="text-xs font-bold text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISÃO 2: CALENDÁRIO */}
      {viewMode === 'calendario' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-4">
            <h3 className="font-bold text-base sm:text-lg text-[#0B192C]">Vista Mensal de Agendamentos</h3>
            <span className="text-xs text-slate-500 font-semibold">{filteredOrders.length} limpeza(s)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 col-span-full text-center">Nenhuma limpeza encontrada no filtro atual.</p>
            ) : (
              filteredOrders.map(order => (
                <div key={order.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3 hover:border-[#00D4FF] transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase bg-[#00D4FF]/20 text-[#0B192C] px-2 py-0.5 rounded-md">
                        {new Date(order.scheduled_date).toLocaleDateString('pt-PT')}
                      </span>
                      <h4 className="font-bold text-sm text-[#0B192C] mt-2">{order.clients?.name || 'Cliente N/D'}</h4>
                      <p className="text-xs text-slate-500">{order.service_type}</p>
                    </div>
                    <span className="text-xs font-extrabold text-[#0B192C]">{Number(order.total_amount).toFixed(2)} €</span>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-200 pt-3">
                    <span className="text-[11px] font-semibold text-slate-600">
                      🕒 {new Date(order.scheduled_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => setSelectedBooking(order)}
                      className="text-xs font-bold text-[#00D4FF] hover:underline cursor-pointer"
                    >
                      Editar Detalhes
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL DETALHES / EDITAR */}
      {selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onRefresh={fetchOrders}
        />
      )}

      {/* MODAL NOVO AGENDAMENTO */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-[#0B192C]">Agendamento de Limpeza</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 font-bold p-2">✕</button>
            </div>
            
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Cliente *</label>
                <select
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full p-3.5 sm:p-3 border rounded-xl text-base sm:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                >
                  <option value="">-- Selecione um Cliente --</option>
                  {clientsList.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Tipo de Serviço</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full p-3.5 sm:p-3 border rounded-xl text-base sm:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                >
                  <option value="Limpeza Residencial">Limpeza Residencial</option>
                  <option value="Limpeza Residencial Profunda">Limpeza Residencial Profunda</option>
                  <option value="Limpeza de Mudança / Pós-Obra">Limpeza de Mudança / Pós-Obra</option>
                  <option value="Limpeza Comercial / Escritório">Limpeza Comercial / Escritório</option>
                  <option value="Extra: Limpeza de Forno">Extra: Limpeza de Forno</option>
                  <option value="Extra: Limpeza de Frigorífico">Extra: Limpeza de Frigorífico</option>
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
                    className="w-full p-3.5 sm:p-3 border rounded-xl text-base sm:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Hora *</label>
                  <input
                    type="time"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full p-3.5 sm:p-3 border rounded-xl text-base sm:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Valor (€)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="w-full p-3.5 sm:p-3 border rounded-xl text-base sm:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Observações / Notas</label>
                <textarea
                  placeholder="Ex: Levar produtos ecológicos..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3.5 sm:p-3 border rounded-xl text-base sm:text-sm bg-slate-50 h-20 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-full sm:w-auto px-4 py-3 sm:py-2 text-xs font-bold text-slate-600 cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-3.5 sm:py-2.5 bg-[#0B192C] text-white rounded-xl text-xs font-bold cursor-pointer text-center shadow"
                >
                  {submitting ? 'A agendar...' : 'Guardar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}