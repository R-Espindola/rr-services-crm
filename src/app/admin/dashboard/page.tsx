'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const ADMIN_EMAIL = 'rrservices.pt@gmail.com' // Substitua pelo seu e-mail de admin

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Métricas do Dashboard em tempo real
  const [metrics, setMetrics] = useState({
    todayServicesCount: 0,
    pendingExtrasCount: 0,
    pendingQuotesCount: 0,
    confirmedMonthSales: 0,
    lowStockCount: 0,
  })

  const [todayServicesList, setTodayServicesList] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])

  useEffect(() => {
    async function checkAdminAndLoadMetrics() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      if (session.user.email !== ADMIN_EMAIL) {
        router.push('/cliente')
        return
      }

      await loadDashboardMetrics()
      setLoading(false)
    }

    checkAdminAndLoadMetrics()
  }, [router])

  async function loadDashboardMetrics() {
    const todayStr = new Date().toISOString().split('T')[0]
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    // 1. Serviços agendados para hoje
    const { data: todayData } = await supabase
      .from('orders')
      .select('*, clients(name, phone)')
      .gte('scheduled_date', `${todayStr}T00:00:00`)
      .lte('scheduled_date', `${todayStr}T23:59:59`)
      .order('scheduled_date', { ascending: true })

    // 2. Pedidos de serviços extra pendentes
    const { data: extrasData } = await supabase
      .from('orders')
      .select('id')
      .ilike('service_type', 'Extra:%')
      .eq('status', 'pending')

    // 3. Orçamentos por responder / pendentes
    const { data: quotesData } = await supabase
      .from('quotes')
      .select('id')
      .eq('status', 'pending')

    // 4. Vendas confirmadas do mês
    const { data: monthSalesData } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('status', 'completed')
      .gte('scheduled_date', firstDayOfMonth)

    const salesTotal = monthSalesData?.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0) || 0

    // 5. Alertas de Stock Baixo
    const { data: productsData } = await supabase
      .from('products')
      .select('id, stock_quantity, min_stock_alert')

    const lowStockItems = productsData?.filter(p => p.stock_quantity <= p.min_stock_alert) || []

    // 6. Atividade recente
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('*, clients(name)')
      .order('created_at', { ascending: false })
      .limit(5)

    setMetrics({
      todayServicesCount: todayData?.length || 0,
      pendingExtrasCount: extrasData?.length || 0,
      pendingQuotesCount: quotesData?.length || 0,
      confirmedMonthSales: salesTotal,
      lowStockCount: lowStockItems.length,
    })

    if (todayData) setTodayServicesList(todayData)
    if (recentOrders) setRecentActivities(recentOrders)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        <p className="text-sm font-semibold">A carregar indicadores operacionais R&R Services...</p>
      </div>
    )
  }

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
            <span className="text-xs text-slate-400">Sistema de Gestão Operacional & Comercial</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition border border-red-500/30 cursor-pointer"
        >
          Terminar Sessão
        </button>
      </header>

      {/* Conteúdo Principal */}
      <section className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[#0B192C]">Painel de Controlo Operacional</h1>
          <p className="text-slate-500 text-sm mt-1">
            Resumo em tempo real da atividade diária, marcações, propostas e stock da R&R Services.
          </p>
        </div>

        {/* 1. CARTÕES DE INDICADORES (KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Link href="/dashboard/servicos" className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#00D4FF] shadow-sm transition block">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Serviços Hoje</span>
            <div className="text-2xl font-black text-[#0B192C] mt-1">{metrics.todayServicesCount}</div>
            <span className="text-xs text-slate-500 mt-2 block">📅 Ver agenda</span>
          </Link>

          <Link href="/dashboard/servicos" className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#00D4FF] shadow-sm transition block">
            <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider block">Extras Pendentes</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{metrics.pendingExtrasCount}</div>
            <span className="text-xs text-amber-600 mt-2 block">⏳ A aguardar resposta</span>
          </Link>

          <Link href="/dashboard/orcamentos" className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#00D4FF] shadow-sm transition block">
            <span className="text-[10px] font-extrabold text-sky-600 uppercase tracking-wider block">Orçamentos Pendentes</span>
            <div className="text-2xl font-black text-sky-600 mt-1">{metrics.pendingQuotesCount}</div>
            <span className="text-xs text-sky-600 mt-2 block">📄 Ver propostas</span>
          </Link>

          <Link href="/dashboard/loja" className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#00D4FF] shadow-sm transition block">
            <span className="text-[10px] font-extrabold text-red-600 uppercase tracking-wider block">Stock Baixo</span>
            <div className="text-2xl font-black text-red-600 mt-1">{metrics.lowStockCount}</div>
            <span className="text-xs text-red-600 mt-2 block">⚠️ Repor produtos</span>
          </Link>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider block">Vendas Confirmadas (Mês)</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{metrics.confirmedMonthSales.toFixed(2)} €</div>
            <span className="text-xs text-slate-400 mt-2 block">Faturação executada</span>
          </div>
        </div>

        {/* 2. ATALHOS RÁPIDOS OPERACIONAIS */}
        <div className="bg-[#0B192C] text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-lg font-bold">Ações Rápidas de Gestão</h3>
            <p className="text-xs text-slate-300">Crie registos instantâneos sem navegar entre páginas.</p>
          </div>
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <Link href="/dashboard/clientes" className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition border border-white/20">
              + Novo Cliente
            </Link>
            <Link href="/dashboard/servicos" className="px-4 py-2.5 bg-[#00D4FF] hover:bg-cyan-400 text-[#0B192C] font-extrabold rounded-xl text-xs transition">
              + Agendar Limpeza
            </Link>
            <Link href="/dashboard/orcamentos" className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition border border-white/20">
              + Criar Orçamento
            </Link>
            <Link href="/dashboard/loja" className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition border border-white/20">
              + Produto / Stock
            </Link>
          </div>
        </div>

        {/* 3. AGENDA DE HOJE E ATIVIDADE RECENTE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Agenda para Hoje */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-[#0B192C] mb-4 flex items-center justify-between">
              <span>📅 Intervenções Agendadas para Hoje</span>
              <span className="text-xs font-semibold text-slate-400">{todayServicesList.length} serviço(s)</span>
            </h2>

            {todayServicesList.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Sem intervenções marcadas para o dia de hoje.
              </p>
            ) : (
              <div className="space-y-3">
                {todayServicesList.map((srv) => (
                  <div key={srv.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-[#0B192C] text-sm">{srv.clients?.name || 'Cliente'}</div>
                      <div className="text-xs text-slate-500">{srv.service_type} — ⏰ {new Date(srv.scheduled_date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <span className="font-extrabold text-[#0B192C] text-sm">{Number(srv.total_amount).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Atividade Recente */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-[#0B192C] mb-4">⚡ Últimos Registos do Sistema</h2>
            {recentActivities.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Sem atividade recente registada.
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((act) => (
                  <div key={act.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        {act.service_type}
                      </span>
                      <div className="text-xs font-semibold text-slate-800 mt-1">{act.clients?.name || 'Cliente'}</div>
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                      {new Date(act.created_at || act.scheduled_date).toLocaleDateString('pt-PT')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}