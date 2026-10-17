'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export interface Product {
  id: string
  name: string
  description?: string
  category: string
  price: number
  stock_quantity: number
  is_available: boolean
  image_url?: string
}

export default function ClientStorePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [currentClient, setCurrentClient] = useState<any>(null)

  useEffect(() => {
    fetchStoreData()
  }, [])

  async function fetchStoreData() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user?.email) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('email', session.user.email)
        .single()
      
      if (clientData) setCurrentClient(clientData)
    }

    const { data: prods } = await supabase
      .from('products')
      .select('*')
      .eq('is_available', true)
      .gt('stock_quantity', 0)
      .order('name', { ascending: true })

    if (prods) setProducts(prods as Product[])
    setLoading(false)
  }

  async function handleOrderSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProduct || !currentClient) {
      alert('Sessão expirada ou cliente não encontrado. Por favor, volte a iniciar sessão.')
      setSubmitting(false)
      return
    }

    const total = Number(selectedProduct.price) * quantity

    const { error } = await supabase.from('product_orders').insert([
      {
        client_id: currentClient.id,
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity,
        unit_price: selectedProduct.price,
        total_price: total,
        status: 'pending',
      },
    ])

    if (error) {
      alert('Erro ao realizar encomenda: ' + error.message)
    } else {
      alert(`Encomenda de ${quantity}x "${selectedProduct.name}" efetuada com sucesso!`)
      setSelectedProduct(null)
      setQuantity(1)
      fetchStoreData()
    }
    setSubmitting(false) // Garante que o botão volta ao normal
  }

  return (
    <main className="min-h-screen bg-slate-50 text-[#0B192C]">
      <header className="bg-[#0B192C] text-white py-4 px-8 shadow-md flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="bg-[#00D4FF]/10 p-2 rounded-xl border border-[#00D4FF]/20">
            <span className="text-2xl font-bold tracking-wider text-[#00D4FF]">R&R</span>
          </div>
          <div>
            <span className="text-lg font-bold text-white block leading-none">Services</span>
            <span className="text-xs text-slate-400">Loja Completa de Detergentes & Produtos</span>
          </div>
        </div>
        <Link
          href="/cliente"
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition border border-slate-700"
        >
          ← Voltar à Área de Cliente
        </Link>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-[#0B192C]">Loja R&R Services</h1>
          <p className="text-slate-500 text-sm mt-1">
            Escolha os produtos e detergentes de gama profissional para entrega na sua próxima intervenção.
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 font-medium">A carregar produtos disponíveis...</div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400">
            De momento não existem produtos disponíveis para encomenda.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((prod) => (
              <div key={prod.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition">
                <div>
                  <div className="w-full h-40 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden mb-4 border border-slate-100">
                    {prod.image_url ? (
                      <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">🧴</span>
                    )}
                  </div>
                  <span className="text-[10px] font-extrabold text-[#00D4FF] bg-[#00D4FF]/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {prod.category}
                  </span>
                  <h3 className="text-base font-bold text-[#0B192C] mt-2 line-clamp-1">{prod.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{prod.description || 'Produto de limpeza profissional.'}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-lg font-black text-[#0B192C]">{Number(prod.price).toFixed(2)} €</span>
                  <button
                    onClick={() => {
                      setSelectedProduct(prod)
                      setQuantity(1)
                    }}
                    className="bg-[#0B192C] hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm"
                  >
                    Encomendar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL CONFIRMAR ENCOMENDA */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#0B192C]">Confirmar Encomenda</h3>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleOrderSubmit} className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-[#0B192C] block">{selectedProduct.name}</span>
                <span className="text-xs text-slate-500 block mt-0.5">Preço Unitário: {Number(selectedProduct.price).toFixed(2)} €</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct.stock_quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-bold"
                />
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-500">Total a Pagar:</span>
                <span className="text-base text-[#00D4FF] bg-[#0B192C] px-3 py-1 rounded-lg">
                  {(Number(selectedProduct.price) * quantity).toFixed(2)} €
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#0B192C] hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition"
                >
                  {submitting ? 'A submeter...' : 'Confirmar Encomenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}