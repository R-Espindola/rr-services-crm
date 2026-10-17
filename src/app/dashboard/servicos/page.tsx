'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export interface Client {
  id: string
  name: string
  phone: string
}

export interface ServiceBooking {
  id: string
  client_id: string
  service_type: string
  scheduled_date: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  total_amount: number
  notes?: string
  photos_before?: string[]
  photos_after?: string[]
  clients?: Client
}

export default function ServicesPage() {
  const [orders, setOrders] = useState<ServiceBooking[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')

  // Controlo do Mês/Ano visualizado no Calendário
  const [currentDate, setCurrentDate] = useState(new Date())

  // Campos do Formulário
  const [selectedClientId, setSelectedClientId] = useState('')
  const [serviceType, setServiceType] = useState('Limpeza Residencial Profunda')
  const [scheduledDate, setScheduledDate] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, clients(id, name, phone)')
      .order('scheduled_date', { ascending: true })

    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, name, phone')
      .order('name', { ascending: true })

    if (ordersData) setOrders(ordersData as ServiceBooking[])
    if (clientsData) setClients(clientsData as Client[])
    
    setLoading(false)
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClientId || !scheduledDate) {
      alert('Por favor, selecione um cliente e uma data válida.')
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('orders').insert([
      {
        client_id: selectedClientId,
        service_type: serviceType,
        scheduled_date: new Date(scheduledDate).toISOString(),
        total_amount: parseFloat(totalAmount) || 0,
        status: 'pending',
        notes: notes || null,
      },
    ])

    if (error) {
      alert('Erro ao agendar serviço: ' + error.message)
    } else {
      setShowModal(false)
      setSelectedClientId('')
      setServiceType('Limpeza Residencial Profunda')
      setScheduledDate('')
      setTotalAmount('')
      setNotes('')
      fetchData()
    }
    setSubmitting(false)
  }

  async function handleUpdateStatus(orderId: string, newStatus: string) {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (error) {
      alert('Erro ao atualizar estado: ' + error.message)
    } else {
      fetchData()
    }
  }

  async function handleAddPhoto(orderId: string, type: 'before' | 'after', currentPhotos: string[] = []) {
    const url = prompt(`Cole a URL da fotografia de ${type === 'before' ? 'Antes' : 'Depois'}:`)
    if (!url) return

    const updatedPhotos = [...currentPhotos, url]
    const updatePayload = type === 'before' ? { photos_before: updatedPhotos } : { photos_after: updatedPhotos }

    const { error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)

    if (error) {
      alert('Erro ao guardar foto: ' + error.message)
    } else {
      fetchData()
    }
  }

  // Métricas
  const totalAgendados = orders.length
  const emAndamento = orders.filter(o => o.status === 'in_progress').length
  const concluidos = orders.filter(o => o.status === 'completed').length
  const faturacaoEstimada = orders.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0)

  // Funções auxiliares para o Calendário
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  // Ajustar para começar em Segunda-feira (0 = Segunda, 6 = Domingo)
  const startDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  return (
    <main className="min-h-screen bg-slate-50 text-[#0B192C]">
      {/* Cabeçalho */}
      <header className="bg-[#0B192C] text-white py-4 px-8 shadow-lg flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="bg-[#00D4FF]/10 p-2 rounded-xl border border-[#00D4FF]/20">
            <span className="text-2xl font-bold tracking-wider text-[#00D4FF]">R&R</span>
          </div>
          <div>
            <span className="text-lg font-bold text-white block leading-none">Services</span>
            <span className="text-xs text-slate-400">Gestão de Intervenções & Agenda</span>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-sm font-semibold transition border border-slate-700/60 shadow-sm"
        >
          ← Voltar ao Painel
        </Link>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-10">
        {/* Título & Ações */}
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0B192C]">Serviços & Intervenções</h1>
            <p className="text-slate-500 text-sm mt-1">
              Gira as marcações em formato de tabela ou visualize os agendamentos diretamente no calendário.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de Vista (Tabela / Calendário) */}
            <div className="bg-slate-200/70 p-1 rounded-xl flex">
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  viewMode === 'table' ? 'bg-[#0B192C] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📋 Tabela
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  viewMode === 'calendar' ? 'bg-[#0B192C] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📅 Calendário
              </button>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="bg-[#0B192C] hover:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-700 text-sm"
            >
              <span>+</span> Agendar Nova Limpeza
            </button>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total de Intervenções</span>
            <div className="text-3xl font-extrabold text-[#0B192C] mt-1">{totalAgendados}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Em Execução</span>
            <div className="text-3xl font-extrabold text-amber-600 mt-1">{emAndamento}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Concluídos</span>
            <div className="text-3xl font-extrabold text-emerald-600 mt-1">{concluidos}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-[#00D4FF] uppercase tracking-wider">Valor Estimado Total</span>
            <div className="text-3xl font-extrabold text-[#0B192C] mt-1">{faturacaoEstimada.toFixed(2)} €</div>
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL: TABELA OU CALENDÁRIO */}
        {viewMode === 'table' ? (
          /* VISTA DE TABELA */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">Cliente</th>
                    <th className="py-4 px-6">Tipo de Serviço</th>
                    <th className="py-4 px-6">Data & Hora Agendada</th>
                    <th className="py-4 px-6">Valor (€)</th>
                    <th className="py-4 px-6">Estado da Limpeza</th>
                    <th className="py-4 px-6">Galeria Fotografias</th>
                    <th className="py-4 px-6 text-right">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">A carregar agendamentos...</td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <span className="text-3xl">🧹</span>
                          <p className="font-medium text-slate-600">Nenhum serviço agendado até ao momento.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6 font-semibold text-slate-900">
                          {order.clients?.name || 'Cliente Geral'}
                          <div className="text-xs font-normal text-slate-400">{order.clients?.phone || 'Sem contacto'}</div>
                        </td>
                        <td className="py-4 px-6 font-medium text-[#0B192C]">{order.service_type}</td>
                        <td className="py-4 px-6 text-slate-600">
                          {new Date(order.scheduled_date).toLocaleString('pt-PT', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-900">{Number(order.total_amount).toFixed(2)} €</td>
                        <td className="py-4 px-6">
                          <select
                            value={order.status}
                            onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold outline-none cursor-pointer border shadow-sm transition-all ${
                              order.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : order.status === 'in_progress'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : order.status === 'cancelled'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-sky-50 text-sky-700 border-sky-200'
                            }`}
                          >
                            <option value="pending">Agendado (Pendente)</option>
                            <option value="in_progress">Em Execução</option>
                            <option value="completed">Concluído</option>
                            <option value="cancelled">Cancelado</option>
                          </select>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddPhoto(order.id, 'before', order.photos_before)}
                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 transition"
                            >
                              📷 Antes ({order.photos_before?.length || 0})
                            </button>
                            <button
                              onClick={() => handleAddPhoto(order.id, 'after', order.photos_after)}
                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 transition"
                            >
                              ✨ Depois ({order.photos_after?.length || 0})
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-xs text-slate-500 italic">{order.notes || 'Sem observações'}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* VISTA DE CALENDÁRIO */
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6">
            {/* Cabeçalho do Calendário */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#0B192C]">
                {monthNames[month]} de {year}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={prevMonth}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition"
                >
                  ← Mês Anterior
                </button>
                <button
                  onClick={nextMonth}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition"
                >
                  Próximo Mês →
                </button>
              </div>
            </div>

            {/* Dias da Semana */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                <div key={d} className="text-xs font-bold text-slate-400 uppercase py-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Grelha de Dias */}
            <div className="grid grid-cols-7 gap-2">
              {/* Espaços em branco antes do dia 1 */}
              {Array.from({ length: startDayIndex }).map((_, index) => (
                <div key={`empty-${index}`} className="h-28 bg-slate-50/40 rounded-2xl border border-dashed border-slate-200"></div>
              ))}

              {/* Dias do Mês */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const dayNumber = index + 1
                // Filtrar agendamentos para este dia exato
                const dayOrders = orders.filter((o) => {
                  const oDate = new Date(o.scheduled_date)
                  return (
                    oDate.getDate() === dayNumber &&
                    oDate.getMonth() === month &&
                    oDate.getFullYear() === year
                  )
                })

                return (
                  <div
                    key={`day-${dayNumber}`}
                    className={`h-32 p-2.5 rounded-2xl border flex flex-col justify-between overflow-y-auto transition ${
                      dayOrders.length > 0
                        ? 'bg-[#00D4FF]/5 border-[#00D4FF]/40 shadow-sm'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                        dayOrders.length > 0 ? 'bg-[#0B192C] text-white' : 'text-slate-500 bg-slate-100'
                      }`}>
                        {dayNumber}
                      </span>
                      {dayOrders.length > 0 && (
                        <span className="text-[10px] font-bold text-[#0B192C]">
                          {dayOrders.length} {dayOrders.length === 1 ? 'limpeza' : 'limpezas'}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 mt-1 flex-1 overflow-y-auto">
                      {dayOrders.map((ord) => {
                        const timeString = new Date(ord.scheduled_date).toLocaleTimeString('pt-PT', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                        return (
                          <div
                            key={ord.id}
                            className="bg-white p-1.5 rounded-lg border border-slate-200 text-[11px] shadow-2xs"
                          >
                            <div className="font-bold text-[#0B192C] flex items-center justify-between">
                              <span>⏰ {timeString}</span>
                              <span className={`w-2 h-2 rounded-full ${
                                ord.status === 'completed' ? 'bg-emerald-500' : ord.status === 'in_progress' ? 'bg-amber-500' : 'bg-sky-500'
                              }`} />
                            </div>
                            <div className="font-semibold text-slate-700 truncate mt-0.5">
                              👤 {ord.clients?.name || 'Cliente'}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {ord.service_type}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Modal para Agendar Novo Serviço */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#0B192C]">Agendar Nova Limpeza</h2>
                <p className="text-xs text-slate-500 mt-1">Associe o serviço ao cliente e defina a data de intervenção.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Cliente *</label>
                <select
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50/50 text-sm font-medium"
                >
                  <option value="">Selecione o cliente na lista...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Tipo de Serviço *</label>
                <input
                  type="text"
                  required
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  placeholder="Ex: Limpeza Residencial Profunda, Pós-Obra"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50/50 text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Data e Hora *</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50/50 text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Valor Total (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="Ex: 85.00"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50/50 text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Observações Internas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Chave na portaria, atenção especial aos vidros da varanda."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50/50 text-sm font-medium h-24"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-7 py-3 bg-[#0B192C] hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'A guardar...' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}