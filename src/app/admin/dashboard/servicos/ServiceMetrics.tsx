'use client'

import { ServiceBooking } from './page'

interface ServiceMetricsProps {
  bookings: ServiceBooking[]
}

export default function ServiceMetrics({ bookings }: ServiceMetricsProps) {
  const totalBookings = bookings.length

  const getAmount = (b: ServiceBooking) => {
    return b.total_amount && b.total_amount > 0 ? b.total_amount : 60
  }

  const totalRevenueAll = bookings.reduce((acc, item) => acc + getAmount(item), 0)

  const pendingBookings = bookings.filter((b) => b.status === 'pending')
  const inProgressBookings = bookings.filter((b) => b.status === 'in_progress')
  const completedBookings = bookings.filter((b) => b.status === 'completed')

  const pendingRevenue = pendingBookings.reduce((acc, item) => acc + getAmount(item), 0)
  const inProgressRevenue = inProgressBookings.reduce((acc, item) => acc + getAmount(item), 0)
  const completedRevenue = completedBookings.reduce((acc, item) => acc + getAmount(item), 0)

  return (
    <section aria-label="Métricas de Desempenho e Faturação" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total de Serviços */}
      <article className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-start">
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase">
            Total de Serviços
          </h2>
          <p className="text-2xl font-bold text-[#0B192C] mt-1">
            {totalBookings}
          </p>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Valor Total:{' '}
            <strong className="text-slate-700">
              {totalRevenueAll.toFixed(2)} €
            </strong>
          </p>
        </div>
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 font-bold text-lg" aria-hidden="true">
          📋
        </div>
      </article>

      {/* Agendados / Pendentes */}
      <article className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 shadow-sm flex justify-between items-start">
        <div>
          <h2 className="text-xs font-bold text-amber-600 uppercase">
            Agendados / Pendentes
          </h2>
          <p className="text-2xl font-bold text-amber-900 mt-1">
            {pendingBookings.length}
          </p>
          <p className="text-xs font-medium text-amber-700 mt-1">
            A receber:{' '}
            <strong className="text-amber-900">
              {pendingRevenue.toFixed(2)} €
            </strong>
          </p>
        </div>
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 font-bold text-lg" aria-hidden="true">
          ⏳
        </div>
      </article>

      {/* Em Execução */}
      <article className="bg-blue-50/50 p-5 rounded-2xl border border-blue-200 shadow-sm flex justify-between items-start">
        <div>
          <h2 className="text-xs font-bold text-blue-600 uppercase">
            Em Execução
          </h2>
          <p className="text-2xl font-bold text-blue-900 mt-1">
            {inProgressBookings.length}
          </p>
          <p className="text-xs font-medium text-blue-700 mt-1">
            Valor:{' '}
            <strong className="text-blue-900">
              {inProgressRevenue.toFixed(2)} €
            </strong>
          </p>
        </div>
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold text-lg" aria-hidden="true">
          🧹
        </div>
      </article>

      {/* Concluídos */}
      <article className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200 shadow-sm flex justify-between items-start">
        <div>
          <h2 className="text-xs font-bold text-emerald-600 uppercase">
            Concluídos
          </h2>
          <p className="text-2xl font-bold text-emerald-900 mt-1">
            {completedBookings.length}
          </p>
          <p className="text-xs font-medium text-emerald-700 mt-1">
            Faturado:{' '}
            <strong className="text-emerald-900">
              {completedRevenue.toFixed(2)} €
            </strong>
          </p>
        </div>
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 font-bold text-lg" aria-hidden="true">
          ✅
        </div>
      </article>
    </section>
  )
}