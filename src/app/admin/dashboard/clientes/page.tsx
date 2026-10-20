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

  // 1. Criar Cliente APENAS na tabela (sem criar login automático)
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

  // 2. Gerar Acesso e Enviar WhatsApp a partir da Ficha 360°
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

      // Mensagem formatada para o WhatsApp
      const mensagemWhatsApp = `Olá ${client.name}! A sua conta na R&R Services foi ativada. 🧹✨\n\nPode aceder ao Portal do Cliente em: ${window.location.origin}/login\n\nOs seus dados de acesso:\n- E-mail: ${client.email}\n- Palavra-passe temporária: ${passwordTemp}\n\nRecomendamos que altere a sua palavra-passe após o primeiro acesso.`

      const linkWhatsApp = `https://api.whatsapp.com/send?phone=${phoneWithCountryCode}&text=${encodeURIComponent(mensagemWhatsApp)}`
      
      window.open(linkWhatsApp, '_blank')
    } catch (err) {
      alert('Ocorreu um erro de conexão ao gerar o acesso.')
    } finally {
      setGerandoAcesso(false)
    }
  }

  // Função para Eliminar Cliente
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
    <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 text-[#0B192C] p-6 md:p-8">
      
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#0B192C]">Carteira de Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">Consulte fichas 360°, contactos e gere acessos ao portal.</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="🔍 Pesquisar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-xl bg-white text-xs outline-none focus:ring-2 focus:ring-[#00D4FF]"
          />
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#0B192C] text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-800 transition cursor-pointer shadow-sm"
          >
            + Novo Cliente
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
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
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenView(c)}
                      className="bg-[#00D4FF]/10 text-[#0B192C] font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-[#00D4FF]/20 transition cursor-pointer"
                    >
                      👁️ Ficha 360°
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL NOVO CLIENTE */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-[#0B192C]">Registar Novo Cliente</h3>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Nome Completo *</label>
                <input type="text" required placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border rounded-xl text-sm bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Telemóvel *</label>
                <input type="text" required placeholder="912 345 678" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 border rounded-xl text-sm bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">E-mail</label>
                <input type="email" placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border rounded-xl text-sm bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Morada Principal</label>
                <textarea placeholder="Rua, número, andar..." value={address} onChange={e => setAddress(e.target.value)} className="w-full p-3 border rounded-xl text-sm bg-slate-50 h-20" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-[#0B192C] text-white rounded-xl text-xs font-bold cursor-pointer">
                  {submitting ? 'A guardar...' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FICHA 360° */}
      {viewingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-xl font-bold text-[#0B192C]">{viewingClient.name}</h3>
              <button onClick={() => setViewingClient(null)} className="font-bold text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
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
                className="mt-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>💬</span>
                <span>{gerandoAcesso ? 'A gerar acesso...' : 'Gerar & Enviar Acesso por WhatsApp'}</span>
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-2">
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

            <div className="flex justify-between items-center pt-2 border-t">
              <button
                onClick={() => handleDeleteClient(viewingClient.id, viewingClient.name)}
                className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
              >
                🗑️ Eliminar Cliente
              </button>
              <button
                onClick={() => setViewingClient(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
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