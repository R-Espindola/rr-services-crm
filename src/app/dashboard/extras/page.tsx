'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface ServiceExtra {
  id: string
  title: string
  description: string
  base_price: number
  category: string
}

export default function ExtrasPage() {
  const [extras, setExtras] = useState<ServiceExtra[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchExtras() {
      const { data, error } = await supabase
        .from('services_catalog')
        .select('*')
        .eq('is_available', true)

      if (data && !error && data.length > 0) {
        setExtras(data)
      } else {
        // Dados de demonstração
        setExtras([
          {
            id: '1',
            title: 'Limpeza Profunda de Forno',
            description: 'Desengorduramento profundo interior e exterior de forno doméstico.',
            base_price: 25.00,
            category: 'Cozinha'
          },
          {
            id: '2',
            title: 'Higienização de Sofá (2 a 3 Lugares)',
            description: 'Higienização e extração profunda de sujidade e ácaros em tecidos.',
            base_price: 50.00,
            category: 'Estofos'
          },
          {
            id: '3',
            title: 'Limpeza de Vidros e Sacadas',
            description: 'Limpeza técnica de vidros interiores, exteriores e caixilharia.',
            base_price: 15.00,
            category: 'Vidros'
          }
        ])
      }
      setLoading(false)
    }

    fetchExtras()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">A carregar serviços extra...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-[#0B192C]">
      {/* Cabeçalho do Módulo */}
      <header className="bg-[#0B192C] text-white py-4 px-6 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard" className="text-2xl font-bold text-[#00D4FF]">R&R</Link>
          <span className="text-lg font-medium text-slate-200">Services — Catálogo de Serviços Extra</span>
        </div>
        <Link
          href="/dashboard"
          className="bg-slate-800 text-slate-200 px-4 py-2 rounded-xl text-sm hover:bg-slate-700 transition"
        >
          ← Voltar ao Painel
        </Link>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0B192C]">Serviços Complementares & Extras</h1>
          <p className="text-slate-600 text-sm mt-1">
            Selecione e solicite serviços de intervenção pontual para juntar às suas limpezas de rotina.
          </p>
        </div>

        {/* Grelha de Serviços Extra */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {extras.map((extra) => (
            <div key={extra.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition">
              <div>
                <span className="text-xs font-bold text-[#00D4FF] uppercase tracking-wider bg-[#00D4FF]/10 px-2.5 py-1 rounded-md">
                  {extra.category}
                </span>
                <h3 className="font-bold text-lg text-[#0B192C] mt-3 mb-2">{extra.title}</h3>
                <p className="text-sm text-slate-600 mb-6">{extra.description}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400 block">Preço Base</span>
                  <span className="text-xl font-bold text-[#0B192C]">
                    €{Number(extra.base_price).toFixed(2)}
                  </span>
                </div>
                <button className="bg-[#0B192C] text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800 transition">
                  Solicitar Extra
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}