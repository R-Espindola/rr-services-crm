'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface QuoteRecord {
  id: string
  client_id?: string | null
  client_name: string
  client_phone: string
  service_type: string
  address: string
  estimated_amount: number
  status: 'pending' | 'sent' | 'approved' | 'rejected'
  notes?: string | null
  created_at: string
}

interface ClientOption {
  id: string
  name: string
  phone: string
  address: string
}

export default function OrcamentosPage() {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [quoteForPDF, setQuoteForPDF] = useState<QuoteRecord | null>(null)

  // Formulário
  const [selectedClientId, setSelectedClientId] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [serviceType, setServiceType] = useState('Higienização de Estofos & Sofás')
  const [address, setAddress] = useState('')
  const [estimatedAmount, setEstimatedAmount] = useState('145')
  const [notes, setNotes] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchData = async () => {
    const { data: quotesData } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, name, phone, address')

    if (quotesData) setQuotes(quotesData)
    if (clientsData) setClients(clientsData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId)
    const client = clients.find((c) => c.id === clientId)
    if (client) {
      setClientName(client.name)
      setClientPhone(client.phone)
      setAddress(client.address)
    }
  }

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg(null)

    try {
      let activeClientId = selectedClientId

      // 1. Guarda na tabela 'clients' se for um cliente novo
      if (!activeClientId) {
        const { data: newClient } = await supabase
          .from('clients')
          .insert([
            {
              name: clientName,
              phone: clientPhone,
              address: address,
              total_services: 0
            }
          ])
          .select()
          .single()

        if (newClient) {
          activeClientId = newClient.id
        }
      }

      const parsedAmount = parseFloat(estimatedAmount.replace(',', '.')) || 145

      const payload = {
        client_id: activeClientId || null,
        client_name: clientName,
        client_phone: clientPhone,
        service_type: serviceType,
        address: address,
        estimated_amount: parsedAmount,
        status: 'pending',
        notes: notes || null
      }

      // 2. Inserir na tabela 'quotes'
      const { data: createdQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert([payload])
        .select()

      if (quoteError) {
        setErrorMsg(`Erro Supabase: ${quoteError.message}`)
        setSubmitting(false)
        return
      }

      // 3. Montar objeto para visualização imediata do PDF
      const pdfData: QuoteRecord = (createdQuote && createdQuote[0]) ? createdQuote[0] : {
        id: 'novo',
        client_id: activeClientId,
        client_name: clientName,
        client_phone: clientPhone,
        service_type: serviceType,
        address: address,
        estimated_amount: parsedAmount,
        status: 'pending',
        notes: notes,
        created_at: new Date().toISOString()
      }

      await fetchData()
      setIsModalOpen(false)

      // Abrir o modal com o modelo PDF
      setQuoteForPDF(pdfData)

      // Limpar campos do formulário
      setSelectedClientId('')
      setClientName('')
      setClientPhone('')
      setAddress('')
      setNotes('')
    } catch (err: any) {
      setErrorMsg(`Erro inesperado: ${err.message || String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleConvertToService = async (quote: QuoteRecord) => {
    if (!window.confirm(`Pretende converter o orçamento de "${quote.client_name}" num serviço agendado?`)) {
      return
    }

    try {
      const { error: orderError } = await supabase.from('orders').insert([
        {
          client_id: quote.client_id || null,
          service_type: quote.service_type,
          scheduled_date: new Date(Date.now() + 86400000 * 2).toISOString(),
          notes: `Cliente: ${quote.client_name} | Morada: ${quote.address}${quote.notes ? ` | Items: ${quote.notes}` : ''}`,
          status: 'pending',
          total_amount: quote.estimated_amount
        }
      ])

      if (orderError) {
        alert(`Erro ao criar agendamento: ${orderError.message}`)
        return
      }

      await supabase.from('quotes').update({ status: 'approved' }).eq('id', quote.id)
      alert('Orçamento convertido em Serviço Agendado com sucesso!')
      fetchData()
    } catch (err: any) {
      alert(`Erro ao converter: ${err.message}`)
    }
  }

  const handleUpdateStatus = async (quoteId: string, newStatus: QuoteRecord['status']) => {
    await supabase.from('quotes').update({ status: newStatus }).eq('id', quoteId)
    fetchData()
  }

  const handleDeleteQuote = async (quoteId: string) => {
    if (window.confirm('Tem a certeza que pretende apagar este orçamento?')) {
      await supabase.from('quotes').delete().eq('id', quoteId)
      fetchData()
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full">🟢 Aprovado / Convertido</span>
      case 'sent':
        return <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full">🔵 Proposta Enviada</span>
      case 'rejected':
        return <span className="bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-1 rounded-full">🔴 Recusado</span>
      default:
        return <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">🟡 Em Análise / Pendente</span>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">A carregar pipeline de orçamentos...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-[#0B192C]">
      {/* Cabeçalho */}
      <header className="bg-[#0B192C] text-white py-4 px-6 shadow-md flex justify-between items-center print:hidden">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard" className="text-2xl font-bold text-[#00D4FF]">R&R</Link>
          <span className="text-lg font-medium text-slate-200">Services — Gestão de Orçamentos & Propostas</span>
        </div>
        <Link
          href="/dashboard"
          className="bg-slate-800 text-slate-200 px-4 py-2 rounded-xl text-sm hover:bg-slate-700 transition"
        >
          ← Voltar ao Painel
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0B192C]">Pipeline de Orçamentos</h1>
            <p className="text-slate-600 text-sm">Gira propostas para potenciais clientes e converta-os em limpezas agendadas.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#0B192C] text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md hover:bg-slate-800 transition cursor-pointer"
          >
            + Novo Orçamento
          </button>
        </div>

        {/* Tabela de Orçamentos */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            {quotes.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Nenhum orçamento registado de momento. Clica em <strong>"+ Novo Orçamento"</strong> para criar a primeira proposta.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-4">Cliente / Contacto</th>
                    <th scope="col" className="px-6 py-4">Serviço Pretendido</th>
                    <th scope="col" className="px-6 py-4">Morada</th>
                    <th scope="col" className="px-6 py-4">Valor Estimado (€)</th>
                    <th scope="col" className="px-6 py-4">Estado</th>
                    <th scope="col" className="px-6 py-4 text-right">Ações CRM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotes.map((q) => {
                    const cleanPhone = q.client_phone.replace(/\D/g, '')
                    const waMsg = encodeURIComponent(`Olá ${q.client_name}! Apresentamos a proposta da R&R Services para ${q.service_type} no valor estimado de ${q.estimated_amount.toFixed(2)}€. Ficamos à disposição!`)

                    return (
                      <tr key={q.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-[#0B192C]">{q.client_name}</p>
                          <p className="text-xs text-slate-400">{q.client_phone}</p>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-800">{q.service_type}</td>
                        <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">{q.address}</td>
                        <td className="px-6 py-4 font-bold text-[#0B192C]">{q.estimated_amount.toFixed(2)} €</td>
                        <td className="px-6 py-4">{getStatusBadge(q.status)}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => setQuoteForPDF(q)}
                            className="bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-200 transition inline-block cursor-pointer"
                          >
                            📄 Gerar PDF
                          </button>

                          <a
                            href={`https://wa.me/${cleanPhone}?text=${waMsg}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleUpdateStatus(q.id, 'sent')}
                            className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition inline-block"
                          >
                            💬 WhatsApp
                          </a>

                          {q.status !== 'approved' && (
                            <button
                              onClick={() => handleConvertToService(q)}
                              className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-100 transition inline-block cursor-pointer"
                            >
                              ⚡ Converter
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteQuote(q.id)}
                            className="text-rose-600 hover:underline font-semibold text-xs cursor-pointer ml-1"
                          >
                            Apagar
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

      {/* Modal / Criar Novo Orçamento */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-[#0B192C]">Criar Nova Proposta de Orçamento</h3>
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

            <form onSubmit={handleCreateQuote} className="space-y-4">
              {clients.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Selecionar Cliente Existente <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleClientSelect(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800 bg-slate-50"
                  >
                    <option value="">-- Novo Potencial Cliente (Leads) --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Nome do Cliente / Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Roberta"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Telefone *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+351 969 177 571"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Tipo de Serviço
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800"
                >
                  <option value="Higienização de Estofos & Sofás">Higienização de Estofos & Sofás</option>
                  <option value="Limpeza Residencial Recorrente">Limpeza Residencial Recorrente</option>
                  <option value="Limpeza Profunda (Geral)">Limpeza Profunda (Geral)</option>
                  <option value="Limpeza Pós-Obras">Limpeza Pós-Obras</option>
                  <option value="Limpeza de Vidros & Sacadas">Limpeza de Vidros & Sacadas</option>
                  <option value="Limpeza Comercial / Escritórios">Limpeza Comercial / Escritórios</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Morada / Local
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Moita"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
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
                    value={estimatedAmount}
                    onChange={(e) => setEstimatedAmount(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-sm text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Observações / Lista de Itens <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: 1 - sofá, 1 - colchão solteiro, 1 - tapete..."
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
                  {submitting ? 'A criar...' : 'Gerar Orçamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Modelo PDF de Proposta */}
      {quoteForPDF && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex justify-center items-center p-4 z-50 print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 print:shadow-none print:border-none print:w-full print:max-w-none">
            {/* Botões do Modal */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 print:hidden">
              <h3 className="text-lg font-bold text-[#0B192C]">Proposta Pronta para Guardar / Imprimir</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => window.print()}
                  className="bg-[#0B192C] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                >
                  🖨️ Guardar PDF / Imprimir
                </button>
                <button
                  onClick={() => setQuoteForPDF(null)}
                  className="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
                >
                  ✕ Fechar
                </button>
              </div>
            </div>

            {/* DOCUMENTO PDF DE PROPOSTA */}
            <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-6">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-2xl font-bold text-[#0B192C]">R&R Services</h1>
                  <p className="text-xs text-slate-500 mt-1">Serviços Profissionais de Limpeza & Higienização</p>
                  <p className="text-xs text-slate-500">contacto@rrservices.pt | Setúbal & Lisboa</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase block">Proposta de Orçamento</span>
                  <span className="text-sm font-semibold text-[#00D4FF]">#ORC-{quoteForPDF.id.substring(0, 6).toUpperCase()}</span>
                  <p className="text-xs text-slate-500 mt-1">Data: {new Date(quoteForPDF.created_at).toLocaleDateString('pt-PT')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-xs">
                <div>
                  <span className="font-bold text-slate-400 uppercase block mb-1">Dados do Cliente</span>
                  <p className="font-bold text-[#0B192C] text-sm">{quoteForPDF.client_name}</p>
                  <p className="text-slate-600 mt-0.5">Contacto: {quoteForPDF.client_phone}</p>
                  <p className="text-slate-600">Localização: {quoteForPDF.address}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase block mb-1">Serviço Pretendido</span>
                  <p className="font-bold text-[#0B192C] text-sm">{quoteForPDF.service_type}</p>
                  <p className="text-slate-600 mt-0.5">Validade da Proposta: 15 dias</p>
                </div>
              </div>

              {quoteForPDF.notes && (
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block mb-2">Descrição dos Itens / Observações</span>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                    {quoteForPDF.notes}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
                <span className="text-xs text-slate-500">Obrigado pela preferência nos serviços da R&R Services!</span>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase block">Valor Total Estimado</span>
                  <span className="text-2xl font-bold text-[#0B192C]">{quoteForPDF.estimated_amount.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}