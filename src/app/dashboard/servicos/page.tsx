'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export interface ServiceBooking {
  id: string
  client_id?: string | null
  service_type: string
  scheduled_date: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  total_amount: number
  notes?: string | null
  photos_before?: string[]
  photos_after?: string[]
  custom_checklist?: any[]
  clients?: {
    name: string
    phone: string
    address: string
  }
}

export default function ServicosPage() {
  const [orders, setOrders] = useState<ServiceBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<ServiceBooking | null>(null)

  // Estados para Modal de Fotos & Gestão
  const [beforeUrlInput, setBeforeUrlInput] = useState('')
  const [afterUrlInput, setAfterUrlInput] = useState('')
  const [updating, setUpdating] = useState(false)

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, clients(name, phone, address)')
      .order('scheduled_date', { ascending: false })

    if (!error && data) {
      setOrders(data as any)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleUpdateStatus = async (orderId: string, newStatus: ServiceBooking['status']) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    fetchOrders()
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null)
    }
  }

  const handleAddPhotoBefore = async () => {
    if (!selectedOrder || !beforeUrlInput.trim()) return
    setUpdating(true)

    const updatedBefore = [...(selectedOrder.photos_before || []), beforeUrlInput.trim()]

    const { error } = await supabase
      .from('orders')
      .update({ photos_before: updatedBefore })
      .eq('id', selectedOrder.id)

    if (!error) {
      setSelectedOrder({ ...selectedOrder, photos_before: updatedBefore })
      setBeforeUrlInput('')
      fetchOrders()
    }
    setUpdating(false)
  }

  const handleAddPhotoAfter = async () => {
    if (!selectedOrder || !afterUrlInput.trim()) return
    setUpdating(true)

    const updatedAfter = [...(selectedOrder.photos_after || []), afterUrlInput.trim()]

    const { error } = await supabase
      .from('orders')
      .update({ photos_after: updatedAfter })
      .eq('id', selectedOrder.id)

    if (!error) {
      setSelectedOrder({ ...selectedOrder, photos_after: updatedAfter })
      setAfterUrlInput('')
      fetchOrders()
    }
    setUpdating(false)
  }

  const handleRemovePhoto = async (type: 'before' | 'after', index: number) => {
    if (!selectedOrder) return
    setUpdating(true)

    const list = type === 'before' ? [...(selectedOrder.photos_before || [])] : [...(selectedOrder.photos_after || [])]
    list.splice(index, 1)

    const payload = type === 'before' ? { photos_before: list } : { photos_after: list }

    const { error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', selectedOrder.id)

    if (!error) {
      setSelectedOrder({ ...selectedOrder, ...payload })
      fetchOrders()
    }
    setUpdating(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-[#0B192C]">
      {/* Cabeçalho */}
      <header className="bg-[#0B192C] text-white py-4 px-6 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard" className="text-2xl font-bold text-[#00D4FF]">R&R</Link>
          <span className="text-lg font-medium text-slate-200">Services — Gestão de Serviços & Galeria</span>
        </div>
        <Link
          href="/dashboard"
          className="bg-slate-800 text-slate-200 px-4 py-2 rounded-xl text-sm hover:bg-slate-700 transition"
        >
          ← Voltar ao Painel
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0B192C]">Serviços & Intervenções</h1>
          <p className="text-slate-600 text-sm">Gira o estado das limpezas e carregue as fotografias de Antes & Depois para o cliente visualizar.</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">A carregar serviços...</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Serviço</th>
                    <th className="px-6 py-4">Data Agendada</th>
                    <th className="px-6 py-4">Valor (€)</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 font-semibold text-[#0B192C]">
                        {o.clients?.name || 'Cliente Direto'}
                        <p className="text-xs text-slate-400 font-normal">{o.clients?.phone}</p>
                      </td>
                      <td className="px-6 py-4 font-medium">{o.service_type}</td>
                      <td className="px-6 py-4 text-xs">
                        {new Date(o.scheduled_date).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="px-6 py-4 font-bold text-[#0B192C]">{o.total_amount?.toFixed(2)} €</td>
                      <td className="px-6 py-4">
                        <select
                          value={o.status}
                          onChange={(e) => handleUpdateStatus(o.id, e.target.value as any)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white"
                        >
                          <option value="pending">🟡 Agendado</option>
                          <option value="in_progress">🔵 Em Curso</option>
                          <option value="completed">🟢 Concluído</option>
                          <option value="cancelled">🔴 Cancelado</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="bg-[#0B192C] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                        >
                          📸 Galeria & Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal / Gerir Galeria Antes/Depois e Detalhes do Serviço */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#0B192C]">Gestão de Fotos & Extras</h3>
                <p className="text-xs text-slate-500">{selectedOrder.clients?.name} — {selectedOrder.service_type}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Extras Selecionados pelo Cliente */}
            {selectedOrder.custom_checklist && selectedOrder.custom_checklist.length > 0 && (
              <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
                <span className="text-xs font-bold text-blue-800 uppercase tracking-wider block mb-2">
                  ✨ Extras Solicitados pelo Cliente
                </span>
                <ul className="space-y-1">
                  {selectedOrder.custom_checklist.map((item: any, idx: number) => (
                    <li key={idx} className="text-xs text-slate-700 flex justify-between">
                      <span>• {item.name}</span>
                      <span className="font-semibold">+{item.price}€</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Adicionar Fotos ANTES */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider">🔴 Fotos de ANTES do Serviço</h4>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Cole a URL da imagem de Antes (ex: Imgur, Unsplash...)"
                  value={beforeUrlInput}
                  onChange={(e) => setBeforeUrlInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#00D4FF]"
                />
                <button
                  onClick={handleAddPhotoBefore}
                  disabled={updating}
                  className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
                >
                  Adicionar
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                {selectedOrder.photos_before?.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img src={url} alt="Antes" className="w-full h-24 object-cover rounded-lg border border-slate-200" />
                    <button
                      onClick={() => handleRemovePhoto('before', idx)}
                      className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 text-[10px] opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Adicionar Fotos DEPOIS */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">🟢 Fotos de DEPOIS do Serviço</h4>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Cole a URL da imagem de Depois"
                  value={afterUrlInput}
                  onChange={(e) => setAfterUrlInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#00D4FF]"
                />
                <button
                  onClick={handleAddPhotoAfter}
                  disabled={updating}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-700 transition cursor-pointer"
                >
                  Adicionar
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                {selectedOrder.photos_after?.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img src={url} alt="Depois" className="w-full h-24 object-cover rounded-lg border border-slate-200" />
                    <button
                      onClick={() => handleRemovePhoto('after', idx)}
                      className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 text-[10px] opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-200 transition cursor-pointer"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}