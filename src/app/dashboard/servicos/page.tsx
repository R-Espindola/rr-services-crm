'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ServiceMetrics from './ServiceMetrics'
import BookingDetailsModal from './BookingDetailsModal'

export interface ServiceBooking {
  id: string
  client_id?: string | null
  service_type: string
  scheduled_date: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  notes: string | null
  total_amount?: number
}

interface ClientOption {
  id: string
  name: string
  address: string
}

export default function ServicosPage() {
  const [bookings, setBookings] = useState<ServiceBooking[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  
  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null)

  // Form de Novo Serviço
  const [submitting, setSubmitting] = useState(false)
  const [serviceType, setServiceType] = useState('Limpeza Residencial Recorrente')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [customAddress, setCustomAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [amount, setAmount] = useState('60')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date())

  const fetchBookings = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('scheduled_date', { ascending: true })

    if (data && !error) {
      setBookings(data)
    }
    setLoading(false)
  }

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name, address')
    if (data) {
      setClients(data)
    }
  }

  useEffect(() => {
    fetchBookings()
    fetchClients()
  }, [])

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId)
    const client = clients.find((c) => c.id === clientId)
    if (client) {
      setCustomAddress(`${client.name} - ${client.address}`)
    }
  }

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg(null)

    try {
      const fullDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
      const clientObj = clients.find((c) => c.id === selectedClientId)
      const clientNamePrefix = clientObj ? `Cliente: ${clientObj.name} | ` : ''
      const combinedNotes = `${clientNamePrefix}Morada: ${customAddress}${notes ? ` | Obs: ${notes}` : ''}`

      const numericAmount = parseFloat(amount.replace(',', '.')) || 60

      const payload = {
        client_id: selectedClientId ? String(selectedClientId) : null,
        service_type: serviceType,
        scheduled_date: fullDateTime,
        notes: combinedNotes,
        status: 'pending',
        total_amount: numericAmount
      }

      const { error } = await supabase
        .from('orders')
        .insert([payload])

      if (error) {
        setErrorMsg(`Erro Supabase: ${error.message}`)
        setSubmitting(false)
        return
      }

      await fetchBookings()
      setIsModalOpen(false)
      setSelectedClientId('')
      setScheduledDate('')
      setCustomAddress('')
      setNotes('')
    } catch (err: any) {
      setErrorMsg(`Erro inesperado: ${err.message || String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full">Concluído</span>
      case 'in_progress':
        return <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full">Em Execução</span>
      case 'cancelled':
        return <span className="bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-1 rounded-full">Cancelado</span>
      default:
        return <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">Agendado</span>
    }
  }

  // Lógica do Calendário
  const year = currentCalendarDate.getFullYear()
  const month = currentCalendarDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const prevMonth = () => setCurrentCalendarDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentCalendarDate(new Date(year, month + 1, 1))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">A carregar agendamentos de limpeza...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-[#0B192C]">
      {/* Cabeçalho */}
      <header className="bg-[#0B192C] text-white py-4 px-6 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard" className="text-2xl font-bold text-[#00D4FF]">R&R</Link>
          <span className="text-lg font-medium text-slate-200">Services — Gestão de Serviços Contratados</span>
        </div>
        <Link
          href="/dashboard"
          className="bg-slate-800 text-slate-200 px-4 py-2 rounded-xl text-sm hover:bg-slate-700 transition"
        >
          ← Voltar ao Painel
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Métricas */}
        <ServiceMetrics bookings={bookings} />

        {/* Título & Vistas */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center my-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0B192C]">Agendamentos de Limpeza</h1>
            <p className="text-slate-600 text-sm">Gestão e acompanhamento dos serviços agendados.</p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-slate-200 p-1 rounded-xl flex space-x-1 text-xs font-semibold">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3.5 py-2 rounded-lg transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-[#0B192C] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📋 Tabela
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3.5 py-2 rounded-lg transition cursor-pointer ${
                  viewMode === 'calendar' ? 'bg-white text-[#0B192C] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📅 Calendário
              </button>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#0B192C] text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md hover:bg-slate-800 transition cursor-pointer"
            >
              + Agendar Serviço
            </button>
          </div>
        </div>

        {/* Vista Tabela */}
        {viewMode === 'table' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              {bookings.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  Nenhum serviço agendado de momento.
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th scope="col" className="px-6 py-4">Serviço / Tipo</th>
                      <th scope="col" className="px-6 py-4">Data & Hora</th>
                      <th scope="col" className="px-6 py-4">Detalhes / Morada</th>
                      <th scope="col" className="px-6 py-4">Valor (€)</th>
                      <th scope="col" className="px-6 py-4">Estado</th>
                      <th scope="col" className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bookings.map((item) => {
                      const displayAmount = item.total_amount && item.total_amount > 0 ? item.total_amount : 60
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-6 py-4 font-semibold text-[#0B192C]">
                            {item.service_type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800">
                            {new Date(item.scheduled_date).toLocaleDateString('pt-PT', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })} às {new Date(item.scheduled_date).toLocaleTimeString('pt-PT', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">
                            {item.notes || 'Sem detalhes registados'}
                          </td>
                          <td className="px-6 py-4 font-bold text-[#0B192C]">
                            {displayAmount.toFixed(2)} €
                          </td>
                          <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                          <td className="px-6 py-4 text-right space-x-3">
                            <button
                              onClick={() => setSelectedBooking(item)}
                              className="text-[#00D4FF] hover:underline font-semibold text-xs cursor-pointer"
                            >
                              Ver Detalhes
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm('Tem a certeza de que pretende eliminar este agendamento?')) {
                                  await supabase.from('orders').delete().eq('id', item.id)
                                  fetchBookings()
                                }
                              }}
                              className="text-rose-600 hover:underline font-semibold text-xs cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Vista Calendário */}
        {viewMode === 'calendar' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#0B192C]">
                {monthNames[month]} {year}
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={prevMonth}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  ← Mês Anterior
                </button>
                <button
                  onClick={nextMonth}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Próximo Mês →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 uppercase mb-2">
              <div>Dom</div>
              <div>Seg</div>
              <div>Ter</div>
              <div>Qua</div>
              <div>Qui</div>
              <div>Sex</div>
              <div>Sáb</div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-28 bg-slate-50/50 rounded-xl border border-slate-100"></div>
              ))}

              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1
                const dayBookings = bookings.filter((b) => {
                  const bDate = new Date(b.scheduled_date)
                  return (
                    bDate.getDate() === dayNum &&
                    bDate.getMonth() === month &&
                    bDate.getFullYear() === year
                  )
                })

                return (
                  <div
                    key={`day-${dayNum}`}
                    className="h-28 bg-white p-2 rounded-xl border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition"
                  >
                    <span className="text-xs font-bold text-slate-700">{dayNum}</span>

                    <div className="space-y-1 overflow-y-auto max-h-20">
  {dayBookings.map((b) => {
    // 1. Formatar hora (ex: 09:00)
    const timeStr = new Date(b.scheduled_date).toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit'
    })

    // 2. Tentar encontrar o cliente correspondente na lista
    const matchedClient = clients.find((c) => String(c.id) === String(b.client_id))
    
    let clientName = ''
    if (matchedClient) {
      clientName = matchedClient.name
    } else if (b.notes) {
      // Extrair nome se estiver formatado nas observações (ex: "Cliente: Daniela | ...")
      const match = b.notes.match(/Cliente:\s*([^|]+)/i) || b.notes.match(/^([^\-|]+)/)
      clientName = match ? match[1].trim() : b.notes.split('-')[0].trim()
    } else {
      clientName = 'Cliente'
    }

    return (
      <div
        key={b.id}
        onClick={() => setSelectedBooking(b)}
        className="p-1 bg-[#0B192C] text-white rounded text-[10px] font-medium truncate cursor-pointer hover:bg-slate-800 transition"
        title={`${timeStr} - ${clientName} (${b.service_type})`}
      >
        <span className="font-semibold text-[#00D4FF] mr-1">{timeStr}</span>
        <span>{clientName}</span>
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
      </main>

      {/* Modal Novo Agendamento */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-[#0B192C]">Agendar Novo Serviço de Limpeza</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-mono break-all">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Tipo de Serviço
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800"
                >
                  <option value="Limpeza Residencial Recorrente">Limpeza Residencial Recorrente</option>
                  <option value="Limpeza Residencial Quinzenal">Limpeza Residencial Quinzenal</option>
                  <option value="Limpeza Profunda (Geral)">Limpeza Profunda (Geral)</option>
                  <option value="Limpeza Pós-Obras">Limpeza Pós-Obras</option>
                  <option value="Limpeza de Vidros & Sacadas/Terraços">Limpeza de Vidros & Sacadas/Terraços</option>
                  <option value="Limpeza Comercial / Escritórios">Limpeza Comercial / Escritórios</option>
                  <option value="Higienização de Estofos & Sofás">Higienização de Estofos & Sofás</option>
                </select>
              </div>

              {clients.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Selecionar Cliente Registado <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800 bg-slate-50"
                  >
                    <option value="">-- Escolha um cliente da base de dados --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.address})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Hora
                  </label>
                  <input
                    type="time"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Morada / Localização
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Montijo - Rua Atalaia 150"
                    value={customAddress}
                    onChange={(e) => setCustomAddress(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Valor (€)
                  </label>
                  <input
                    type="text"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Observações <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Atenção aos vidros da sala..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0B192C] text-white font-semibold text-xs hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'A agendar...' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onRefresh={fetchBookings}
        />
      )}
    </div>
  )
}