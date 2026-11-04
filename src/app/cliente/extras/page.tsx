'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

type ExtraService = {
  id: string
  name: string
  category: string
  description: string | null
  price: number | null
  price_type: 'fixed' | 'per_unit' | 'quote'
  is_available: boolean
}

type ClientAppointment = {
  id: string
  scheduled_date: string
  service_type: string
}

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
  const router = useRouter()

  const fetchClientAppointmentsAndCatalog = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/login')
        return
      }

      // 1. Encontrar o registo do cliente associado ao user_id logado
      // (Normalmente a tabela clients tem uma coluna auth_id ou user_id. Se o ID do cliente for o próprio user.id, ajuste conforme a sua BD)
      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .select('id')
        .or(`id.eq.${user.id},user_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle()

      // Se não encontrar o cliente diretamente, tentamos filtrar diretamente pelas orders do user ou pelo client_id
      const clientId = clientData?.id

      // 2. Ir buscar apenas os agendamentos futuros deste cliente específico
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
        // Fallback caso a relação use diretamente o ID do auth ou email
        query = query.eq('client_id', user.id)
      }

      const { data: appointmentsData, error: appError } = await query

      if (appError) {
        console.error('Erro ao procurar agendamentos do cliente:', appError.message)
      } else {
        setClientAppointments((appointmentsData ?? []) as ClientAppointment[])
      }

      // 3. Ir buscar serviços extra ativos do catálogo
      const { data: catalogData, error: catError } = await supabase
        .from('services_catalog')
        .select('*')
        .eq('is_available', true)
        .order('category', { ascending: true })

      if (catError) throw catError
      setServices((catalogData ?? []) as ExtraService[])
    } catch {
      setCatalogError('Não foi possível carregar o catálogo de serviços extra. Tente novamente mais tarde.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void fetchClientAppointmentsAndCatalog()
  }, [fetchClientAppointmentsAndCatalog])

  // Validação da antecedência de 12 horas para a limpeza selecionada
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

    // Regra de validação do limite das 12h
    if (!check12HourRule(chosenAppointment.scheduled_date)) {
      alert('Faltam menos de 12 horas para o início desta limpeza. Já não é possível adicionar novos extras a esta intervenção para garantirmos a preparação da equipa.')
      return
    }

    setSubmitting(true)

    const formattedDate = new Date(chosenAppointment.scheduled_date).toLocaleString('pt-PT', {
      dateStyle: 'short',
      timeStyle: 'short',
    })

    const requestNotes = [
      `Vinculado ao Agendamento de ${formattedDate} (${chosenAppointment.service_type})`,
      requestedDate ? `Data de preferência assinalada: ${requestedDate}` : '',
      notes.trim()
    ].filter(Boolean).join('\n')

    // Chamada à RPC do Supabase
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
    }
    setSubmitting(false)
  }

  return (
    <main className="min-h-dvh bg-slate-50 pb-8 text-[#0B192C]">
      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-[#0B192C]">Serviços Extra Disponíveis</h1>
          <p className="text-slate-500 text-sm mt-1">
            Selecione um serviço adicional para vincular a uma das suas limpezas agendadas.
          </p>
        </div>

        {/* Aviso preventivo se não tiver agendamentos futuros */}
        {!loading && clientAppointments.length === 0 && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
            <h3 className="font-bold text-base mb-1">⚠️ Necessário Ter Agendamento Ativo</h3>
            <p className="text-sm leading-relaxed">
              Para solicitar serviços extra, necessita de ter pelo menos uma limpeza agendada na sua habitação. 
              Aceda ao separador "As minhas marcações" para agendar a sua próxima limpeza.
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400">A carregar catálogo...</div>
        ) : catalogError ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-semibold text-rose-800">{catalogError}</div>
        ) : services.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
            <p className="text-slate-600 font-medium text-lg">Ainda não existem serviços extra disponíveis no catálogo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((item) => (
              <div key={item.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between">
                <div className="p-6">
                  <span className="text-[11px] font-bold uppercase px-3 py-1 rounded-full bg-[#00D4FF]/10 text-[#0B192C] border border-[#00D4FF]/20 inline-block mb-3">
                    {item.category}
                  </span>
                  <h3 className="text-xl font-bold text-[#0B192C] mb-2">{item.name}</h3>
                  <p className="text-slate-500 text-sm mb-4 leading-relaxed">{item.description || 'Sem descrição detalhada.'}</p>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-sm font-extrabold text-[#0B192C]">
                    {item.price_type === 'quote' ? 'Sob Orçamento' : `${Number(item.price).toFixed(2)} €`}
                  </span>
                  <button
                    onClick={() => {
                      if (clientAppointments.length === 0) {
                        alert('Precisa de ter pelo menos uma limpeza agendada para poder solicitar serviços extra.')
                        return
                      }
                      setSelectedService(item)
                    }}
                    className="bg-[#0B192C] hover:bg-slate-800 text-white px-4 py-2 rounded-2xl text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    Solicitar Serviço
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal de confirmação do pedido com seleção obrigatória do agendamento */}
      {selectedService && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-auto">
            <h2 className="text-2xl font-bold text-[#0B192C] mb-1">Adicionar Serviço Extra</h2>
            <p className="text-xs text-slate-500 mb-6">Escolha o agendamento em que deseja incluir este extra.</p>

            <div className="bg-slate-50 p-4 rounded-2xl mb-5 border border-slate-100">
              <div className="font-bold text-[#0B192C] text-lg">{selectedService.name}</div>
              <div className="text-xs text-slate-500 mt-1">{selectedService.description}</div>
              <div className="text-sm font-extrabold text-[#00D4FF] mt-3">
                {selectedService.price_type === 'quote' ? 'Preço Sob Consulta' : `${Number(selectedService.price).toFixed(2)} €`}
              </div>
            </div>

            <form onSubmit={handleRequestExtra} className="space-y-4">
              {/* Seletor de agendamentos das limpezas futuras */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Associar à Limpeza Agendada *
                </label>
                <select
                  required
                  value={selectedAppointmentId}
                  onChange={(e) => setSelectedAppointmentId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-xs sm:text-sm font-semibold text-[#0B192C]"
                >
                  <option value="">-- Selecione uma data agendada --</option>
                  {clientAppointments.map((app) => {
                    const formattedDate = new Date(app.scheduled_date).toLocaleString('pt-PT', {
                      dateStyle: 'full',
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
                <p className="text-[10px] text-slate-400 mt-1.5">
                  * Apenas pode solicitar extras com um mínimo de 12 horas de antecedência à limpeza.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observações ou Pedidos Especiais
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Dar atenção especial ao interior do forno ou exaustor..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-xs sm:text-sm h-20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedService(null)
                    setSelectedAppointmentId('')
                    setNotes('')
                  }}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl font-semibold text-sm transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedAppointmentId}
                  className="px-6 py-2.5 bg-[#0B192C] hover:bg-slate-800 text-white rounded-2xl font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'A enviar...' : 'Confirmar Pedido'}
                </button>
              </div>
            </form>
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