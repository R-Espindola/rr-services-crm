'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface DashboardStats {
  totalClients: number
  totalServices: number
  pendingServices: number
  completedServices: number
  totalRevenue: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalServices: 0,
    pendingServices: 0,
    completedServices: 0,
    totalRevenue: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true)

      const { count: clientsCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })

      const { data: bookings } = await supabase
        .from('cleaning_contracts')
        .select('status, price')

      if (bookings) {
        const totalServices = bookings.length
        const pendingServices = bookings.filter((b) => b.status === 'scheduled' || b.status === 'in_progress').length
        const completedServices = bookings.filter((b) => b.status === 'completed').length
        const totalRevenue = bookings
          .filter((b) => b.status === 'completed')
          .reduce((acc, item) => acc + (Number(item.price) || 0), 0)

        setStats({
          totalClients: clientsCount || 0,
          totalServices,
          pendingServices,
          completedServices,
          totalRevenue,
        })
      }

      setLoading(false)
    }

    loadDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">A carregar painel...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-[#0B192C]">
      <header className="bg-[#0B192C] text-white py-4 px-6 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <span className="text-2xl font-bold text-[#00D4FF]">R&R</span>
          <h1 className="text-lg font-medium text-slate-200">Services — Painel de Controlo</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold mb-6">Visão Geral do Negócio</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Clientes Registados</p>
            <h3 className="text-3xl font-bold text-[#0B192C] mt-2">{stats.totalClients}</h3>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm">
            <p className="text-xs font-semibold text-amber-600 uppercase">Serviços Pendentes</p>
            <h3 className="text-3xl font-bold text-amber-700 mt-2">{stats.pendingServices}</h3>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm">
            <p className="text-xs font-semibold text-emerald-600 uppercase">Serviços Concluídos</p>
            <h3 className="text-3xl font-bold text-emerald-700 mt-2">{stats.completedServices}</h3>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-cyan-200 shadow-sm">
            <p className="text-xs font-semibold text-cyan-600 uppercase">Total Faturado</p>
            <h3 className="text-3xl font-bold text-cyan-800 mt-2">{stats.totalRevenue.toFixed(2)} €</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/dashboard/servicos"
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-[#00D4FF] transition flex justify-between items-center group"
          >
            <div>
              <h3 className="text-lg font-bold text-[#0B192C] group-hover:text-[#00D4FF] transition">
                Gestão de Serviços
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Ver agendamentos, alterar horários, valores e estados.
              </p>
            </div>
            <span className="text-2xl">🧹</span>
          </Link>

          <Link
            href="/dashboard/clientes"
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-[#00D4FF] transition flex justify-between items-center group"
          >
            <div>
              <h3 className="text-lg font-bold text-[#0B192C] group-hover:text-[#00D4FF] transition">
                Gestão de Clientes
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Adicionar e gerir informações dos clientes.
              </p>
            </div>
            <span className="text-2xl">👥</span>
          </Link>
          <Link
  href="/dashboard/orcamentos"
  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-[#00D4FF] transition group flex justify-between items-start"
>
  <div>
    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
      Pipeline CRM
    </span>
    <h3 className="text-lg font-bold text-[#0B192C] mt-3 group-hover:text-[#00D4FF] transition">
      Orçamentos & Propostas
    </h3>
    <p className="text-xs text-slate-500 mt-1">
      Gira os pedidos de cotação de potenciais clientes e converta-os em serviços agendados.
    </p>
  </div>
  <span className="text-2xl">📝</span>
</Link>
        </div>
      </main>
    </div>
  )
}