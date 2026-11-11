'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"

type ExtraService = {
  id: string
  name: string
  category: string
  description: string | null
  price: number | null
  price_type: 'fixed' | 'per_unit' | 'quote'
  is_available: boolean
  image_url?: string | null
  original_price?: number
  discount_percentage?: number
  included_features?: string | null
}

type ClientAppointment = {
  id: string
  scheduled_date: string
  service_type: string
}

type CatalogServiceRow = Omit<ExtraService, 'original_price' | 'discount_percentage'>

const formatarPreco = (valor: number | null) => {
  if (valor === null || isNaN(valor)) return "Sob Consulta";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(valor);
};

export default function ClientExtrasPage() {
  const [services, setServices] = useState<ExtraService[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<ExtraService | null>(null)
  const [clientAppointments, setClientAppointments] = useState<ClientAppointment[]>([])
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('')
  const [notes, setNotes] = useState('')
  const requestedDate = useSyncExternalStore(subscribeToLocation, getRequestedDate, () => '')
  const [submitting, setSubmitting] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  
  const [quantidade, setQuantidade] = useState<number>(1)
  const router = useRouter()

  const fetchClientAppointmentsAndCatalog = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/login')
        return
      }

      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .or(`id.eq.${user.id},user_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle()

      const clientId = clientData?.id

      const nowIso = new Date().toISOString()
      let query = supabase
        .from('orders')
        .select('id, scheduled_date, service_type, client_id')
        .gte('scheduled_date', nowIso)
        .neq('status', 'cancelled')
        .order('scheduled_date', { ascending: true })

      if (clientId) {
        query = query.eq('client_id', clientId)
      } else {
        query = query.eq('client_id', user.id)
      }

      const { data: appointmentsData, error: appError } = await query

      if (appError) {
        console.error('Erro ao procurar agendamentos do cliente:', appError.message)
      } else {
        setClientAppointments((appointmentsData ?? []) as ClientAppointment[])
      }

      const { data: catalogData, error: catError } = await supabase
        .from('services_catalog')
        .select('*')
        .eq('is_available', true)
        .order('category', { ascending: true })

      if (catError) throw catError
      
      setServices(
        ((catalogData ?? []) as CatalogServiceRow[]).map((item) => ({
          ...item,
          image_url: item.image_url || "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=700&q=85",
          original_price: item.price ? Number(item.price) * 1.25 : 0,
          discount_percentage: 20,
        }))
      )
    } catch {
      setCatalogError('Não foi possível carregar o catálogo de serviços extra. Tente novamente mais tarde.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void fetchClientAppointmentsAndCatalog(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [fetchClientAppointmentsAndCatalog])

  function check12HourRule(scheduledDateIso: string): boolean {
    const appointmentTime = new Date(scheduledDateIso).getTime()
    const currentTime = new Date().getTime()
    const diffInHours = (appointmentTime - currentTime) / (1000 * 60 * 60)
    return diffInHours >= 12
  }

  async function handleRequestExtra(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedService) return

    if (!selectedAppointmentId) {
      alert('Por favor, selecione a limpeza agendada à qual pretende adicionar este serviço extra.')
      return
    }

    const chosenAppointment = clientAppointments.find(a => a.id === selectedAppointmentId)
    if (!chosenAppointment) {
      alert('Agendamento inválido. Selecione um agendamento da lista.')
      return
    }

    if (!check12HourRule(chosenAppointment.scheduled_date)) {
      alert('Faltam menos de 12 horas para o início desta limpeza. Já não é possível adicionar novos extras a esta intervenção.')
      return
    }

    setSubmitting(true)

    const formattedDate = new Date(chosenAppointment.scheduled_date).toLocaleString('pt-PT', {
      dateStyle: 'short',
      timeStyle: 'short',
    })

    const requestNotes = [
      `Vinculado ao Agendamento de ${formattedDate} (${chosenAppointment.service_type})`,
      quantidade > 1 ? `Quantidade: ${quantidade}x (com desconto progressivo)` : '',
      requestedDate ? `Data de preferência assinalada: ${requestedDate}` : '',
      notes.trim()
    ].filter(Boolean).join('\n')

    const { error } = await supabase.rpc('solicitar_extra_seguro', {
      p_service_id: selectedService.id,
      p_notes: requestNotes || null,
    })

    if (error) {
      alert('Não foi possível solicitar o serviço extra: ' + error.message)
    } else {
      alert('Serviço extra solicitado com sucesso! A R&R Services atualizará a sua ficha de intervenção.')
      setSelectedService(null)
      setSelectedAppointmentId('')
      setNotes('')
      setQuantidade(1)
    }
    setSubmitting(false)
  }

  const precoUnitario = selectedService?.price || 0;
  const calcularDescontoProgressivo = (qtd: number) => {
    if (qtd >= 5) return 0.80;
    if (qtd === 4) return 0.85;
    if (qtd === 3) return 0.90;
    if (qtd === 2) return 0.95;
    return 1.0;
  };

  const fatorDesconto = calcularDescontoProgressivo(quantidade);
  const subtotal = precoUnitario * quantidade * fatorDesconto;

  return (
    <main className="min-h-dvh bg-slate-50 pb-12 text-[#0B192C]">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <Link href="/cliente" className="text-xs font-bold text-sky-700 hover:underline">← Voltar ao início</Link>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0B192C] mt-2">Serviços Extra Disponíveis</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Selecione um serviço adicional para vincular a uma das suas limpezas agendadas.
          </p>
        </div>

        {!loading && clientAppointments.length === 0 && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-xs">
            <h3 className="font-bold text-sm mb-1">⚠️ Necessário Ter Agendamento Ativo</h3>
            <p className="text-xs sm:text-sm leading-relaxed">
              Para solicitar serviços extra, necessita de ter pelo menos uma limpeza agendada.
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-400 font-medium">A carregar catálogo...</div>
        ) : catalogError ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-xs font-semibold text-rose-800">{catalogError}</div>
        ) : services.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs">
            <p className="text-slate-600 font-medium text-sm">Ainda não existem serviços extra disponíveis no catálogo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {services.map((item) => (
              <div 
                key={item.id} 
                onClick={() => {
                  if (clientAppointments.length === 0) {
                    alert('Precisa de ter pelo menos uma limpeza agendada para poder solicitar serviços extra.')
                    return
                  }
                  setSelectedService(item)
                  setQuantidade(1)
                }}
                className="group bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-36 bg-slate-100 overflow-hidden">
                    <Image src={item.image_url || "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=700&q=85"} alt={item.name} fill unoptimized sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover transition duration-300 group-hover:scale-105" />
                    <span className="absolute top-2 left-2 bg-[#0B192C]/80 backdrop-blur-xs text-[10px] font-black text-white px-2 py-0.5 rounded-md uppercase">
                      {item.category}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-xs font-black text-[#0B192C] leading-snug line-clamp-2">{item.name}</h3>
                    <p className="text-slate-500 text-[11px] mt-1 line-clamp-2 leading-normal">{item.description || 'Serviço profissional de limpeza.'}</p>
                  </div>
                </div>

                <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11px] text-slate-400 line-through">{formatarPreco(item.original_price || null)}</span>
                    <span className="text-xs font-black text-[#0B192C]">{item.price_type === 'quote' ? 'Sob Orçamento' : formatarPreco(item.price)}</span>
                  </div>
                  <span className="text-[10px] font-bold text-sky-700 bg-cyan-50 px-2 py-1 rounded-xl group-hover:bg-[#00D4FF] group-hover:text-[#0B192C] transition">
                    Selecionar
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL COM "O QUE ESTÁ INCLUÍDO" DINÂMICO */}
      {selectedService && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 grid md:grid-cols-2 overflow-hidden my-auto">
            
            <div className="p-6 bg-slate-50 flex flex-col justify-between">
              <div>
                <button 
                  onClick={() => { setSelectedService(null); setSelectedAppointmentId(''); setNotes(''); }} 
                  className="text-xs font-bold text-slate-500 hover:text-black mb-4"
                >
                  ✕ Fechar
                </button>
                <div className="relative h-40 rounded-2xl overflow-hidden shadow-xs mb-4">
                  <Image src={selectedService.image_url || "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=700&q=85"} alt={selectedService.name} fill unoptimized sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
                </div>
                <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-cyan-100 text-sky-900 inline-block mb-2">
                  {selectedService.category}
                </span>
                <h2 className="text-lg font-black text-[#0B192C]">{selectedService.name}</h2>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{selectedService.description}</p>
                
                <div className="mt-4">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">O que está incluído?</h4>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {selectedService.included_features ? (
                      selectedService.included_features.split('\n').map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span>✓</span> {feature}
                        </li>
                      ))
                    ) : (
                      <li className="flex items-center gap-2"><span>✓</span> Execução profissional do serviço</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 flex flex-col justify-between space-y-5">
              <form onSubmit={handleRequestExtra} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Associar à Limpeza Agendada *
                  </label>
                  <select
                    required
                    value={selectedAppointmentId}
                    onChange={(e) => setSelectedAppointmentId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-1 focus:ring-[#00D4FF] bg-slate-50 text-xs font-bold text-[#0B192C]"
                  >
                    <option value="">-- Selecione uma data agendada --</option>
                    {clientAppointments.map((app) => {
                      const formattedDate = new Date(app.scheduled_date).toLocaleString('pt-PT', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                      const isValid12h = check12HourRule(app.scheduled_date)
                      return (
                        <option key={app.id} value={app.id} disabled={!isValid12h}>
                          {formattedDate} — {app.service_type} {!isValid12h ? '(Indisponível: <12h)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>

                {selectedService.price_type !== 'quote' && (
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Quantidade / Unidades
                      </label>
                      {quantidade > 1 && (
                        <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          🔥 Desconto por volume aplicado!
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setQuantidade(num)}
                          className={`py-1.5 rounded-xl text-xs font-bold border transition ${quantidade === num ? 'border-[#0B192C] bg-[#0B192C] text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                        >
                          {num}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Instruções para a Equipa
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Dar atenção especial ao interior..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-1 focus:ring-[#00D4FF] bg-slate-50 text-xs h-16 resize-none"
                  />
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Subtotal com desconto</span>
                    <span className="text-base font-black text-[#0B192C]">
                      {selectedService.price_type === 'quote' ? 'Sob Orçamento' : formatarPreco(subtotal)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setSelectedService(null); setSelectedAppointmentId(''); setNotes(''); }}
                      className="flex-1 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-xs transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !selectedAppointmentId}
                      className="flex-1 py-2.5 bg-[#0B192C] hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-sm transition disabled:opacity-50"
                    >
                      {submitting ? 'A enviar...' : 'Confirmar Pedido'}
                    </button>
                  </div>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}
    </main>
  )
}

function getRequestedDate() {
  const value = new URLSearchParams(window.location.search).get('data') ?? ''
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

function subscribeToLocation(callback: () => void) {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}
