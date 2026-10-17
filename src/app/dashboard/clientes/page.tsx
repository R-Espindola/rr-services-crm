'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export interface Client {
  id: string
  name: string
  phone: string
  email: string
  address?: string
  notes?: string
  created_at?: string
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Modais
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [viewingClient, setViewingClient] = useState<Client | null>(null)

  // Dados para a Ficha Detalhada (360°)
  const [clientOrders, setClientOrders] = useState<any[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'orders' | 'extras' | 'access'>('info')

  // Campos do Formulário
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchClients()
  }, [])

  async function fetchClients() {
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true })

    if (!error && data) {
      setClients(data as Client[])
    }
    setLoading(false)
  }

  // Abrir a Ficha Completa 360° do Cliente
  async function handleOpenViewClient(client: Client) {
    setViewingClient(client)
    setActiveTab('info')
    setLoadingDetails(true)

    // Carregar todos os agendamentos e pedidos deste cliente
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('client_id', client.id)
      .order('scheduled_date', { ascending: false })

    if (orders) {
      setClientOrders(orders)
    } else {
      setClientOrders([])
    }

    setLoadingDetails(false)
  }

  // Abrir Modal de Edição de Dados
  function handleOpenEdit(client: Client) {
    setEditingClient(client)
    setName(client.name || '')
    setPhone(client.phone || '')
    setEmail(client.email || '')
    setAddress(client.address || '')
    setNotes(client.notes || '')
  }

  function closeModal() {
    setShowAddModal(false)
    setEditingClient(null)
    setViewingClient(null)
    setName('')
    setPhone('')
    setEmail('')
    setAddress('')
    setNotes('')
  }

  // Criar Novo Cliente
  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const formattedEmail = email || `${phone.replace(/\s+/g, '')}@rrservices.pt`

    const { error } = await supabase.from('clients').insert([
      {
        name,
        phone,
        email: formattedEmail,
        address: address || null,
        notes: notes || null,
      },
    ])

    if (error) {
      alert('Erro ao criar cliente: ' + error.message)
    } else {
      closeModal()
      fetchClients()
    }
    setSubmitting(false)
  }

  // Atualizar Cliente
  async function handleUpdateClient(e: React.FormEvent) {
    e.preventDefault()
    if (!editingClient) return

    setSubmitting(true)

    const { error } = await supabase
      .from('clients')
      .update({
        name,
        phone,
        email,
        address: address || null,
        notes: notes || null,
      })
      .eq('id', editingClient.id)

    if (error) {
      alert('Erro ao atualizar cliente: ' + error.message)
    } else {
      closeModal()
      fetchClients()
    }
    setSubmitting(false)
  }

  // Filtragem de clientes por pesquisa
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <main className="min-h-screen bg-slate-50 text-[#0B192C]">
      {/* Cabeçalho */}
      <header className="bg-[#0B192C] text-white py-4 px-8 shadow-md flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="bg-[#00D4FF]/10 p-2 rounded-xl border border-[#00D4FF]/20">
            <span className="text-2xl font-bold tracking-wider text-[#00D4FF]">R&R</span>
          </div>
          <div>
            <span className="text-lg font-bold text-white block leading-none">Services</span>
            <span className="text-xs text-slate-400">Gestão Avançada de Clientes</span>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition border border-slate-700"
        >
          ← Voltar ao Painel
        </Link>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-10">
        {/* Título & Pesquisa */}
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#0B192C]">Carteira de Clientes</h1>
            <p className="text-slate-500 text-sm mt-1">
              Consulte faturas, fichas detalhadas 360°, histórico de intervenções e convites do portal.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="🔍 Pesquisar por nome, telefone ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-white text-xs font-medium w-full sm:w-72"
            />
            <button
              onClick={() => {
                closeModal()
                setShowAddModal(true)
              }}
              className="bg-[#0B192C] hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 border border-slate-700 text-xs"
            >
              <span>+</span> Registar Novo Cliente
            </button>
          </div>
        </div>

        {/* Tabela Principal de Clientes */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Nome do Cliente</th>
                  <th className="py-4 px-6">Contacto Directo</th>
                  <th className="py-4 px-6">E-mail Portal</th>
                  <th className="py-4 px-6">Morada de Intervenção</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400">A carregar carteira de clientes...</td>
                  </tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-slate-400">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-bold text-[#0B192C]">
                        {client.name}
                      </td>
                      <td className="py-4 px-6 text-slate-700 font-semibold">{client.phone}</td>
                      <td className="py-4 px-6 text-slate-500 text-xs">{client.email}</td>
                      <td className="py-4 px-6 text-slate-600 text-xs">{client.address || 'Sem morada registada'}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenViewClient(client)}
                            className="bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 text-[#0B192C] font-bold px-3 py-1.5 rounded-lg border border-[#00D4FF]/30 text-xs transition cursor-pointer"
                          >
                            👁️ Ficha 360°
                          </button>
                          <button
                            onClick={() => handleOpenEdit(client)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-xs transition cursor-pointer"
                          >
                            ✏️ Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* MODAL FICHA COMPLETA 360° DO CLIENTE */}
      {viewingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Cabeçalho do Modal */}
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-3 py-1 rounded-full bg-[#00D4FF]/10 text-[#0B192C] border border-[#00D4FF]/20">
                  Ficha do Cliente 360°
                </span>
                <h2 className="text-2xl font-extrabold text-[#0B192C] mt-2">{viewingClient.name}</h2>
                <p className="text-xs text-slate-500">
                  📞 {viewingClient.phone} | ✉️ {viewingClient.email}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* Separadores Nativos */}
            <div className="flex border-b border-slate-200 mb-6 space-x-4">
              <button
                onClick={() => setActiveTab('info')}
                className={`pb-3 text-xs font-bold transition border-b-2 ${
                  activeTab === 'info' ? 'border-[#00D4FF] text-[#0B192C]' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                📋 Dados & Preferências
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`pb-3 text-xs font-bold transition border-b-2 ${
                  activeTab === 'orders' ? 'border-[#00D4FF] text-[#0B192C]' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                📅 Intervenções ({clientOrders.filter(o => !o.service_type?.toLowerCase().startsWith('extra:')).length})
              </button>
              <button
                onClick={() => setActiveTab('extras')}
                className={`pb-3 text-xs font-bold transition border-b-2 ${
                  activeTab === 'extras' ? 'border-[#00D4FF] text-[#0B192C]' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                ✨ Pedidos Extras ({clientOrders.filter(o => o.service_type?.toLowerCase().startsWith('extra:')).length})
              </button>
              <button
                onClick={() => setActiveTab('access')}
                className={`pb-3 text-xs font-bold transition border-b-2 ${
                  activeTab === 'access' ? 'border-[#00D4FF] text-[#0B192C]' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                🔑 Convite ao Portal
              </button>
            </div>

            {/* Conteúdo das Abas */}
            {loadingDetails ? (
              <div className="py-12 text-center text-xs text-slate-400">A carregar histórico detalhado...</div>
            ) : (
              <div>
                {/* 1. DADOS & PREFERÊNCIAS */}
                {activeTab === 'info' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Morada de Prestação do Serviço</span>
                        <p className="text-sm font-semibold text-[#0B192C] mt-1">{viewingClient.address || 'Sem morada registada.'}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Telefone / Telemóvel</span>
                        <p className="text-sm font-semibold text-[#0B192C] mt-1">{viewingClient.phone}</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Observações / Preferências do Cliente</span>
                      <p className="text-sm text-slate-700 mt-1 italic">{viewingClient.notes || 'Sem observações especiais registadas.'}</p>
                    </div>
                  </div>
                )}

                {/* 2. HISTÓRICO DE INTERVENÇÕES */}
                {activeTab === 'orders' && (
                  <div className="space-y-3">
                    {clientOrders.filter(o => !o.service_type?.toLowerCase().startsWith('extra:')).length === 0 ? (
                      <p className="text-xs text-slate-400 py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        Sem limpezas regulares registadas para este cliente.
                      </p>
                    ) : (
                      clientOrders
                        .filter(o => !o.service_type?.toLowerCase().startsWith('extra:'))
                        .map((ord) => (
                          <div key={ord.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex justify-between items-center text-xs">
                            <div>
                              <div className="font-bold text-[#0B192C] text-sm">{ord.service_type}</div>
                              <div className="text-slate-500 mt-1">
                                Data: {new Date(ord.scheduled_date).toLocaleDateString('pt-PT')} | Estado: <span className="font-bold">{ord.status}</span>
                              </div>
                            </div>
                            <span className="font-extrabold text-[#0B192C] text-sm">{Number(ord.total_amount).toFixed(2)} €</span>
                          </div>
                        ))
                    )}
                  </div>
                )}

                {/* 3. PEDIDOS EXTRAS */}
                {activeTab === 'extras' && (
                  <div className="space-y-3">
                    {clientOrders.filter(o => o.service_type?.toLowerCase().startsWith('extra:')).length === 0 ? (
                      <p className="text-xs text-slate-400 py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        Sem pedidos de serviços extra registados.
                      </p>
                    ) : (
                      clientOrders
                        .filter(o => o.service_type?.toLowerCase().startsWith('extra:'))
                        .map((ext) => (
                          <div key={ext.id} className="p-4 rounded-2xl border border-amber-100 bg-amber-50/20 flex justify-between items-center text-xs">
                            <div>
                              <div className="font-bold text-[#0B192C] text-sm">{ext.service_type}</div>
                              <div className="text-slate-500 mt-1">
                                Pedido em: {new Date(ext.created_at || ext.scheduled_date).toLocaleDateString('pt-PT')} | Estado: <span className="font-bold">{ext.status}</span>
                              </div>
                            </div>
                            <span className="font-extrabold text-[#0B192C] text-sm">{Number(ext.total_amount).toFixed(2)} €</span>
                          </div>
                        ))
                    )}
                  </div>
                )}

                {/* 4. CONVITE DE ACESSO AO PORTAL */}
                {activeTab === 'access' && (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                    <h4 className="font-bold text-[#0B192C] text-sm">Credenciais de Acesso Privado ao Portal do Cliente</h4>
                    <p className="text-xs text-slate-500">
                      O cliente pode aceder ao portal usando o seu e-mail/utilizador e a palavra-passe associada no Supabase Auth.
                    </p>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div><span className="font-bold text-slate-600">E-mail / Utilizador:</span> <code className="bg-slate-100 px-2 py-1 rounded text-[#0B192C] font-mono">{viewingClient.email}</code></div>
                      <div><span className="font-bold text-slate-600">Telemóvel Registado:</span> <code className="bg-slate-100 px-2 py-1 rounded text-[#0B192C] font-mono">{viewingClient.phone}</code></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR / EDITAR CLIENTE */}
      {(showAddModal || editingClient) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#0B192C]">
                  {editingClient ? 'Editar Cliente' : 'Registar Novo Cliente'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">Preencha as informações do cliente da R&R Services.</p>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            <form onSubmit={editingClient ? handleUpdateClient : handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carolina Reis"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Telemóvel / Telefone *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: 965 069 768"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">E-mail para Acesso ao Portal</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: 965069768@rrservices.pt"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Morada de Intervenção Principal</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Rua das Flores, nº 12, 2º Dto - Lisboa"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-medium h-20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Preferências & Observações Internas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Chaves no porteiro, ter atenção ao animal de estimação..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-medium h-20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-7 py-3 bg-[#0B192C] hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'A guardar...' : editingClient ? 'Guardar Alterações' : 'Criar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}