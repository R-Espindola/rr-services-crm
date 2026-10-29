'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface Client {
  id: string
  name: string
  phone: string
  email: string
  address?: string
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [viewingClient, setViewingClient] = useState<Client | null>(null)
  const [clientOrders, setClientOrders] = useState<any[]>([])
  const [gerandoAcesso, setGerandoAcesso] = useState(false)

  // Campos do formulário de novo cliente
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchClients()
  }, [])

  async function fetchClients() {
    setLoading(true)
    const { data, error } = await supabase.from('clients').select('*').order('name', { ascending: true })
    if (!error && data) setClients(data as Client[])
    setLoading(false)
  }

  async function handleOpenView(client: Client) {
    setViewingClient(client)
    const { data } = await supabase.from('orders').select('*').eq('client_id', client.id)
    if (data) setClientOrders(data)
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const formattedEmail = email || `${phone.replace(/\s+/g, '')}@rrservices.pt`

    const { error } = await supabase.from('clients').insert([{ 
      name, 
      phone, 
      email: formattedEmail, 
      address 
    }])
    
    if (error) {
      alert('Erro ao criar cliente: ' + error.message)
    } else {
      setShowAddModal(false)
      setName('')
      setPhone('')
      setEmail('')
      setAddress('')
      fetchClients()
      alert('Cliente registado com sucesso!')
    }
    setSubmitting(false)
  }

  function handleEditClient(client: Client) {
    setEditingClient(client)
    setName(client.name)
    setPhone(client.phone)
    setEmail(client.email)
    setAddress(client.address || '')
    setViewingClient(null)
  }

  async function handleUpdateClient(e: React.FormEvent) {
    e.preventDefault()
    if (!editingClient) return
    setSubmitting(true)
    const formattedEmail = email || `${phone.replace(/\s+/g, '')}@rrservices.pt`
    const { error } = await supabase.from('clients').update({ name, phone, email: formattedEmail, address }).eq('id', editingClient.id)
    if (error) {
      alert('Erro ao atualizar cliente: ' + error.message)
    } else {
      setClients(current => current.map(client => client.id === editingClient.id ? { ...client, name, phone, email: formattedEmail, address } : client).sort((a, b) => a.name.localeCompare(b.name, 'pt')))
      setEditingClient(null)
      setName('')
      setPhone('')
      setEmail('')
      setAddress('')
      alert('Cliente atualizado com sucesso!')
    }
    setSubmitting(false)
  }

  function closeClientForm() {
    setShowAddModal(false)
    setEditingClient(null)
    setName('')
    setPhone('')
    setEmail('')
    setAddress('')
  }

  async function handleGerarAcessoWhatsApp(client: Client) {
    if (!confirm(`Deseja gerar credenciais de acesso para ${client.name} e enviar por WhatsApp?`)) {
      return
    }

    setGerandoAcesso(true)
    const cleanPhone = client.phone.replace(/\D/g, '')
    const phoneWithCountryCode = cleanPhone.startsWith('351') ? cleanPhone : `351${cleanPhone}`

    try {
      const response = await fetch('/api/admin/criar-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: client.name, 
          phone: cleanPhone, 
          email: client.email, 
          address: client.address || '' 
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        alert('Aviso / Erro: ' + (result.error || 'Não foi possível gerar acesso.'))
        setGerandoAcesso(false)
        return
      }

      const passwordTemp = result.password

      const mensagemWhatsApp = `Olá ${client.name}! A sua conta na R&R Services foi ativada. 🧹✨\n\nPode aceder ao Portal do Cliente em: ${window.location.origin}/login\n\nOs seus dados de acesso:\nE-mail: ${client.email}\nPalavra-passe temporária: ${passwordTemp}\n\nRecomendamos que altere a sua palavra-passe após o primeiro acesso.`

      const linkWhatsApp = `https://api.whatsapp.com/send?phone=${phoneWithCountryCode}&text=${encodeURIComponent(mensagemWhatsApp)}`
      
      window.open(linkWhatsApp, '_blank')
    } catch (err) {
      alert('Ocorreu um erro de conexão ao gerar o acesso.')
    } finally {
      setGerandoAcesso(false)
    }
  }

  async function handleDeleteClient(id: string, clientName: string) {
    if (!confirm(`Tem a certeza de que pretende eliminar o cliente "${clientName}"?`)) {
      return
    }

    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) {
      alert('Erro ao eliminar: ' + error.message)
    } else {
      fetchClients()
      setViewingClient(null)
    }
  }

  const filtered = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 text-[#0B192C] p-4 sm:p-6 md:p-8">
      
      {/* CABEÇALHO & PESQUISA RESPONSIVA */}
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B192C]">Carteira de Clientes</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Consulte fichas 360°, contactos e gere acessos ao portal.</p>
          <p className="text-slate-400 text-xs mt-2">{loading ? 'A carregar...' : `${filtered.length} ${filtered.length === 1 ? 'cliente' : 'clientes'}${searchTerm ? ' encontrados' : ' registados'}`}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="🔍 Pesquisar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Pesquisar clientes por nome, telemóvel ou e-mail"
            className="px-4 py-3 sm:py-2 border border-slate-300 rounded-xl bg-white text-sm sm:text-xs outline-none focus:ring-2 focus:ring-[#00D4FF] w-full sm:w-64"
          />
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#0B192C] text-white min-h-11 px-5 py-3 sm:py-2.5 rounded-xl font-bold text-xs hover:bg-slate-800 transition cursor-pointer shadow-sm text-center shrink-0"
          >
            + Novo Cliente
          </button>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">A carregar clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Nenhum cliente encontrado.</div>
        ) : filtered.map((client) => (
          <article key={client.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-[#0B192C]">{client.name}</h2>
              <a href={`tel:${client.phone.replace(/\s+/g, '')}`} className="mt-1 inline-flex min-h-10 items-center text-sm text-slate-600">{client.phone}</a>
              <p className="truncate text-sm text-slate-500">{client.email}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{client.address || 'Sem morada'}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => handleEditClient(client)} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 transition hover:border-[#00D4FF] hover:bg-slate-50">✏️ Editar</button>
              <button onClick={() => handleOpenView(client)} className="min-h-11 rounded-xl bg-cyan-50 px-3 text-sm font-bold text-[#0B192C] transition hover:bg-cyan-100">Ficha 360°</button>
            </div>
          </article>
        ))}
      </div>
      {/* TABELA COM SCROLL HORIZONTAL PARA MOBILE */}
      <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[650px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="p-4">Nome</th>
                <th className="p-4">Telemóvel</th>
                <th className="p-4">E-mail</th>
                <th className="p-4">Morada</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">A carregar clientes...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">Nenhum cliente encontrado.</td></tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-bold text-[#0B192C]">{c.name}</td>
                    <td className="p-4 text-slate-700">{c.phone}</td>
                    <td className="p-4 text-slate-500 text-xs">{c.email}</td>
                    <td className="p-4 text-slate-600 text-xs">{c.address || 'Sem morada'}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                      <button
                        onClick={() => handleEditClient(c)}
                        className="bg-white border border-slate-200 text-slate-700 min-h-11 font-bold px-3 py-2 rounded-xl text-xs hover:border-[#00D4FF] hover:bg-slate-50 transition cursor-pointer"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleOpenView(c)}
                        className="bg-[#00D4FF]/10 text-[#0B192C] min-h-11 font-bold px-3.5 py-2 rounded-xl text-xs hover:bg-[#00D4FF]/25 transition cursor-pointer inline-block"
                      >
                        👁️ Ficha 360°
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

      {/* MODAL NOVO CLIENTE (Adaptado para iPhone/Mobile) */}
      {(showAddModal || editingClient) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl my-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-[#0B192C]">{editingClient ? 'Editar Cliente' : 'Registar Novo Cliente'}</h3>
              <button onClick={closeClientForm} aria-label="Fechar formulário" className="text-slate-400 font-bold p-2">✕</button>
            </div>
            <form onSubmit={editingClient ? handleUpdateClient : handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Nome Completo *</label>
                <input type="text" required placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)} className="w-full p-3.5 sm:p-3 border rounded-xl text-base sm:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Telemóvel *</label>
                <input type="text" required placeholder="912 345 678" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3.5 sm:p-3 border rounded-xl text-base sm:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">E-mail</label>
                <input type="email" placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3.5 sm:p-3 border rounded-xl text-base sm:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Morada Principal</label>
                <textarea placeholder="Rua, número, andar..." value={address} onChange={e => setAddress(e.target.value)} className="w-full p-3.5 sm:p-3 border rounded-xl text-base sm:text-sm bg-slate-50 h-20 outline-none focus:ring-2 focus:ring-[#00D4FF]" />
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                <button type="button" onClick={closeClientForm} className="w-full sm:w-auto px-4 py-3 sm:py-2 text-xs font-bold text-slate-600">Cancelar</button>
                <button type="submit" disabled={submitting} className="w-full sm:w-auto px-5 py-3.5 sm:py-2.5 bg-[#0B192C] text-white rounded-xl text-xs font-bold cursor-pointer shadow">
                  {submitting ? 'A guardar...' : editingClient ? 'Guardar alterações' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FICHA 360° (Adaptado para iPhone/Mobile) */}
      {viewingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg sm:text-xl font-bold text-[#0B192C]">{viewingClient.name}</h3>
              <button onClick={() => setViewingClient(null)} className="font-bold text-slate-400 hover:text-slate-600 p-2">✕</button>
            </div>

            <div className="space-y-2 text-xs sm:text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl">
              <p>📞 <strong>Telemóvel:</strong> {viewingClient.phone}</p>
              <p>✉️ <strong>E-mail:</strong> {viewingClient.email}</p>
              <p>📍 <strong>Morada:</strong> {viewingClient.address || 'Não registada'}</p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col gap-2">
              <span className="text-xs font-bold text-emerald-800">Acesso ao Portal do Cliente</span>
              <p className="text-[11px] text-emerald-700">Clique abaixo para gerar uma palavra-passe temporária e enviar os dados de login por WhatsApp.</p>
              <button
                onClick={() => handleGerarAcessoWhatsApp(viewingClient)}
                disabled={gerandoAcesso}
                className="mt-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3.5 sm:py-2.5 px-4 rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>💬</span>
                <span>{gerandoAcesso ? 'A gerar acesso...' : 'Gerar & Enviar Acesso por WhatsApp'}</span>
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl text-xs space-y-2">
              <span className="font-bold uppercase text-slate-400 block">Intervenções Registadas ({clientOrders.length}):</span>
              {clientOrders.length === 0 ? (
                <p className="text-slate-400 italic">Sem intervenções associadas.</p>
              ) : (
                clientOrders.map(o => (
                  <div key={o.id} className="flex justify-between border-b pb-1">
                    <span>{o.service_type}</span>
                    <span className="font-bold">{Number(o.total_amount).toFixed(2)} €</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center pt-2 border-t gap-3">
              <button
                onClick={() => handleEditClient(viewingClient)}
                className="w-full sm:w-auto text-xs font-bold text-[#0B192C] hover:underline cursor-pointer py-2 text-center"
              >
                ✏️ Editar dados
              </button>
              <button
                onClick={() => handleDeleteClient(viewingClient.id, viewingClient.name)}
                className="w-full sm:w-auto text-xs font-bold text-red-600 hover:underline cursor-pointer py-2 text-center"
              >
                🗑️ Eliminar Cliente
              </button>
              <button
                onClick={() => setViewingClient(null)}
                className="w-full sm:w-auto px-5 py-3 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer text-center"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
