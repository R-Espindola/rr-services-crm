'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  description: string
  price: number
  stock_quantity: number
}

interface Service {
  id: string
  title: string
  description: string
  base_price: number
  pricing_type: string
}

export default function LojaPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      // Procurar produtos publicados
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('is_published', true)

      // Procurar serviços disponíveis
      const { data: servData } = await supabase
        .from('services_catalog')
        .select('*')
        .eq('is_available', true)

      if (prodData) setProducts(prodData)
      if (servData) setServices(servData)
      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">A carregar o catálogo...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-[#0B192C]">
      {/* Navegação Superior */}
      <header className="bg-[#0B192C] text-white py-4 px-6 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard" className="text-2xl font-bold text-[#00D4FF]">R&R</Link>
          <span className="text-lg font-medium text-slate-200">Services — Catálogo & Loja</span>
        </div>
        <Link
          href="/dashboard"
          className="bg-slate-800 text-slate-200 px-4 py-2 rounded-xl text-sm hover:bg-slate-700 transition"
        >
          ← Voltar ao Painel
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        
        {/* Secção 1: Catálogo de Serviços Extra */}
        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#0B192C]">Serviços Extra Disponíveis</h2>
              <p className="text-sm text-slate-500">Adicione limpezas especializadas às suas marcações regulares.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <div key={service.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-[#00D4FF] uppercase tracking-wider bg-[#00D4FF]/10 px-2.5 py-1 rounded-md">
                    Serviço Extra
                  </span>
                  <h3 className="font-bold text-lg mt-3 mb-1">{service.title}</h3>
                  <p className="text-sm text-slate-600 mb-4">{service.description}</p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xl font-bold text-[#0B192C]">
                    €{Number(service.base_price).toFixed(2)}
                  </span>
                  <button className="bg-[#0B192C] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition">
                    Solicitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Secção 2: Loja de Produtos de Limpeza */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#0B192C]">Produtos e Ambientadores</h2>
              <p className="text-sm text-slate-500">Produtos profissionais de manutenção e ambientadores de espaço.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-md">
                    Stock: {product.stock_quantity} un.
                  </span>
                  <h3 className="font-bold text-lg mt-3 mb-1">{product.name}</h3>
                  <p className="text-sm text-slate-600 mb-4">{product.description}</p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xl font-bold text-[#0B192C]">
                    €{Number(product.price).toFixed(2)}
                  </span>
                  <button className="bg-[#00D4FF] text-[#0B192C] text-xs font-bold px-4 py-2 rounded-xl hover:bg-[#00c0e6] transition">
                    Encomendar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}