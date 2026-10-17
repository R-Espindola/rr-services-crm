'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ClientDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [clientData, setClientData] = useState<any>(null)
  
  // Categorização Separada
  const [nextRegularCleaning, setNextRegularCleaning] = useState<any | null>(null)
  const [extraServiceRequests, setExtraServiceRequests] = useState<any[]>([])
  const [recommendedProducts, setRecommendedProducts] = useState<any[]>([])
  const [completedHistory, setCompletedHistory] = useState<any[]>([])
  const [catalogExtras, setCatalogExtras] = useState<any[]>([])

  // Estado do formulário de Seleção Múltipla de Extras
  const [selectedExtras, setSelectedExtras] = useState<{ [key: string]: number }>({})
  const [extraNotes, setExtraNotes] = useState('')
  const [submittingExtra, setSubmittingExtra] = useState(false)
  const [extraSuccessMsg, setExtraSuccessMsg] = useState('')

  // Modal de Fotos Antes & Depois
  const [selectedPhotos, setSelectedPhotos] = useState<{ before: string[]; after: string[]; title: string } | null>(null)

  const router = useRouter()

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    // 1. Obter dados do Cliente
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('email', session.user.email)
      .single()

    if (client) {
      setClientData(client)

      // 2. Carregar todas as ordens deste cliente
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('client_id', client.id)
        .order('scheduled_date', { ascending: true })

      if (orders) {
        // Separar limpezas regulares de pedidos de serviços extra
        const regularCleanings = orders.filter(
          o => !o.service_type?.toLowerCase().startsWith('extra:') && o.status !== 'completed' && o.status !== 'cancelled'
        )

        const extraRequests = orders.filter(
          o => o.service_type?.toLowerCase().startsWith('extra:') || o.notes?.toLowerCase().includes('pedido de serviço extra')
        )

        const history = orders.filter(o => o.status === 'completed')

        if (regularCleanings.length > 0) {
          setNextRegularCleaning(regularCleanings[0])
        } else {
          setNextRegularCleaning(null)
        }

        setExtraServiceRequests(extraRequests)
        setCompletedHistory(history)
      }
    } else {
      setClientData({ name: session.user.email?.split('@')[0] || 'Cliente' })
    }

    // 3. Carregar Catálogo de Serviços Extra
    const { data: extrasData } = await supabase
      .from('services_catalog')
      .select('*')
      .eq('is_available', true)

    if (extrasData) {
      setCatalogExtras(extrasData)
    }

    // 4. Carregar Produtos Recomendados da Loja
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .limit(4)

    if (productsData) {
      setRecommendedProducts(productsData)
    }

    setLoading(false)
  }

  // Formatação Limpa de Data e Hora
  function formatDate(dateString: string) {
    if (!dateString) return 'Data a definir'
    const d = new Date(dateString)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  function formatTime(dateString: string) {
    if (!dateString) return ''
    const d = new Date(dateString)
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // Mapeamento de Estados Reais da Base de Dados
  function renderStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold">A aguardar confirmação</span>
      case 'confirmed':
        return <span className="bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1 rounded-full text-xs font-bold">Confirmado</span>
      case 'in_progress':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-bold">Em execução</span>
      case 'completed':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">Concluído</span>
      case 'cancelled':
        return <span className="bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full text-xs font-bold">Cancelado</span>
      default:
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 rounded-full text-xs font-bold">Pedido recebido</span>
    }
  }

  // Gestão da Seleção Múltipla de Extras
  function handleQuantityChange(serviceId: string, delta: number) {
    setSelectedExtras((prev) => {
      const current = prev[serviceId] || 0
      const updated = Math.max(0, current + delta)
      if (updated === 0) {
        const copy = { ...prev }
        delete copy[serviceId]
        return copy
      }
      return { ...prev, [serviceId]: updated }
    })
  }

  // Envio do Pedido de Serviços Extra
  async function handleSubmitExtraOrder(e: React.FormEvent) {
    e.preventDefault()
    const selectedKeys = Object.keys(selectedExtras)
    if (selectedKeys.length === 0) {
      alert('Por favor, selecione pelo menos um serviço extra.')
      return
    }

    setSubmittingExtra(true)

    let totalAmount = 0
    const summaryList: string[] = []

    selectedKeys.forEach((id) => {
      const item = catalogExtras.find((s) => s.id === id)
      if (item) {
        const qty = selectedExtras[id]
        totalAmount += (item.price || 0) * qty
        summaryList.push(`${item.name} (${qty}x)`)
      }
    })

    const serviceTitle = `Extra: ${summaryList.join(', ')}`

    const { error } = await supabase.from('orders').insert([
      {
        client_id: clientData.id,
        service_type: serviceTitle,
        scheduled_date: new Date().toISOString(),
        total_amount: totalAmount,
        status: 'pending',
        notes: extraNotes ? `Pedido de Serviço Extra: ${extraNotes}` : 'Pedido de Serviço Extra',
      },
    ])

    if (error) {
      alert('Erro ao enviar pedido: ' + error.message)
    } else {
      setExtraSuccessMsg('O seu pedido de serviços extra foi enviado com sucesso! A equipa irá analisar e confirmar brevemente.')
      setSelectedExtras({})
      setExtraNotes('')
      loadDashboardData()
      setTimeout(() => setExtraSuccessMsg(''), 6000)
    }
    setSubmittingExtra(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-[#0B192C]">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 rounded-full bg-[#00D4FF] animate-ping" />
          <p className="text-sm font-semibold">A carregar o seu portal R&R Services...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-[#0B192C]">
      {/* 1. CABEÇALHO */}
      <header className="bg-[#0B192C] text-white py-4 px-6 md:px-10 shadow-lg flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="bg-[#00D4FF]/10 p-2 rounded-xl border border-[#00D4FF]/20">
            <span className="text-2xl font-bold tracking-wider text-[#00D4FF]">R&R</span>
          </div>
          <div>
            <span className="text-lg font-bold text-white block leading-none">Services</span>
            <span className="text-[11px] text-[#00D4FF] font-medium">Portal do Cliente</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <span>🔔 Notificações</span>
            <span className="w-2 h-2 rounded-full bg-[#00D4FF]" />
          </div>
          <button
            onClick={handleLogout}
            className="bg-slate-800 hover:bg-red-600/20 text-slate-300 hover:text-red-200 px-4 py-2 rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
          >
            Terminar Sessão
          </button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* 2. SAUDAÇÃO PERSONALIZADA */}
        <div>
          <h1 className="text-3xl font-extrabold text-[#0B192C]">Olá, {clientData?.name} 👋</h1>
          <p className="text-slate-500 text-sm mt-1">
            Gira as suas limpezas contratadas, adicione serviços extra e acompanhe os seus pedidos.
          </p>
        </div>

        {/* 3. CARTÃO DA PRÓXIMA LIMPEZA CONTRATADA */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-[#00D4FF]/10 text-[#0B192C] border border-[#00D4FF]/20">
                Limpeza Contratada em Destaque
              </span>
              <h2 className="text-2xl font-extrabold text-[#0B192C] mt-3">
                {nextRegularCleaning ? nextRegularCleaning.service_type : 'Nenhuma Limpeza Regular Agendada'}
              </h2>
            </div>
            {nextRegularCleaning && renderStatusBadge(nextRegularCleaning.status)}
          </div>

          {nextRegularCleaning ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase block">Data Prevista</span>
                <span className="text-lg font-bold text-[#0B192C]">
                  📅 {formatDate(nextRegularCleaning.scheduled_date)}
                </span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase block">Horário da Intervenção</span>
                <span className="text-lg font-bold text-[#0B192C]">
                  ⏰ {formatTime(nextRegularCleaning.scheduled_date)}
                </span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase block">Valor Contratado</span>
                <span className="text-lg font-extrabold text-[#00D4FF]">
                  {Number(nextRegularCleaning.total_amount).toFixed(2)} €
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
              Não tem nenhuma intervenção regular agendada para os próximos dias.
            </p>
          )}
        </div>

        {/* 4. PERSONALIZAR A PRÓXIMA LIMPEZA COM SERVIÇOS EXTRA */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-[#0B192C]">Personalizar Limpeza — Serviços Extra</h2>
            <p className="text-xs text-slate-500 mt-1">
              Selecione intervenções adicionais pontuais (ex: forno, vidros, sofás). Os pedidos ficam sujeitos a confirmação da R&R Services sem alterar a sua intervenção principal.
            </p>
          </div>

          {extraSuccessMsg && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">
              ✓ {extraSuccessMsg}
            </div>
          )}

          <form onSubmit={handleSubmitExtraOrder} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogExtras.map((item) => {
                const qty = selectedExtras[item.id] || 0
                return (
                  <div
                    key={item.id}
                    className={`p-5 rounded-2xl border transition flex flex-col justify-between ${
                      qty > 0 ? 'border-[#00D4FF] bg-[#00D4FF]/5 shadow-sm' : 'border-slate-200 bg-slate-50/40 hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{item.category}</span>
                        <span className="text-sm font-extrabold text-[#0B192C]">
                          {item.price_type === 'quote' ? 'Sob Orçamento' : `${Number(item.price).toFixed(2)} €`}
                        </span>
                      </div>
                      <h4 className="font-bold text-[#0B192C] text-base mb-1">{item.name}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-4">{item.description || 'Intervenção complementar dedicada.'}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className="text-xs font-semibold text-slate-600">Quantidade:</span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, -1)}
                          className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 text-sm transition"
                        >
                          -
                        </button>
                        <span className="text-sm font-extrabold w-5 text-center text-[#0B192C]">{qty}</span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, 1)}
                          className="w-7 h-7 rounded-lg bg-[#0B192C] hover:bg-slate-800 font-bold text-white text-sm transition"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Observações & Resumo */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Observações para a Equipa</label>
                <textarea
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  placeholder="Ex: Dar atenção especial ao forno da cozinha ou higienização do sofá da sala."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-white text-sm h-20"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2 border-t border-slate-200">
                <div className="text-sm">
                  <span className="text-slate-500 font-medium">Resumo de Extras Selecionados: </span>
                  <span className="font-extrabold text-[#0B192C] text-lg">
                    {Object.keys(selectedExtras).length} item(ns)
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submittingExtra || Object.keys(selectedExtras).length === 0}
                  className="w-full sm:w-auto px-8 py-3 bg-[#0B192C] hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-40 cursor-pointer"
                >
                  {submittingExtra ? 'A enviar pedido...' : 'Enviar Pedido de Serviços Extra'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* 5. PRODUTOS RECOMENDADOS DA LOJA */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-extrabold text-[#0B192C]">Produtos Recomendados</h2>
              <p className="text-xs text-slate-500 mt-1">Detergentes e produtos de limpeza de gama profissional.</p>
            </div>
            <Link href="/cliente/loja" className="text-xs font-bold text-[#00D4FF] hover:underline">
              Ver Loja Completa →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {recommendedProducts.length === 0 ? (
              <p className="col-span-4 text-xs text-slate-400 py-6 text-center">Nenhum produto disponível na loja de momento.</p>
            ) : (
              recommendedProducts.map((prod) => (
                <div key={prod.id} className="bg-slate-50/60 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="w-full h-32 bg-slate-200 rounded-xl mb-3 flex items-center justify-center text-3xl overflow-hidden">
                      {prod.image_url ? (
                        <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                      ) : (
                        '🧴'
                      )}
                    </div>
                    <h4 className="font-bold text-[#0B192C] text-sm mb-1">{prod.name}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">{prod.description || 'Detergente de qualidade profissional.'}</p>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="font-extrabold text-[#0B192C] text-sm">{Number(prod.price || 0).toFixed(2)} €</span>
                    <Link
                      href="/cliente/loja"
                      className="bg-[#0B192C] hover:bg-slate-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition"
                    >
                      Encomendar
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 6. PEDIDOS RECENTES (SERVIÇOS EXTRA E ENCOMENDAS) */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <h2 className="text-2xl font-extrabold text-[#0B192C] mb-6 flex items-center gap-2">
            <span>📋</span> Pedidos Recentes de Serviços Extra
          </h2>

          {extraServiceRequests.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              Ainda não efetuou pedidos de serviços extra.
            </p>
          ) : (
            <div className="space-y-3">
              {extraServiceRequests.map((req) => (
                <div key={req.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-slate-200 text-slate-700">
                      {req.service_type}
                    </span>
                    <div className="text-xs text-slate-500 font-medium mt-1">
                      Data do Pedido: {formatDate(req.created_at || req.scheduled_date)} às {formatTime(req.created_at || req.scheduled_date)}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {renderStatusBadge(req.status)}
                    <span className="font-extrabold text-[#0B192C] text-sm">{Number(req.total_amount).toFixed(2)} €</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. HISTÓRICO DE INTERVENÇÕES CONCLUÍDAS */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <h2 className="text-2xl font-extrabold text-[#0B192C] mb-6 flex items-center gap-2">
            <span>✨</span> Histórico de Intervenções Concluídas
          </h2>

          {completedHistory.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              Sem intervenções concluídas registadas no histórico.
            </p>
          ) : (
            <div className="space-y-3">
              {completedHistory.map((item) => (
                <div key={item.id} className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <span className="text-xs font-bold text-emerald-800">✓ Concluído</span>
                    <div className="font-bold text-[#0B192C] text-sm mt-0.5">{item.service_type}</div>
                    <div className="text-xs text-slate-500">Realizado em: {formatDate(item.scheduled_date)}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    {(item.photos_before?.length > 0 || item.photos_after?.length > 0) && (
                      <button
                        onClick={() => setSelectedPhotos({
                          before: item.photos_before || [],
                          after: item.photos_after || [],
                          title: item.service_type
                        })}
                        className="bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                      >
                        📷 Ver Fotografias
                      </button>
                    )}
                    <span className="font-extrabold text-[#0B192C] text-base">{Number(item.total_amount).toFixed(2)} €</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 8. APOIO AO CLIENTE E CONTACTOS */}
        <div className="bg-[#0B192C] text-white rounded-3xl p-8 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <span className="text-xs font-bold text-[#00D4FF] uppercase tracking-wider block mb-1">Apoio Direto ao Cliente</span>
            <h3 className="text-2xl font-extrabold">Precisa de Reagendar ou Aclarar uma Dúvida?</h3>
            <p className="text-xs text-slate-300 mt-1">A equipa da R&R Services está disponível para o ajudar rapidamente.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <a
              href="https://wa.me/351969177571"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-[#00D4FF] hover:bg-cyan-400 text-[#0B192C] font-extrabold rounded-xl text-xs text-center transition"
            >
              💬 Contactar via WhatsApp
            </a>
            <a
              href="tel:+351969177571"
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-extrabold rounded-xl text-xs text-center border border-slate-700 transition"
            >
              📞 Ligar para a Central
            </a>
          </div>
        </div>
      </section>

      {/* Modal de Fotografias Antes & Depois */}
      {selectedPhotos && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#0B192C]">{selectedPhotos.title}</h2>
                <p className="text-xs text-slate-500">Galeria de fotografias da intervenção</p>
              </div>
              <button
                onClick={() => setSelectedPhotos(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Fotografias — ANTES</h3>
                {selectedPhotos.before.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sem fotografias de Antes registadas.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedPhotos.before.map((url, i) => (
                      <img key={i} src={url} alt="Antes" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase text-emerald-600 tracking-wider mb-3">Fotografias — DEPOIS</h3>
                {selectedPhotos.after.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sem fotografias de Depois registadas.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedPhotos.after.map((url, i) => (
                      <img key={i} src={url} alt="Depois" className="w-full h-40 object-cover rounded-xl border border-emerald-200" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}