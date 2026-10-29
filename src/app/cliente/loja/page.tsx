'use client'

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import ClientBottomNav from "@/app/cliente/ClientBottomNav";

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
    <main className="min-h-dvh overflow-x-hidden bg-[#F5F7FA] pb-[calc(6rem+env(safe-area-inset-bottom))] text-[#0B192C] xl:pb-0">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0B192C] px-4 py-3 text-white shadow-lg sm:px-6 lg:px-8">
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
          className="inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 sm:text-sm"
        >
          ← Voltar à Área de Cliente
        </Link>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        <div className="mb-7 sm:mb-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Loja do cliente</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0B192C] sm:text-3xl">Produtos profissionais</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Escolha os produtos e detergentes de gama profissional para entrega na sua próxima intervenção.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center text-sm font-medium text-slate-400">A carregar produtos disponíveis...</div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 sm:p-12">
            De momento não existem produtos disponíveis para encomenda.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((prod) => (
              <div key={prod.id} className="group flex min-w-0 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg sm:p-5">
                <div>
                  <div className="mb-3 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 sm:mb-4 sm:h-40 sm:rounded-2xl">
                    {prod.image_url ? (
                      <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">🧴</span>
                    )}
                  </div>
                  <span className="inline-flex max-w-full truncate rounded-full bg-cyan-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-cyan-800 sm:px-2.5 sm:text-[10px]">
                    {prod.category}
                  </span>
                  <h3 className="mt-2 line-clamp-2 break-words text-sm font-bold text-[#0B192C] sm:text-base">{prod.name}</h3>
                  <p className="mt-1 hidden line-clamp-2 text-xs leading-5 text-slate-500 sm:block">{prod.description || 'Produto de limpeza profissional.'}</p>
                </div>

                <div className="mt-4 flex flex-col items-stretch justify-between gap-2 border-t border-slate-100 pt-3 sm:mt-6 sm:flex-row sm:items-center sm:pt-4">
                  <span className="text-base font-black text-[#0B192C] sm:text-lg">{Number(prod.price).toFixed(2)} €</span>
                  <button
                    onClick={() => {
                      setSelectedProduct(prod)
                      setQuantity(1)
                    }}
                    className="min-h-11 rounded-xl bg-[#0B192C] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 sm:px-4"
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#0B192C]">Confirmar Encomenda</h3>
              <button onClick={() => setSelectedProduct(null)} aria-label="Fechar" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">✕</button>
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
      <ClientBottomNav />
    </main>
  )
}
