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

export interface Quote {
  id: string
  client_id: string
  service_type: string
  typology?: string
  frequency?: string
  subtotal: number
  discount: number
  vat_rate: number
  total: number
  estimated_cost: number
  margin_percentage: number
  status: 'pending' | 'sent' | 'approved' | 'rejected'
  valid_until?: string
  notes?: string
  created_at: string
  clients?: Client
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  // Modais
  const [showModal, setShowModal] = useState(false)
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Campos do Formulário de Orçamento
  const [selectedClientId, setSelectedClientId] = useState('')
  const [serviceType, setServiceType] = useState('Limpeza Residencial')
  const [typology, setTypology] = useState('T2')
  const [frequency, setFrequency] = useState('Semanal')
  const [subtotal, setSubtotal] = useState('')
  const [discount, setDiscount] = useState('0')
  const [vatRate, setVatRate] = useState('23')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [validDays, setValidDays] = useState('30')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const { data: quotesData } = await supabase
      .from('quotes')
      .select('*, clients(id, name, phone, email, address)')
      .order('created_at', { ascending: false })

    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, name, phone, email, address')
      .order('name', { ascending: true })

    if (quotesData) setQuotes(quotesData as Quote[])
    if (clientsData) setClients(clientsData as Client[])

    setLoading(false)
  }

  const subtotalNum = parseFloat(subtotal) || 0
  const discountNum = parseFloat(discount) || 0
  const vatRateNum = parseFloat(vatRate) || 0
  const estimatedCostNum = parseFloat(estimatedCost) || 0

  const basePriceAfterDiscount = Math.max(0, subtotalNum - discountNum)
  const vatAmount = (basePriceAfterDiscount * vatRateNum) / 100
  const totalVal = basePriceAfterDiscount + vatAmount

  const profitMargin = basePriceAfterDiscount > 0
    ? (((basePriceAfterDiscount - estimatedCostNum) / basePriceAfterDiscount) * 100).toFixed(1)
    : '0.0'

  async function handleCreateQuote(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClientId) {
      alert('Por favor, selecione um cliente.')
      return
    }

    setSubmitting(true)

    const validUntilDate = new Date()
    validUntilDate.setDate(validUntilDate.getDate() + (parseInt(validDays) || 30))

    const payload = {
      client_id: selectedClientId,
      service_type: serviceType,
      typology: typology || 'T2',
      frequency: frequency || 'Pontual',
      subtotal: subtotalNum,
      discount: discountNum,
      vat_rate: vatRateNum,
      total: totalVal,
      estimated_cost: estimatedCostNum,
      margin_percentage: parseFloat(profitMargin) || 0,
      status: 'pending',
      valid_until: validUntilDate.toISOString().split('T')[0],
      notes: notes || null,
    }

    const { error } = await supabase.from('quotes').insert([payload])

    if (error) {
      alert('Erro ao criar orçamento: ' + error.message)
    } else {
      closeModal()
      fetchData()
    }
    setSubmitting(false)
  }

  async function handleUpdateQuoteStatus(quoteId: string, newStatus: string) {
    const { error } = await supabase
      .from('quotes')
      .update({ status: newStatus })
      .eq('id', quoteId)

    if (error) {
      alert('Erro ao atualizar estado: ' + error.message)
    } else {
      fetchData()
    }
  }

  async function handleConvertToOrder(quote: Quote) {
    if (!confirm(`Deseja agendar o serviço para o cliente com base neste orçamento aprovado?`)) {
      return
    }

    const { error } = await supabase.rpc('admin_criar_agendamento_seguro', {
      p_client_id: quote.client_id,
      p_service_type: `${quote.service_type} (${quote.typology || 'T2'} - ${quote.frequency || 'Pontual'})`,
      p_scheduled_date: new Date().toISOString(),
      p_total_amount: quote.total,
      p_notes: `Gerado a partir do Orçamento. ${quote.notes || ''}`,
    })

    if (error) {
      alert('Erro ao converter em agendamento: ' + error.message)
    } else {
      await supabase.from('quotes').update({ status: 'approved' }).eq('id', quote.id)
      alert('Serviço agendado com sucesso no módulo de Serviços & Intervenções!')
      fetchData()
    }
  }

  function closeModal() {
    setShowModal(false)
    setViewingQuote(null)
    setSelectedClientId('')
    setServiceType('Limpeza Residencial')
    setTypology('T2')
    setFrequency('Semanal')
    setSubtotal('')
    setDiscount('0')
    setVatRate('23')
    setEstimatedCost('')
    setNotes('')
  }

  function handlePrintPDF() {
    window.print()
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 text-[#0B192C] p-4 sm:p-6 md:p-8">
      {/* Estilos para Impressão limpa do PDF */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* CABEÇALHO & BOTÃO ADICIONAR */}
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B192C]">Propostas & Orçamentos</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Gere propostas comerciais com cálculo de margem interna, IVA e converta em agendamentos diretos.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-[#0B192C] hover:bg-slate-800 text-white font-bold px-6 py-3.5 sm:py-3 rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-2 border border-slate-700 text-xs sm:text-sm text-center"
        >
          <span>+ Criar Novo Orçamento</span>
        </button>
      </div>

      {/* TABELA DE ORÇAMENTOS */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-6">Cliente</th>
                <th className="py-4 px-6">Tipo & Tipologia</th>
                <th className="py-4 px-6">Frequência</th>
                <th className="py-4 px-6">Valor Total (c/ IVA)</th>
                <th className="py-4 px-6">Margem Lucro</th>
                <th className="py-4 px-6">Estado</th>
                <th className="py-4 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">A carregar propostas comerciais...</td>
                </tr>
              ) : quotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    Nenhum orçamento criado. Clique no botão acima para criar a primeira proposta.
                  </td>
                </tr>
              ) : (
                quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-bold text-[#0B192C]">
                      {q.clients?.name || 'Cliente'}
                      <div className="text-xs font-normal text-slate-400">{q.clients?.phone}</div>
                    </td>
                    <td className="py-4 px-6 text-slate-700 font-medium text-xs sm:text-sm">
                      {q.service_type}
                      <span className="text-xs font-bold text-[#00D4FF] block">{q.typology}</span>
                    </td>
                    <td className="py-4 px-6 text-slate-600 text-xs font-medium">{q.frequency}</td>
                    <td className="py-4 px-6 font-extrabold text-[#0B192C]">
                      {Number(q.total || 0).toFixed(2)} €
                    </td>
                    <td className="py-4 px-6 font-bold text-emerald-600 text-xs">
                      {q.margin_percentage || 0}%
                    </td>
                    <td className="py-4 px-6">
                      <select
                        value={q.status}
                        onChange={(e) => handleUpdateQuoteStatus(q.id, e.target.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold outline-none cursor-pointer border shadow-sm ${
                          q.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : q.status === 'sent'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : q.status === 'rejected'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <option value="pending">Pendente</option>
                        <option value="sent">Enviado</option>
                        <option value="approved">Aprovado</option>
                        <option value="rejected">Recusado</option>
                      </select>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setViewingQuote(q)}
                          className="bg-slate-100 hover:bg-[#00D4FF]/10 hover:text-[#0B192C] text-slate-700 font-bold px-3.5 py-2 rounded-xl border border-slate-200 text-xs transition cursor-pointer flex items-center gap-1"
                        >
                          👁️ Ver PDF
                        </button>
                        <button
                          onClick={() => handleConvertToOrder(q)}
                          className="bg-[#0B192C] hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer"
                        >
                          ⚡ Agendar
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

      {/* MODAL / FOLHA FORMAL DE PROPOSTA COMERCIAL E GERADOR PDF (Adaptado para iPhone/Mobile) */}
      {viewingQuote && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto my-auto">
            {/* AÇÕES NO TOPO */}
            <div className="flex justify-between items-center mb-6 no-print border-b border-slate-100 pb-4">
              <span className="text-xs font-bold text-slate-400 uppercase">Proposta Comercial Formal</span>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  onClick={handlePrintPDF}
                  className="bg-[#0B192C] hover:bg-slate-800 text-white px-4 py-3 sm:py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  📄 Imprimir / Guardar PDF
                </button>
                <button
                  onClick={closeModal}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-3 sm:py-2 rounded-xl text-xs font-bold transition cursor-pointer text-center"
                >
                  ✕ Fechar
                </button>
              </div>
            </div>

            {/* ÁREA FORMAL IMPRESSA (PDF) */}
            <div id="print-area" className="p-4 sm:p-6 bg-white text-[#0B192C] space-y-6 rounded-2xl border border-slate-200">
              {/* CABEÇALHO DO DOCUMENTO */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-6 gap-4">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl font-black text-[#00D4FF] bg-[#0B192C] px-3 py-1 rounded-xl">R&R</span>
                    <span className="text-xl font-bold text-[#0B192C]">Services</span>
                  </div>
                  <p className="text-xs text-slate-500">Serviços Profissionais de Limpeza & Manutenção</p>
                  <p className="text-xs text-slate-500">Portugal | Contacto: +351 969 177 571</p>
                </div>
                <div className="text-left sm:text-right">
                  <h3 className="text-lg font-black text-[#0B192C] uppercase">Orçamento</h3>
                  <p className="text-xs font-bold text-[#00D4FF]">#{viewingQuote.id.substring(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-slate-400 mt-1">Data: {new Date(viewingQuote.created_at).toLocaleDateString('pt-PT')}</p>
                </div>
              </div>

              {/* DADOS DO CLIENTE */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase block mb-1">Cliente Destinatário</span>
                <p className="text-sm font-bold text-[#0B192C]">{viewingQuote.clients?.name || 'Cliente'}</p>
                <p className="text-xs text-slate-600">📞 {viewingQuote.clients?.phone}</p>
                <p className="text-xs text-slate-600">✉️ {viewingQuote.clients?.email}</p>
                {viewingQuote.clients?.address && (
                  <p className="text-xs text-slate-600 mt-1">📍 Morada: {viewingQuote.clients.address}</p>
                )}
              </div>

              {/* DETALHES DO SERVIÇO */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-[#0B192C] text-white font-bold uppercase text-[10px]">
                      <th className="py-3 px-4 rounded-l-xl">Descrição do Serviço</th>
                      <th className="py-3 px-4">Tipologia</th>
                      <th className="py-3 px-4">Frequência</th>
                      <th className="py-3 px-4 text-right rounded-r-xl">Valor Base</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-4 px-4 font-bold text-[#0B192C]">{viewingQuote.service_type}</td>
                      <td className="py-4 px-4 font-medium text-slate-700">{viewingQuote.typology || 'T2'}</td>
                      <td className="py-4 px-4 font-medium text-slate-700">{viewingQuote.frequency || 'Pontual'}</td>
                      <td className="py-4 px-4 font-bold text-[#0B192C] text-right">{Number(viewingQuote.subtotal || 0).toFixed(2)} €</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* RESUMO DE VALORES */}
              <div className="flex justify-end pt-2">
                <div className="w-full sm:w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-bold">{Number(viewingQuote.subtotal || 0).toFixed(2)} €</span>
                  </div>
                  {Number(viewingQuote.discount || 0) > 0 && (
                    <div className="flex justify-between text-red-600 font-semibold">
                      <span>Desconto Especial:</span>
                      <span>{Number(viewingQuote.discount).toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>IVA ({viewingQuote.vat_rate || 23}%):</span>
                    <span className="font-bold">
                      {(((Number(viewingQuote.subtotal || 0) - Number(viewingQuote.discount || 0)) * (viewingQuote.vat_rate || 23)) / 100).toFixed(2)} €
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-[#0B192C] border-t border-slate-300 pt-2">
                    <span>Total da Proposta:</span>
                    <span className="text-[#00D4FF] bg-[#0B192C] px-2.5 py-1 rounded-lg">{Number(viewingQuote.total || 0).toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              {/* CONDIÇÕES E NOTAS */}
              {viewingQuote.notes && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">Condições da Proposta & Observações:</span>
                  <p className="text-slate-600 italic">{viewingQuote.notes}</p>
                </div>
              )}

              {/* RODAPÉ DO DOCUMENTO */}
              <div className="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-400">
                Proposta válida até {viewingQuote.valid_until ? new Date(viewingQuote.valid_until).toLocaleDateString('pt-PT') : '30 dias'}. Obrigado pela confiança na R&R Services!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA CRIAR NOVO ORÇAMENTO (Adaptado para iPhone/Mobile) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0B192C]">Criar Nova Proposta Comercial</h2>
                <p className="text-xs text-slate-500 mt-1">Defina os valores do serviço e analise a margem de lucro interna.</p>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl font-bold p-2">✕</button>
            </div>

            <form onSubmit={handleCreateQuote} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cliente *</label>
                <select
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-4 py-3.5 sm:py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-base sm:text-sm font-medium"
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tipo de Serviço</label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full px-4 py-3.5 sm:py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-base sm:text-sm font-medium"
                  >
                    <option value="Limpeza Residencial">Limpeza Residencial</option>
                    <option value="Limpeza Profunda">Limpeza Profunda</option>
                    <option value="Pós-Obra">Pós-Obra</option>
                    <option value="Escritórios & Comercial">Escritórios & Comercial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tipologia</label>
                  <input
                    type="text"
                    value={typology}
                    onChange={(e) => setTypology(e.target.value)}
                    placeholder="Ex: T2, T3"
                    className="w-full px-4 py-3.5 sm:py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-base sm:text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Frequência</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-4 py-3.5 sm:py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-base sm:text-sm font-medium"
                  >
                    <option value="Pontual">Pontual</option>
                    <option value="Semanal">Semanal</option>
                    <option value="Quinzenal">Quinzenal</option>
                    <option value="Mensal">Mensal</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cálculo Financeiro & Custos Internos</h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Preço Base (€) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={subtotal}
                      onChange={(e) => setSubtotal(e.target.value)}
                      placeholder="Ex: 100.00"
                      className="w-full px-4 py-3.5 sm:py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-white text-base sm:text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Desconto (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="w-full px-4 py-3.5 sm:py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-white text-base sm:text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Taxa IVA (%)</label>
                    <input
                      type="number"
                      value={vatRate}
                      onChange={(e) => setVatRate(e.target.value)}
                      className="w-full px-4 py-3.5 sm:py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-white text-base sm:text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 pt-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Custo Estimado Interno (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      placeholder="Ex: 40.00"
                      className="w-full px-4 py-3.5 sm:py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-white text-base sm:text-sm font-bold"
                    />
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Margem Bruta</span>
                      <span className="text-base sm:text-lg font-extrabold text-emerald-600">{profitMargin}%</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total c/ IVA</span>
                      <span className="text-base sm:text-lg font-extrabold text-[#0B192C]">{totalVal.toFixed(2)} €</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Condições & Observações</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Inclui produtos e equipamentos..."
                  className="w-full px-4 py-3.5 sm:py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-base sm:text-sm font-medium h-20"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full sm:w-auto px-5 py-3.5 sm:py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold text-xs sm:text-sm transition text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-7 py-3.5 sm:py-3 bg-[#0B192C] hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition disabled:opacity-50 cursor-pointer text-center"
                >
                  {submitting ? 'A guardar...' : 'Gerar Proposta Comercial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
