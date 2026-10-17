'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface ClientRecord {
  id: string
  name: string
  email?: string | null
  phone: string
  address: string
  total_services?: number
}

interface ServiceBooking {
  id: string
  client_id?: string | null
  service_type: string
  scheduled_date: string
  status: string
  notes?: string | null
  total_amount?: number
}

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [bookings, setBookings] = useState<ServiceBooking[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<ClientRecord | null>(null)
  
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchData = async () => {
    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')

    if (clientsData) setClients(clientsData)
    if (ordersData) setBookings(ordersData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg(null)

    try {
      const { error } = await supabase
        .from('clients')
        .insert([
          {
            name,
            phone,
            email: email.trim() || null,
            address,
            total_services: 0
          }
        ])

      if (error) {
        setErrorMsg(`Erro Supabase: ${error.message}`)
        setSubmitting(false)
        return
      }

      await fetchData()

      setIsModalOpen(false)
      setName('')
      setEmail('')
      setPhone('')
      setAddress('')
    } catch (err: any) {
      setErrorMsg(`Erro inesperado: ${err.message || String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  // Corresponde aos serviços por client_id OU pelo Nome no campo de texto
  const getClientBookings = (client: ClientRecord) => {
    return bookings.filter((b) => {
      if (b.client_id && String(b.client_id) === String(client.id)) {
        return true
      }
      if (b.notes && b.notes.toLowerCase().includes(client.name.toLowerCase())) {
        return true
      }
      return false
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">A carregar CRM de Clientes...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-[#0B192C]">
      {/* Cabeçalho */}
      <header className="bg-[#0B192C] text-white py-4 px-6 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard" className="text-2xl font-bold text-[#00D4FF]">R&R</Link>
          <span className="text-lg font-medium text-slate-200">Services — CRM & Carteira de Clientes</span>
        </div>
        <Link
          href="/dashboard"
          className="bg-slate-800 text-slate-200 px-4 py-2 rounded-xl text-sm hover:bg-slate-700 transition"
        >
          ← Voltar ao Painel
        </Link>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase">Total de Clientes</span>
            <p className="text-3xl font-bold text-[#0B192C] mt-2">{clients.length}</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">✓ Registados na base de dados</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase">Serviços Associados</span>
            <p className="text-3xl font-bold text-[#0B192C] mt-2">{bookings.length}</p>
            <p className="text-xs text-blue-600 font-semibold mt-1">Histórico total de limpezas</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase">Satisfação Média</span>
            <p className="text-3xl font-bold text-[#0B192C] mt-2">5.0 / 5.0</p>
            <p className="text-xs text-amber-500 font-semibold mt-1">★ ★ ★ ★ ★ (Feedback R&R Services)</p>
          </div>
        </div>

        {/* Tabela de Clientes */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[#0B192C]">Carteira de Clientes</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#0B192C] text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md hover:bg-slate-800 transition cursor-pointer"
          >
            + Adicionar Novo Cliente
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            {clients.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Nenhum cliente registado de momento.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-4">Nome / Razão Social</th>
                    <th scope="col" className="px-6 py-4">Contacto (Telefone / Email)</th>
                    <th scope="col" className="px-6 py-4">Morada Principal</th>
                    <th scope="col" className="px-6 py-4 text-center">Serviços Totais</th>
                    <th scope="col" className="px-6 py-4 text-right">Ações CRM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((item) => {
                    const clientOrders = getClientBookings(item)
                    const cleanPhone = item.phone.replace(/\D/g, '')

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-6 py-4 font-semibold text-[#0B192C]">
                          {item.name}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-800">{item.phone}</p>
                          <p className="text-xs text-slate-400">{item.email || 'Sem email registado'}</p>
                        </td>
                        <td className="px-6 py-4">{item.address}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full">
                            {clientOrders.length}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-3">
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition inline-block"
                          >
                            💬 WhatsApp
                          </a>
                          <button
                            onClick={() => setSelectedClientForHistory(item)}
                            className="text-[#00D4FF] hover:underline font-semibold text-xs cursor-pointer"
                          >
                            Ver Histórico
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
      </main>

      {/* Modal Histórico do Cliente */}
      {selectedClientForHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#0B192C]">{selectedClientForHistory.name}</h3>
                <p className="text-xs text-slate-500">Histórico de Serviços & Intervenções de Limpeza</p>
              </div>
              <button
                onClick={() => setSelectedClientForHistory(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {getClientBookings(selectedClientForHistory).length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs bg-slate-50 rounded-xl">
                  Ainda não existem agendamentos associados a este cliente.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {getClientBookings(selectedClientForHistory).map((b) => (
                    <div key={b.id} className="py-3 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-[#0B192C]">{b.service_type}</p>
                        <p className="text-slate-500">
                          {new Date(b.scheduled_date).toLocaleDateString('pt-PT', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-800 block">{(b.total_amount || 60).toFixed(2)} €</span>
                        <span className="text-slate-500 uppercase text-[10px]">{b.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-6 border-t border-slate-100 mt-6">
              <button
                onClick={() => setSelectedClientForHistory(null)}
                className="px-5 py-2.5 rounded-xl bg-[#0B192C] text-white font-semibold text-xs hover:bg-slate-800 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-[#0B192C]">Registar Novo Cliente</h3>
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

            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nome Completo / Empresa
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João Pereira"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Telefone *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+351 912 000 000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Email <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="cliente@email.pt"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Morada Habituais / Local da Limpeza
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Rua Central nº 4, Setúbal"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
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
                  {submitting ? 'A guardar...' : 'Registar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}