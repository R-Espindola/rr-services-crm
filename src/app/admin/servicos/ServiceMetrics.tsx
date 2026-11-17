'use client'

import { ArrowUpRight, CheckCircle2, ClipboardList, Clock3, Route } from 'lucide-react'
import { Order as ServiceBooking } from './page'

type MetricFilter = 'all' | 'pending' | 'active' | 'completed'

interface ServiceMetricsProps {
  bookings: ServiceBooking[]
  activeFilter: MetricFilter
  onFilterChange: (filter: MetricFilter) => void
}

export default function ServiceMetrics({ bookings, activeFilter, onFilterChange }: ServiceMetricsProps) {
  const metrics: Array<{ filter: MetricFilter; label: string; value: number; detail: string; icon: typeof ClipboardList; tone: string }> = [
    { filter: 'all', label: 'Total Serviços', value: bookings.length, detail: 'Todas as marcações', icon: ClipboardList, tone: 'text-cyan-700 bg-cyan-50' },
    { filter: 'pending', label: 'Pendentes', value: bookings.filter((booking) => booking.status === 'pending').length, detail: 'Por iniciar', icon: Clock3, tone: 'text-amber-700 bg-amber-50' },
    { filter: 'active', label: 'Ativos hoje / A caminho', value: bookings.filter((booking) => booking.status === 'en_route' || booking.status === 'in_progress').length, detail: 'Em deslocação ou execução', icon: Route, tone: 'text-blue-700 bg-blue-50' },
    { filter: 'completed', label: 'Concluídos', value: bookings.filter((booking) => booking.status === 'completed').length, detail: 'Serviços finalizados', icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
  ]

  return <section aria-label="Métricas de serviços" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {metrics.map(({ filter, label, value, detail, icon: Icon, tone }) => {
      const active = activeFilter === filter
      return <button key={filter} type="button" onClick={() => onFilterChange(active && filter !== 'all' ? 'all' : filter)} className={`group rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-cyan-400 ring-2 ring-cyan-400/20' : 'border-slate-200/80'}`}>
        <div className="flex items-start justify-between gap-2"><span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}><Icon className="h-4 w-4" strokeWidth={2} /></span><ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-cyan-500" /></div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-black tabular-nums text-[#061121]">{value}</p>
        <p className="mt-1 text-[10px] font-medium text-slate-400">{detail}</p>
      </button>
    })}
  </section>
}
