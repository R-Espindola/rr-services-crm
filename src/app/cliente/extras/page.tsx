'use client'

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ClientExtrasPage() {
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<any | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchAvailableExtras()
  }, [])

  async function fetchAvailableExtras() {
    setLoading(true)
    const { data, error } = await supabase
      .from('services_catalog')
      .select('*')
      .eq('is_available', true)
      .order('category', { ascending: true })

    if (data) {
      setServices(data)
    }
    setLoading(false)
  }

  async function handleRequestExtra(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedService) return

    setSubmitting(true)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      router.push('/login')
      return
    }
    const { error } = await supabase.rpc('solicitar_extra_seguro', {
      p_service_id: selectedService.id,
      p_notes: notes || null,
    })

    if (error) {
      alert('Erro ao solicitar serviço: ' + error.message)
    } else {
      alert('Serviço extra solicitado com sucesso! A R&R Services entrará em contacto para confirmação.')
      setSelectedService(null)
      setNotes('')
    }
    setSubmitting(false)
  }

  return (
    <main className="min-h-dvh bg-slate-50 pb-8 text-[#0B192C] ">
      {/* Cabeçalho */}


      {/* Conteúdo Principal */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-[#0B192C]">Serviços Extra Disponíveis</h1>
          <p className="text-slate-500 text-sm mt-1">
            Selecione o serviço adicional que pretende adicionar à sua limpeza ou habitação.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">A carregar catálogo...</div>
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
                    onClick={() => setSelectedService(item)}
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

      {/* Modal de Confirmação de Pedido Extra */}
      {selectedService && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-100">
            <h2 className="text-2xl font-bold text-[#0B192C] mb-1">Solicitar Serviço</h2>
            <p className="text-xs text-slate-500 mb-6">Confirme os detalhes do serviço selecionado.</p>

            <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
              <div className="font-bold text-[#0B192C] text-lg">{selectedService.name}</div>
              <div className="text-xs text-slate-500 mt-1">{selectedService.description}</div>
              <div className="text-sm font-extrabold text-[#00D4FF] mt-3">
                {selectedService.price_type === 'quote' ? 'Preço Sob Consulta' : `${Number(selectedService.price).toFixed(2)} €`}
              </div>
            </div>

            <form onSubmit={handleRequestExtra} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Observações ou Detalhes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Zona específica da casa, quantidade de itens..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm h-24"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedService(null)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl font-semibold text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#0B192C] hover:bg-slate-800 text-white rounded-2xl font-bold text-sm shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'A enviar...' : 'Enviar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
