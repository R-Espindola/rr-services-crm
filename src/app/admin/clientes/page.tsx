'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface Client {
  id: string
  name: string
  phone: string
  email: string | null
  address?: string
  floor_details?: string | null
  notes?: string | null
  source_channel?: string | null
  auth_user_id?: string | null
  latitude?: number | null
  longitude?: number | null
  payment_terms?: string | null
}

type AccessCredentials = { clientId: string; phone: string; loginEmail: string; password: string }
type ClientOrder = { id: string; service_type: string; total_amount: number | string }

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [viewingClient, setViewingClient] = useState<Client | null>(null)
  const [clientOrders, setClientOrders] = useState<ClientOrder[]>([])
  const [gerandoAcesso, setGerandoAcesso] = useState(false)
  const [accessCredentials, setAccessCredentials] = useState<AccessCredentials | null>(null)
  const [accessFeedback, setAccessFeedback] = useState('')
  const [geocoding, setGeocoding] = useState(false)

  // Campos do formulário de novo cliente
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [floorDetails, setFloorDetails] = useState('')
  const [clientNotes, setClientNotes] = useState('')
  const [sourceChannel, setSourceChannel] = useState('WhatsApp')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [paymentTerms, setPaymentTerms] = useState<string>('per_service')
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
    setAccessCredentials(null)
    setAccessFeedback('')
    setViewingClient(client)
    const { data } = await supabase.from('orders').select('id, service_type, total_amount').eq('client_id', client.id)
    if (data) setClientOrders(data as ClientOrder[])
  }

  // Função para procurar coordenadas automaticamente pela morada limpa (sem o andar)
  async function handleGeocodeAddress(streetAddress: string) {
    if (!streetAddress || streetAddress.trim().length < 5) {
      alert('Por favor, introduza uma morada válida (rua e número) antes de procurar as coordenadas.')
      return
    }

    setGeocoding(true)
    try {
      const query = encodeURIComponent(`${streetAddress}, Portugal`)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`,
        {
          headers: {
            'Accept-Language': 'pt-PT',
            'User-Agent': 'RR-Services-CRM'
          }
        }
      )

      const data = await response.json()

      if (data && data.length > 0) {
        setLatitude(Number(data[0].lat))
        setLongitude(Number(data[0].lon))
        alert(`Coordenadas de GPS obtidas com sucesso!\nLatitude: ${data[0].lat}\nLongitude: ${data[0].lon}`)
      } else {
        setLatitude(null)
        setLongitude(null)
        alert('Não foi possível encontrar as coordenadas exatas para esta morada. Verifique o nome da rua e localidade.')
      }
    } catch (error) {
      console.error('Erro ao procurar coordenadas:', error)
      alert('Erro ao ligar ao serviço de mapas.')
    } finally {
      setGeocoding(false)
    }
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const formattedEmail = email || `${phone.replace(/\s+/g, '')}@rrservices.pt`

    const { error } = await supabase.from('clients').insert([{ 
      name, 
      phone, 
      email: formattedEmail, 
      address,
      floor_details: floorDetails,
      notes: clientNotes,
      source_channel: sourceChannel,
      payment_terms: paymentTerms,
      latitude,
      longitude
    }])
    
    if (error) {
      alert('Erro ao criar cliente: ' + error.message)
    } else {
      setShowAddModal(false)
      resetForm()
      fetchClients()
      alert('Cliente registado com sucesso!')
    }
    setSubmitting(false)
  }

  function handleEditClient(client: Client) {
    setEditingClient(client)
    setName(client.name)
    setPhone(client.phone)
    setEmail(client.email ?? '')
    setAddress(client.address || '')
    setFloorDetails(client.floor_details || '')
    setClientNotes(client.notes || '')
    setSourceChannel(client.source_channel || 'WhatsApp')
    setLatitude(client.latitude ?? null)
    setLongitude(client.longitude ?? null)
    setPaymentTerms(client.payment_terms || 'per_service')
    setViewingClient(null)
  }

  async function handleUpdateClient(e: React.FormEvent) {
    e.preventDefault()
    if (!editingClient) return
    setSubmitting(true)

    const formattedEmail = email || `${phone.replace(/\s+/g, '')}@rrservices.pt`
    const { error } = await supabase.from('clients').update({ 
      name, 
      phone, 
      email: formattedEmail, 
      address, 
      floor_details: floorDetails,
      notes: clientNotes,
      source_channel: sourceChannel,
      payment_terms: paymentTerms,
      latitude,
      longitude
    }).eq('id', editingClient.id)

    if (error) {
      alert('Erro ao atualizar cliente: ' + error.message)
    } else {
      setClients(current => current.map(client => client.id === editingClient.id ? { 
        ...client, 
        name, 
        phone, 
        email: formattedEmail, 
        address, 
        floor_details: floorDetails,
        notes: clientNotes,
        source_channel: sourceChannel,
        payment_terms: paymentTerms,
        latitude,
        longitude
      } : client).sort((a, b) => a.name.localeCompare(b.name, 'pt')))
      setEditingClient(null)
      resetForm()
      fetchClients()
      alert('Cliente atualizado com sucesso!')
    }
    setSubmitting(false)
  }

  function resetForm() {
    setName('')
    setPhone('')
    setEmail('')
    setAddress('')
    setFloorDetails('')
    setClientNotes('')
    setSourceChannel('WhatsApp')
    setLatitude(null)
    setLongitude(null)
    setPaymentTerms('per_service')
  }

  function closeClientForm() {
    setShowAddModal(false)
    setEditingClient(null)
    resetForm()
  }

  async function handleGerarAcessoWhatsApp(client: Client) {
    if (!confirm(`Deseja criar e vincular o acesso ao portal para ${client.name}?`)) {
      return
    }

    setGerandoAcesso(true)
    setAccessFeedback('')

    try {
      const response = await fetch('/api/admin/criar-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      })

      const result = await response.json() as { error?: string; clientId?: string; userId?: string; phone?: string; loginEmail?: string; password?: string }

      if (!response.ok) {
        setAccessFeedback(result.error || 'Não foi possível gerar acesso.')
        return
      }

      if (!result.clientId || !result.userId || !result.phone || !result.loginEmail || !result.password) {
        setAccessFeedback('A conta foi criada, mas a resposta veio incompleta.')
        return
      }
      const credentials = { clientId: result.clientId, phone: result.phone, loginEmail: result.loginEmail, password: result.password }
      setAccessCredentials(credentials)
      setAccessFeedback('Acesso criado e vinculado com sucesso.')
      const linkedClient = { ...client, auth_user_id: result.userId }
      setClients((current) => current.map((item) => item.id === client.id ? linkedClient : item))
      setViewingClient(linkedClient)
    } catch {
      setAccessFeedback('Ocorreu um erro de ligação ao gerar o acesso.')
    } finally {
      setGerandoAcesso(false)
    }
  }

  function buildAccessMessage(credentials: AccessCredentials, client: Client) {
    return `Olá ${client.name}! O seu acesso ao Portal do Cliente R&R Services está ativo.\n\nAceda a: ${window.location.origin}/login?next=%2Fcliente\n\nTelemóvel (utilizador): ${credentials.phone}\nE-mail de acesso alternativo: ${credentials.loginEmail}\nPalavra-passe temporária: ${credentials.password}\n\nGuarde estes dados num local seguro.`
  }

  async function copyAccessCredentials(client: Client) {
    if (!accessCredentials || accessCredentials.clientId !== client.id) return
    try {
      await navigator.clipboard.writeText(buildAccessMessage(accessCredentials, client))
      setAccessFeedback('Dados de acesso copiados.')
    } catch {
      setAccessFeedback('Não foi possível copiar automaticamente.')
    }
  }

  function sendAccessByWhatsApp(client: Client) {
    if (!accessCredentials || accessCredentials.clientId !== client.id) return
    const phone = accessCredentials.phone.replace(/\D/g, '')
    const message = encodeURIComponent(buildAccessMessage(accessCredentials, client))
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer')
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
    (c.email ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  )
  const accessFeedbackIsError = /não foi possível|ocorreu|inválido|já tem|precisa de|confirme/i.test(accessFeedback)

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
            onClick={() => { resetForm(); setShowAddModal(true); }}
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
          <article key={client.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-[#0B192C]">{client.name}</h2>
              <a href={`tel:${client.phone.replace(/\s+/g, '')}`} className="mt-1 inline-flex min-h-10 items-center text-sm text-slate-600">{client.phone}</a>
              <p className="truncate text-sm text-slate-500">{client.email}</p>
              <p className="mt-1 text-sm text-slate-500">{client.address || 'Sem morada'} {client.floor_details ? `(${client.floor_details})` : ''}</p>
            </div>
            <div className="pt-2 flex gap-2">
              <a 
                href={`https://wa.me/${client.phone.replace(/\D/g, '')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 min-h-10 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200"
              >
                💬 WhatsApp
              </a>
              <button onClick={() => handleEditClient(client)} className="min-h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">✏️ Editar</button>
              <button onClick={() => handleOpenView(client)} className="min-h-10 px-3 rounded-xl bg-cyan-50 text-xs font-bold text-[#0B192C]">Ficha 360°</button>
            </div>
          </article>
        ))}
      </div>

      {/* TABELA COM SCROLL HORIZONTAL PARA MOBILE */}
      <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[750px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="p-4">Nome</th>
                <th className="p-4">Telemóvel</th>
                <th className="p-4">E-mail</th>
                <th className="p-4">Morada (GPS / Andar)</th>
                <th className="p-4">Condição Pagamento</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">A carregar clientes...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Nenhum cliente encontrado.</td></tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-bold text-[#0B192C]">{c.name}</td>
                    <td className="p-4 text-slate-700">
                      <div className="flex items-center gap-2">
                        {c.phone}
                        <a 
                          href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          title="Enviar mensagem direta via WhatsApp"
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-1.5 rounded-lg border border-emerald-200 text-xs transition"
                        >
                          💬
                        </a>
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 text-xs">{c.email}</td>
                    <td className="p-4 text-slate-600 text-xs">
                      <div>{c.address || 'Sem morada'}</div>
                      {c.floor_details && <div className="text-slate-400 font-semibold mt-0.5">🚪 {c.floor_details}</div>}
                    </td>
                    <td className="p-4 text-xs font-semibold">
                      {c.payment_terms === 'monthly_invoice' ? (
                        <span className="bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-1 rounded-xl font-bold">📅 Mensal (Fim do Mês)</span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-xl font-bold">⚡ Por Serviço</span>
                      )}
                    </td>
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

      {/* MODAL NOVO CLIENTE / EDITAR CLIENTE */}
      {(showAddModal || editingClient) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
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

              {/* MORADA SEPARADA PARA O GPS */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold uppercase text-slate-700">Morada (Rua e Número p/ GPS) *</label>
                  <button
                    type="button"
                    disabled={geocoding}
                    onClick={() => handleGeocodeAddress(address)}
                    className="bg-[#00D4FF] hover:bg-[#00c2ea] text-[#0B192C] font-extrabold px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {geocoding ? '⌛ A validar...' : '📍 Validar GPS'}
                  </button>
                </div>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Avenida Doutor José Grilo Evangelista 148" 
                  value={address} 
                  onChange={e => setAddress(e.target.value)} 
                  className="w-full p-3.5 sm:p-3 border rounded-xl text-base sm:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]" 
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Insira apenas a rua e o número para garantir que o GPS encontra o local com precisão.</span>
              </div>

              {/* CAMPO SEPARADO PARA ANDAR / PORTA */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Andar / Porta / Bloco (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ex: 3º Direito, Bloco B" 
                  value={floorDetails} 
                  onChange={e => setFloorDetails(e.target.value)} 
                  className="w-full p-3.5 sm:p-3 border rounded-xl text-base sm:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* CONDIÇÕES DE PAGAMENTO */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Pagamento</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full p-3.5 sm:p-3 border rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF] font-semibold"
                  >
                    <option value="per_service">⚡ Por Serviço</option>
                    <option value="monthly_invoice">📅 Avença Mensal</option>
                  </select>
                </div>

                {/* CANAL DE ORIGEM */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Canal de Origem</label>
                  <select
                    value={sourceChannel}
                    onChange={(e) => setSourceChannel(e.target.value)}
                    className="w-full p-3.5 sm:p-3 border rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF] font-semibold"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Landing Page">Landing Page</option>
                    <option value="Passa-a-palavra">Passa-a-palavra</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              {/* NOTAS INTERNAS E PREFERÊNCIAS */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Notas Internas / Preferências</label>
                <textarea 
                  placeholder="Ex: Tem cão de pequeno porte; prefere produtos ecológicos..." 
                  value={clientNotes} 
                  onChange={e => setClientNotes(e.target.value)} 
                  className="w-full p-3.5 sm:p-3 border rounded-xl text-base sm:text-sm bg-slate-50 h-20 outline-none focus:ring-2 focus:ring-[#00D4FF]" 
                />
              </div>

              {latitude && longitude && (
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                  <span>✅ GPS Validado com sucesso!</span>
                  <span className="font-mono text-[10px]">{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
                </div>
              )}

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

      {/* MODAL FICHA 360° */}
      {viewingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#0B192C]">{viewingClient.name}</h3>
                <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">Origem: {viewingClient.source_channel || 'Desconhecida'}</span>
              </div>
              <button onClick={() => setViewingClient(null)} className="font-bold text-slate-400 hover:text-slate-600 p-2">✕</button>
            </div>

            <div className="space-y-2 text-xs sm:text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl">
              <div className="flex justify-between items-center">
                <p>📞 <strong>Telemóvel:</strong> {viewingClient.phone}</p>
                <a 
                  href={`https://wa.me/${viewingClient.phone.replace(/\D/g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded-xl text-xs flex items-center gap-1 shadow-xs"
                >
                  💬 Abrir WhatsApp
                </a>
              </div>
              <p>✉️ <strong>E-mail:</strong> {viewingClient.email}</p>
              <p>📍 <strong>Morada (GPS):</strong> {viewingClient.address || 'Não registada'}</p>
              {viewingClient.floor_details && <p>🚪 <strong>Andar / Porta:</strong> {viewingClient.floor_details}</p>}
              {viewingClient.notes && <p>📝 <strong>Notas / Preferências:</strong> <span className="text-amber-900 font-semibold">{viewingClient.notes}</span></p>}
              <p>💳 <strong>Condição de Pagamento:</strong> {viewingClient.payment_terms === 'monthly_invoice' ? '📅 Faturação Mensal (Fim do Mês)' : '⚡ Por Serviço'}</p>
              <p>⌖ <strong>Estado GPS:</strong> {viewingClient.latitude != null && viewingClient.longitude != null ? '✅ Coordenadas válidas registadas' : '⚠️ Sem coordenadas validadas'}</p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col gap-2">
              <span className="text-xs font-bold text-emerald-800">Acesso ao Portal do Cliente</span>
              {viewingClient.auth_user_id ? <p className="text-[11px] font-semibold text-emerald-800">Este cliente já tem uma conta vinculada.</p> : <>
                <p className="text-[11px] text-emerald-700">Será criada uma palavra-passe temporária e a conta ficará vinculada a esta ficha.</p>
                <button
                  type="button"
                  onClick={() => void handleGerarAcessoWhatsApp(viewingClient)}
                  disabled={gerandoAcesso}
                  className="mt-1 min-h-11 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {gerandoAcesso ? 'A gerar acesso...' : 'Criar acesso do cliente'}
                </button>
              </>}
              {accessCredentials?.clientId === viewingClient.id && <div className="mt-2 rounded-xl border border-emerald-200 bg-white p-3 text-xs text-slate-700">
                <p><strong>Telemóvel de acesso:</strong> {accessCredentials.phone}</p>
                <p className="mt-1 break-all"><strong>E-mail alternativo:</strong> {accessCredentials.loginEmail}</p>
                <p className="mt-1 break-all"><strong>Palavra-passe temporária:</strong> {accessCredentials.password}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => void copyAccessCredentials(viewingClient)} className="min-h-11 rounded-2xl border border-slate-200 px-3 font-bold text-slate-700 hover:bg-slate-50">Copiar dados</button>
                  <button type="button" onClick={() => sendAccessByWhatsApp(viewingClient)} className="min-h-11 rounded-2xl bg-emerald-600 px-3 font-bold text-white hover:bg-emerald-700">Enviar via WhatsApp</button>
                </div>
              </div>}
              {accessFeedback && <p role={accessFeedbackIsError ? 'alert' : 'status'} className={`text-xs font-semibold ${accessFeedbackIsError ? 'text-rose-700' : 'text-emerald-900'}`}>{accessFeedback}</p>}
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