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

interface PricingRule {
  id: string
  valid_from: string
  service_type: string
  typology: string
  frequency: string
  base_price: number | string
  extra_hourly_rate: number | string
}

const HOURLY_INTERNAL_COST = 9.5
const REGIONAL_TRAVEL_COST = 3.5
const SUPPLIES_COST_RATE = 0.05
const SERVICE_TYPES = [
  'Limpeza Residencial',
  'Limpeza Comercial / Escritórios',
  'Higienização de Estofados',
  'Limpeza Profunda / Pós-Obra',
  'Vidros e Caixilharia',
] as const

const todayLocal = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function currentRulesFor(rules: PricingRule[], serviceType: string, frequency?: string) {
  const latestByKey = new Map<string, PricingRule>()
  rules
    .filter((rule) => rule.service_type === serviceType && (!frequency || rule.frequency === frequency) && rule.valid_from <= todayLocal())
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from))
    .forEach((rule) => {
      const key = `${rule.frequency}:${rule.typology}`
      if (!latestByKey.has(key)) latestByKey.set(key, rule)
    })
  return [...latestByKey.values()]
}

const frequencyLabel = (frequency: string) => {
  if (frequency === 'pontual') return 'Pontual'
  if (frequency === 'semanal') return 'Semanal'
  if (frequency === 'quinzenal') return 'Quinzenal'
  if (frequency === '3x/semana') return '3 vezes por semana'
  return frequency.charAt(0).toUpperCase() + frequency.slice(1)
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
  estimated_cost: number | null
  estimated_hours?: number | null
  regional_travel_cost?: number
  consumables_cost?: number
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
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Quote['status']>('all')

  // Modais
  const [showModal, setShowModal] = useState(false)
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Campos do Formulário de Orçamento (Sem duplicados)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [isNewClient, setIsNewClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientAddress, setNewClientAddress] = useState('')
  const [serviceType, setServiceType] = useState('Limpeza Residencial')
  const [typology, setTypology] = useState('T2')
  const [frequency, setFrequency] = useState('semanal')
  const [subtotal, setSubtotal] = useState('')
  const [discount, setDiscount] = useState('0')
  const [estimatedHours, setEstimatedHours] = useState('3')
  const [notes, setNotes] = useState('')
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([])
  const [priceMatched, setPriceMatched] = useState(false)

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

    const { data: pricingData, error: pricingError } = await supabase
      .from('pricing_rules')
      .select('id, valid_from, service_type, typology, frequency, base_price, extra_hourly_rate')
      .lte('valid_from', todayLocal())
      .order('valid_from', { ascending: false })

    if (quotesData) setQuotes(quotesData as Quote[])
    if (clientsData) setClients(clientsData as Client[])
    if (!pricingError) {
      const rules = (pricingData ?? []) as PricingRule[]
      setPricingRules(rules)
      const initialRule = currentRulesFor(rules, 'Limpeza Residencial', 'semanal').find((rule) => rule.typology === 'T2')
        ?? currentRulesFor(rules, 'Limpeza Residencial', 'semanal')[0]
      if (initialRule) {
        setServiceType(initialRule.service_type)
        setFrequency(initialRule.frequency)
        setTypology(initialRule.typology)
        setSubtotal(Number(initialRule.base_price).toFixed(2))
        setPriceMatched(true)
      }
    }
    setLoading(false)
  }

  const subtotalNum = parseFloat(subtotal) || 0
  const discountNum = parseFloat(discount) || 0
  const estimatedHoursNum = Math.max(0, parseFloat(estimatedHours) || 0)
  const laborCostNum = estimatedHoursNum * HOURLY_INTERNAL_COST
  const consumablesCostNum = subtotalNum * SUPPLIES_COST_RATE
  const estimatedCostNum = laborCostNum + REGIONAL_TRAVEL_COST + consumablesCostNum
  const vatRateNum = 0

  const basePriceAfterDiscount = Math.max(0, subtotalNum - discountNum)
  const vatAmount = (basePriceAfterDiscount * vatRateNum) / 100
  const totalVal = basePriceAfterDiscount + vatAmount

  const profitMargin = totalVal > 0
    ? (((totalVal - estimatedCostNum) / totalVal) * 100).toFixed(1)
    : '0.0'

  const rulesForService = currentRulesFor(pricingRules, serviceType)
  const availableFrequencies = [...new Set(rulesForService.map((rule) => rule.frequency))]
  const rulesForSelection = currentRulesFor(pricingRules, serviceType, frequency)
  const availableTypologies = [...new Set(rulesForSelection.map((rule) => rule.typology))]
  const selectedPricingRule = rulesForSelection.find((rule) => rule.typology === typology)

  function handlePricingSelection(nextService: string, nextFrequency?: string, nextTypology?: string) {
    const rules = currentRulesFor(pricingRules, nextService)
    const selectedFrequency = nextFrequency && rules.some((rule) => rule.frequency === nextFrequency)
      ? nextFrequency
      : rules[0]?.frequency ?? nextFrequency ?? ''
    const choices = currentRulesFor(pricingRules, nextService, selectedFrequency)
    const selectedRule = choices.find((rule) => rule.typology === nextTypology) ?? choices[0]

    setServiceType(nextService)
    setFrequency(selectedFrequency)
    setTypology(selectedRule?.typology ?? '')
    setPriceMatched(Boolean(selectedRule))
    setSubtotal(selectedRule ? Number(selectedRule.base_price).toFixed(2) : '')
  }

  const currentMonthQuotes = quotes.filter((quote) => {
    const createdAt = new Date(quote.created_at)
    const now = new Date()
    return createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth()
  })
  const quotesWithDecision = quotes.filter((quote) => quote.status === 'approved' || quote.status === 'rejected')
  const approvalRate = quotesWithDecision.length
    ? (quotesWithDecision.filter((quote) => quote.status === 'approved').length / quotesWithDecision.length) * 100
    : 0
  const totalBudgetedThisMonth = currentMonthQuotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0)
  const approvedReadyTotal = quotes.filter((quote) => quote.status === 'approved').reduce((sum, quote) => sum + Number(quote.total || 0), 0)
  const filteredQuotes = quotes.filter((quote) => {
    const matchesName = (quote.clients?.name ?? '').toLowerCase().includes(searchTerm.trim().toLowerCase())
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter
    return matchesName && matchesStatus
  })

  function quoteGrossMargin(quote: Quote) {
    const finalPrice = Number(quote.total || 0)
    const isOperationalCostBreakdownStored = quote.estimated_hours != null
      && quote.regional_travel_cost != null
      && quote.consumables_cost != null
    const internalCost = isOperationalCostBreakdownStored
      ? Number(quote.estimated_cost || 0)
      : Number(quote.estimated_cost || 0) + REGIONAL_TRAVEL_COST + Number(quote.subtotal || 0) * SUPPLIES_COST_RATE
    return finalPrice > 0 ? ((finalPrice - internalCost) / finalPrice) * 100 : 0
  }

  function whatsappUrl(quote: Quote) {
    const digits = (quote.clients?.phone ?? '').replace(/\D/g, '')
    if (!digits) return null
    const internationalPhone = digits.startsWith('00') ? digits.slice(2) : digits.startsWith('351') ? digits : `351${digits.replace(/^0+/, '')}`
    const message = [
      `Olá ${quote.clients?.name || 'Cliente'}, segue o resumo da sua proposta R&R Services:`,
      `Serviço: ${quote.service_type}${quote.typology ? ` (${quote.typology})` : ''}`,
      `Frequência: ${frequencyLabel(quote.frequency || 'pontual')}`,
      `Valor total: ${Number(quote.total || 0).toFixed(2)} €`,
      Number(quote.vat_rate || 0) === 0 ? 'IVA — regime de isenção, artigo 53.º do CIVA.' : `IVA incluído à taxa registada de ${quote.vat_rate}%.`,
      quote.valid_until ? `Proposta válida até: ${new Date(`${quote.valid_until}T12:00:00`).toLocaleDateString('pt-PT')}.` : '',
      'Para aceitar ou esclarecer algum detalhe, responda a esta mensagem. Obrigado pela preferência!',
    ].filter(Boolean).join('\n')
    return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`
  }

  function openCreateModal() {
    const currentRule = rulesForSelection.find((rule) => rule.typology === typology) ?? rulesForSelection[0]
    if (currentRule) {
      setTypology(currentRule.typology)
      setSubtotal(Number(currentRule.base_price).toFixed(2))
      setPriceMatched(true)
    }
    setShowModal(true)
  }

  async function handleCreateQuote(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    let clientIdToUse = selectedClientId

    if (isNewClient || !selectedClientId) {
      if (!newClientName.trim()) {
        alert('Por favor, insira o nome do cliente.')
        setSubmitting(false)
        return
      }

      const { data: createdClient, error: clientError } = await supabase
        .from('clients')
        .insert([
          {
            name: newClientName,
            phone: newClientPhone || null,
            email: newClientEmail || null,
            address: newClientAddress || null,
          },
        ])
        .select('id')
        .single()

      if (clientError || !createdClient) {
        alert('Erro ao registar o novo cliente: ' + (clientError?.message || 'Erro desconhecido'))
        setSubmitting(false)
        return
      }

      clientIdToUse = createdClient.id
    }

    const validUntilDate = new Date()
    validUntilDate.setDate(validUntilDate.getDate() + 30)

    const payload = {
      client_id: clientIdToUse,
      service_type: serviceType,
      typology: typology || 'T2',
      frequency: frequency || 'Pontual',
      subtotal: subtotalNum,
      discount: discountNum,
      vat_rate: vatRateNum,
      total: totalVal,
      estimated_cost: estimatedCostNum,
      estimated_hours: estimatedHoursNum,
      regional_travel_cost: REGIONAL_TRAVEL_COST,
      consumables_cost: consumablesCostNum,
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
    if (quote.status !== 'approved') return
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
    setIsNewClient(false)
    setNewClientName('')
    setNewClientPhone('')
    setNewClientEmail('')
    setNewClientAddress('')
    setServiceType('Limpeza Residencial')
    setTypology('T2')
    setFrequency('semanal')
    setSubtotal('')
    setDiscount('0')
    setEstimatedHours('3')
    setNotes('')
  }

  function handlePrintPDF() {
    window.print()
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 text-[#0B192C] p-4 sm:p-6 md:p-8">
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
            Gere propostas, acompanhe a margem após custos internos e converta propostas aprovadas em marcações.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="bg-[#0B192C] hover:bg-slate-800 text-white font-bold px-6 py-3.5 sm:py-3 rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-2 border border-slate-700 text-xs sm:text-sm text-center"
        >
          <span>+ Criar Novo Orçamento</span>
        </button>
      </div>

      {/* MÉTRICAS COMERCIAIS */}
      <section aria-label="Métricas de orçamentos" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Orçamentado · Mês Atual</p>
          <p className="mt-2 text-2xl font-extrabold text-[#0B192C]">{totalBudgetedThisMonth.toFixed(2)} €</p>
          <p className="mt-1 text-xs text-slate-500">{currentMonthQuotes.length} propostas criadas este mês</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Taxa de Aprovação</p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-700">{approvalRate.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-slate-500">Aprovados ÷ propostas aprovadas ou recusadas</p>
        </article>
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm sm:col-span-2 xl:col-span-1">
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-900">Valor Aprovado Pronto a Agendar</p>
          <p className="mt-2 text-2xl font-extrabold text-[#0B192C]">{approvedReadyTotal.toFixed(2)} €</p>
          <p className="mt-1 text-xs text-cyan-900">Soma das propostas aprovadas ainda disponíveis</p>
        </article>
      </section>

      {/* PESQUISA E FILTRO */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Pesquisar pelo nome do cliente</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Pesquisar pelo nome do cliente…"
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <span>Estado</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-11 min-w-40 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100">
            <option value="all">Todos</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovado</option>
            <option value="rejected">Recusado</option>
          </select>
        </label>
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
                <th className="py-4 px-6">Valor Total</th>
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
              ) : filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    {quotes.length === 0 ? 'Nenhum orçamento criado. Clique no botão acima para criar a primeira proposta.' : 'Nenhum orçamento corresponde à pesquisa e ao estado selecionados.'}
                  </td>
                </tr>
              ) : (
                filteredQuotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-bold text-[#0B192C]">
                      {q.clients?.name || 'Cliente'}
                      <div className="text-xs font-normal text-slate-400">{q.clients?.phone}</div>
                    </td>
                    <td className="py-4 px-6 text-slate-700 font-medium text-xs sm:text-sm">
                      {q.service_type}
                      <span className="text-xs font-bold text-[#00D4FF] block">{q.typology}</span>
                    </td>
                    <td className="py-4 px-6 text-slate-600 text-xs font-medium">{frequencyLabel(q.frequency || 'pontual')}</td>
                    <td className="py-4 px-6 font-extrabold text-[#0B192C]">
                      {Number(q.total || 0).toFixed(2)} €
                    </td>
                    <td className={`py-4 px-6 font-bold text-xs ${quoteGrossMargin(q) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {quoteGrossMargin(q).toFixed(1)}%
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
                        {whatsappUrl(q) ? (
                          <a
                            href={whatsappUrl(q)!}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Enviar proposta de ${q.clients?.name || 'cliente'} pelo WhatsApp`}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-3.5 py-2 rounded-xl border border-emerald-200 text-xs transition cursor-pointer flex items-center gap-1"
                          >
                            📲 Enviar WhatsApp
                          </a>
                        ) : (
                          <button type="button" disabled title="Este cliente não tem telemóvel registado" className="bg-slate-100 text-slate-400 font-bold px-3.5 py-2 rounded-xl border border-slate-200 text-xs opacity-60 cursor-not-allowed">
                            📲 Enviar WhatsApp
                          </button>
                        )}
                        <button
                          onClick={() => handleConvertToOrder(q)}
                          disabled={q.status !== 'approved'}
                          title={q.status !== 'approved' ? 'A proposta precisa de estar aprovada para ser agendada' : 'Agendar serviço aprovado'}
                          className="bg-[#0B192C] hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#0B192C]"
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

      {/* MODAL DE VISUALIZAÇÃO DE PDF */}
      {viewingQuote && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto my-auto">
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

            <div id="print-area" className="p-4 sm:p-6 bg-white text-[#0B192C] space-y-6 rounded-2xl border border-slate-200">
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

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase block mb-1">Cliente Destinatário</span>
                <p className="text-sm font-bold text-[#0B192C]">{viewingQuote.clients?.name || 'Cliente'}</p>
                <p className="text-xs text-slate-600">📞 {viewingQuote.clients?.phone}</p>
                <p className="text-xs text-slate-600">✉️ {viewingQuote.clients?.email}</p>
                {viewingQuote.clients?.address && (
                  <p className="text-xs text-slate-600 mt-1">📍 Morada: {viewingQuote.clients.address}</p>
                )}
              </div>

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
                      <td className="py-4 px-4 font-medium text-slate-700">{frequencyLabel(viewingQuote.frequency || 'pontual')}</td>
                      <td className="py-4 px-4 font-bold text-[#0B192C] text-right">{Number(viewingQuote.subtotal || 0).toFixed(2)} €</td>
                    </tr>
                  </tbody>
                </table>
              </div>

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
                  <div className="flex justify-between gap-3 text-slate-600">
                    <span>{Number(viewingQuote.vat_rate || 0) === 0 ? 'IVA — regime de isenção (art.º 53.º do CIVA):' : `IVA (${viewingQuote.vat_rate}% — registo histórico):`}</span>
                    <span className="shrink-0 font-bold">{Number(viewingQuote.vat_rate || 0) === 0 ? '0,00 €' : (((Number(viewingQuote.subtotal || 0) - Number(viewingQuote.discount || 0)) * Number(viewingQuote.vat_rate || 0)) / 100).toFixed(2) + ' €'}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-[#0B192C] border-t border-slate-300 pt-2">
                    <span>Total da Proposta:</span>
                    <span className="text-[#00D4FF] bg-[#0B192C] px-2.5 py-1 rounded-lg">{Number(viewingQuote.total || 0).toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              {viewingQuote.notes && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">Condições da Proposta & Observações:</span>
                  <p className="text-slate-600 italic">{viewingQuote.notes}</p>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-400">
                Proposta válida até {viewingQuote.valid_until ? new Date(viewingQuote.valid_until).toLocaleDateString('pt-PT') : '30 dias'}. Obrigado pela confiança na R&R Services!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA CRIAR NOVO ORÇAMENTO (Com alternância Cliente Existente / Avulso) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-8 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto my-auto space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#0B192C]">Criar Nova Proposta</h2>
                <p className="text-xs text-slate-500 mt-0.5">Selecione o cliente, tarifa e verifique os custos internos.</p>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-700 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 font-bold text-sm transition">✕</button>
            </div>

            <form onSubmit={handleCreateQuote} className="space-y-4">
              {/* SELETOR DE CLIENTE EXISTENTE OU NOVO AVULSO */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Cliente Destinatário *</label>
                  <button
                    type="button"
                    onClick={() => setIsNewClient(!isNewClient)}
                    className="text-xs font-bold text-[#00D4FF] hover:underline"
                  >
                    {isNewClient ? '← Selecionar cliente existente' : '+ Criar cliente novo avulso'}
                  </button>
                </div>

                {!isNewClient ? (
                  <select
                    required={!isNewClient}
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-4 py-3.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-[#0B192C]"
                  >
                    <option value="">Selecione um cliente registado...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <p className="text-[11px] font-bold text-slate-500 uppercase">Registar Novo Cliente Rápido</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required={isNewClient}
                        placeholder="Nome do Cliente *"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        className="p-3 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-[#00D4FF]"
                      />
                      <input
                        type="text"
                        placeholder="Telemóvel"
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        className="p-3 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-[#00D4FF]"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="email"
                        placeholder="E-mail (opcional)"
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        className="p-3 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-[#00D4FF]"
                      />
                      <input
                        type="text"
                        placeholder="Morada do Serviço"
                        value={newClientAddress}
                        onChange={(e) => setNewClientAddress(e.target.value)}
                        className="p-3 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-[#00D4FF]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Tipo de Serviço</label>
                  <select
                    value={serviceType}
                    onChange={(e) => handlePricingSelection(e.target.value, frequency, typology)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                  >
                    {SERVICE_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Tipologia / Item</label>
                  <select
                    value={typology}
                    onChange={(e) => {
                      const nextTypology = e.target.value
                      setTypology(nextTypology)
                      const matchedRule = rulesForSelection.find((r) => r.typology === nextTypology)
                      if (matchedRule) {
                        setSubtotal(Number(matchedRule.base_price).toFixed(2))
                        setPriceMatched(true)
                      }
                    }}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                  >
                    {availableTypologies.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Frequência</label>
                  <select
                    value={frequency}
                    onChange={(e) => handlePricingSelection(serviceType, e.target.value, typology)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                  >
                    {availableFrequencies.map((freq) => (
                      <option key={freq} value={freq}>{frequencyLabel(freq)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {priceMatched && selectedPricingRule && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
                  ✓ Preço base carregado do tarifário: <strong>{Number(selectedPricingRule.base_price).toFixed(2)} €</strong>. Pode ajustar o valor livremente abaixo.
                </div>
              )}

              {/* BLOCO FINANCEIRO */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                <p className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">Cálculo Financeiro & Margem</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Preço Base (€) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={subtotal}
                      onChange={(e) => setSubtotal(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-[#00D4FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Desconto Comercial (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-[#00D4FF]"
                    />
                  </div>
                </div>

                <div className="p-3 bg-sky-50 text-sky-900 rounded-xl border border-sky-100 text-xs">
                  ℹ️ Regime de isenção de IVA (Artigo 53.º do CIVA). O valor final reflete isenção total de imposto.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Horas Estimadas</label>
                    <input
                      type="number"
                      step="0.5"
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Custo Interno Est.</label>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                      {estimatedCostNum.toFixed(2)} €
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Margem Lucro Est.</label>
                    <div className={`p-2.5 border rounded-xl text-xs font-extrabold ${parseFloat(profitMargin) >= 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {profitMargin}%
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-200 text-sm font-black text-[#0B192C]">
                  <span>Valor Total da Proposta:</span>
                  <span className="text-lg text-[#00D4FF] bg-[#0B192C] px-3 py-1 rounded-xl">{totalVal.toFixed(2)} €</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Condições & Observações</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Inclui limpeza de vidros interiores e equipamentos de cozinha..."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 h-20 outline-none focus:ring-2 focus:ring-[#00D4FF]"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full sm:w-auto px-5 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-3 bg-[#0B192C] text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition disabled:opacity-50 text-center shadow-md cursor-pointer"
                >
                  {submitting ? 'A criar proposta...' : 'Emitir Proposta Comercial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
