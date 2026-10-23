'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ExtraService {
  id: string
  name: string
  description: string
  price: number
  price_type: 'fixed' | 'per_unit' | 'quote'
  category: string
  is_available: boolean
  image_url?: string
}

export default function ExtrasCatalogPage() {
  const [services, setServices] = useState<ExtraService[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Campos do formulário
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [priceType, setPriceType] = useState<'fixed' | 'per_unit' | 'quote'>('fixed')
  const [category, setCategory] = useState('Cozinha')
  const [imageUrl, setImageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCatalog()
  }, [])

  async function fetchCatalog() {
    setLoading(true)
    const { data, error } = await supabase
      .from('services_catalog')
      .select('*')
      .order('category', { ascending: true })

    if (!error && data) {
      setServices(data as ExtraService[])
    }
    setLoading(false)
  }

  async function handleCreateService(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const { error } = await supabase.from('services_catalog').insert([
      {
        name,
        description,
        price: priceType === 'quote' ? 0 : parseFloat(price) || 0,
        price_type: priceType,
        category,
        image_url: imageUrl || null,
        is_available: true,
      },
    ])

    if (error) {
      alert('Erro ao guardar serviço: ' + error.message)
    } else {
      setShowModal(false)
      setName('')
      setDescription('')
      setPrice('')
      setImageUrl('')
      fetchCatalog()
    }
    setSubmitting(false)
  }

  async function toggleAvailability(id: string, currentStatus: boolean) {
    const { error } = await supabase
      .from('services_catalog')
      .update({ is_available: !currentStatus })
      .eq('id', id)

    if (!error) {
      fetchCatalog()
    }
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 text-[#0B192C] p-4 sm:p-6 md:p-8">
      
      {/* CABEÇALHO DA PÁGINA & BOTÃO ADICIONAR */}
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B192C]">Catálogo de Serviços Extra</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Adicione e gira os serviços adicionais que os clientes podem encomendar (forno, sofás, vidros, etc.).
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-[#0B192C] text-white hover:bg-slate-800 font-bold px-6 py-3.5 sm:py-3 rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-2 text-xs sm:text-sm text-center"
        >
          <span>+ Adicionar Novo Serviço Extra</span>
        </button>
      </div>

      {/* GRELHA DE SERVIÇOS */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">A carregar catálogo...</div>
      ) : services.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-sm">
          <p className="text-slate-600 font-bold text-base">Ainda não existem serviços extra no catálogo.</p>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Clique no botão acima para adicionar o primeiro serviço.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {services.map((item) => (
            <div key={item.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div className="p-5 sm:p-6">
                <div className="flex justify-between items-start mb-3 gap-2">
                  <span className="text-[10px] sm:text-xs font-bold uppercase px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {item.category}
                  </span>
                  <button
                    onClick={() => toggleAvailability(item.id, item.is_available)}
                    className={`text-[11px] px-3 py-1 rounded-full font-bold transition ${
                      item.is_available ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {item.is_available ? 'Disponível' : 'Indisponível'}
                  </button>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-[#0B192C] mb-2">{item.name}</h3>
                <p className="text-slate-600 text-xs sm:text-sm mb-4 line-clamp-2">{item.description || 'Sem descrição.'}</p>
              </div>

              <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs sm:text-sm">
                <span className="text-slate-500 font-medium">
                  {item.price_type === 'quote' ? 'Sob Orçamento' : item.price_type === 'per_unit' ? 'Por Unidade' : 'Preço Fixo'}
                </span>
                <span className="font-extrabold text-[#0B192C] text-base sm:text-lg">
                  {item.price_type === 'quote' ? 'Sob Consulta' : `${Number(item.price).toFixed(2)} €`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL PARA ADICIONAR SERVIÇO EXTRA (Adaptado para iPhone/Mobile) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-extrabold text-[#0B192C]">Novo Serviço Extra</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 font-bold p-2">✕</button>
            </div>

            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Nome do Serviço *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Limpeza do Forno"
                  className="w-full px-4 py-3.5 sm:py-3 border border-slate-300 rounded-xl text-base sm:text-sm outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3.5 sm:py-3 border border-slate-300 rounded-xl text-base sm:text-sm outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50"
                >
                  <option value="Cozinha">Cozinha</option>
                  <option value="Higienização & Estofos">Higienização & Estofos</option>
                  <option value="Vidros & Estores">Vidros & Estores</option>
                  <option value="Tratamento de Roupa">Tratamento de Roupa</option>
                  <option value="Geral">Geral</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Tipo de Preço</label>
                <select
                  value={priceType}
                  onChange={(e) => setPriceType(e.target.value as any)}
                  className="w-full px-4 py-3.5 sm:py-3 border border-slate-300 rounded-xl text-base sm:text-sm outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50"
                >
                  <option value="fixed">Preço Fixo</option>
                  <option value="per_unit">Por Unidade / Dimensão</option>
                  <option value="quote">Sujeito a Orçamento</option>
                </select>
              </div>

              {priceType !== 'quote' && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Valor (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex: 25.00"
                    className="w-full px-4 py-3.5 sm:py-3 border border-slate-300 rounded-xl text-base sm:text-sm outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Limpeza interna profunda com remoção de gordura..."
                  className="w-full px-4 py-3.5 sm:py-3 border border-slate-300 rounded-xl text-base sm:text-sm outline-none focus:ring-2 focus:ring-[#00D4FF] h-24 bg-slate-50"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-4 py-3 sm:py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-3.5 sm:py-2.5 bg-[#0B192C] text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition disabled:opacity-50 text-center shadow"
                >
                  {submitting ? 'A guardar...' : 'Criar Serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  )
}