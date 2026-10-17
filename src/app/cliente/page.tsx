'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ServiceExtra {
  id: string
  name: string
  price: number
  selected: boolean
}

export default function PortalClientePage() {
  const [phoneInput, setPhoneInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [clientData, setClientData] = useState<any>(null)
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [searched, setSearched] = useState(false)

  // Extras disponíveis para o cliente selecionar
  const [extras, setExtras] = useState<ServiceExtra[]>([
    { id: 'forno', name: 'Limpeza Interior de Forno / Micro-ondas', price: 15, selected: false },
    { id: 'frigorifico', name: 'Limpeza e Desinfeção de Frigorífico', price: 15, selected: false },
    { id: 'janelas', name: 'Limpeza Integral de Vidros & Sacada', price: 25, selected: false },
    { id: 'passar_ferro', name: 'Tratamento de Roupa / Passar a Ferro (1h)', price: 18, selected: false },
    { id: 'colchao', name: 'Higienização Extra de Colchão Solteiro/Casal', price: 30, selected: false },
  ])

  const [savingExtras, setSavingExtras] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSearched(true)
    setSaveSuccess(false)

    const cleanPhone = phoneInput.replace(/\D/g, '')

    // Procurar cliente pelo telefone
    const { data: clients } = await supabase
      .from('clients')
      .select('*')

    const foundClient = clients?.find((c) => c.phone.replace(/\D/g, '').includes(cleanPhone))

    if (foundClient) {
      setClientData(foundClient)

      // Procurar serviços agendados deste cliente
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('client_id', foundClient.id)
        .order('scheduled_date', { ascending: false })

      if (orders) setActiveOrders(orders)
    } else {
      setClientData(null)
      setActiveOrders([])
    }
    setLoading(false)
  }

  const toggleExtra = (id: string) => {
    setExtras(extras.map(item => item.id === id ? { ...item, selected: !item.selected } : item))
  }

  const handleSaveChecklist = async (orderId: string, currentTotal: number) => {
    setSavingExtras(true)
    const selectedExtras = extras.filter(e => e.selected)
    const extraCost = selectedExtras.reduce((sum, item) => sum + item.price, 0)
    const newTotal = currentTotal + extraCost

    const { error } = await supabase
      .from('orders')
      .update({
        custom_checklist: selectedExtras,
        total_amount: newTotal
      })
      .eq('id', orderId)

    setSavingExtras(false)
    if (!error) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-[#0B192C]">
      {/* Cabeçalho */}
      <header className="bg-[#0B192C] text-white py-5 px-6 shadow-lg flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <span className="text-2xl font-bold text-[#00D4FF]">R&R</span>
          <span className="text-lg font-medium text-slate-200">Services — Portal do Cliente</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Pesquisa por Telemóvel */}
        {!clientData && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md mx-auto my-10">
            <span className="text-4xl mb-4 block">✨</span>
            <h1 className="text-xl font-bold text-[#0B192C] mb-2">Área Exclusiva do Cliente</h1>
            <p className="text-xs text-slate-500 mb-6">Insira o seu número de telemóvel para visualizar os seus agendamentos, fotos de trabalhos realizados e personalizar os seus serviços.</p>

            <form onSubmit={handleSearch} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Ex: 912 000 000"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] text-center font-semibold text-slate-800 text-base"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0B192C] text-white py-3 rounded-xl font-semibold text-sm hover:bg-slate-800 transition cursor-pointer"
              >
                {loading ? 'A procurar...' : 'Aceder ao Meu Espaço'}
              </button>
            </form>

            {searched && !clientData && !loading && (
              <p className="text-xs text-rose-500 mt-4">Nenhum registo encontrado com este contacto. Verifique o número digitado.</p>
            )}
          </div>
        )}

        {/* Conteúdo do Cliente */}
        {clientData && (
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-[#00D4FF] uppercase tracking-wider block">Bem-vindo(a)</span>
                <h2 className="text-2xl font-bold text-[#0B192C]">{clientData.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">📍 {clientData.address}</p>
              </div>
              <button
                onClick={() => { setClientData(null); setPhoneInput('') }}
                className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer"
              >
                Sair
              </button>
            </div>

            {/* Agendamentos do Cliente */}
            <h3 className="text-lg font-bold text-[#0B192C]">Os Seus Serviços & Histórico</h3>

            {activeOrders.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">
                Não existem agendamentos ativos ou anteriores registados.
              </div>
            ) : (
              activeOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
                  {/* Informações Principais */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
                    <div>
                      <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                        {order.status === 'completed' ? '🟢 Concluído' : '🟡 Agendado'}
                      </span>
                      <h4 className="text-lg font-bold text-[#0B192C] mt-2">{order.service_type}</h4>
                      <p className="text-xs text-slate-500">
                        Data: <strong>{new Date(order.scheduled_date).toLocaleDateString('pt-PT')}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 uppercase block">Valor Total</span>
                      <span className="text-xl font-bold text-[#0B192C]">{order.total_amount?.toFixed(2) || '0.00'} €</span>
                    </div>
                  </div>

                  {/* GALERIA DE FOTOS ANTES & DEPOIS */}
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">📸 Galeria de Transformação (Antes & Depois)</h5>
                    
                    {(!order.photos_before || order.photos_before.length === 0) && (!order.photos_after || order.photos_after.length === 0) ? (
                      <div className="bg-slate-50 p-4 rounded-xl text-center text-xs text-slate-400 border border-slate-100">
                        As fotografias do serviço serão disponibilizadas assim que a equipa concluir a intervenção.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Antes */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="text-xs font-bold text-rose-600 block mb-2">🔴 Antes do Serviço</span>
                          <div className="grid grid-cols-2 gap-2">
                            {order.photos_before?.map((url: string, idx: number) => (
                              <img key={idx} src={url} alt="Antes" className="w-full h-28 object-cover rounded-lg border border-slate-200" />
                            ))}
                          </div>
                        </div>

                        {/* Depois */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="text-xs font-bold text-emerald-600 block mb-2">🟢 Depois da Higienização</span>
                          <div className="grid grid-cols-2 gap-2">
                            {order.photos_after?.map((url: string, idx: number) => (
                              <img key={idx} src={url} alt="Depois" className="w-full h-28 object-cover rounded-lg border border-slate-200" />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CHECKLIST E SELEÇÃO DE EXTRAS (Apenas para serviços pendentes/agendados) */}
                  {order.status !== 'completed' && (
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                      <div className="flex justify-between items-center">
                        <h5 className="text-xs font-bold text-[#0B192C] uppercase tracking-wider">
                          ✨ Personalizar Tarefas & Adicionar Extras para este dia
                        </h5>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {extras.map((extra) => (
                          <label
                            key={extra.id}
                            onClick={() => toggleExtra(extra.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                              extra.selected
                                ? 'bg-blue-50/80 border-[#00D4FF] text-[#0B192C]'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={extra.selected}
                                onChange={() => {}}
                                className="w-4 h-4 text-[#00D4FF] rounded"
                              />
                              <span className="text-xs font-medium">{extra.name}</span>
                            </div>
                            <span className="text-xs font-bold text-[#0B192C]">+{extra.price}€</span>
                          </label>
                        ))}
                      </div>

                      {saveSuccess && (
                        <p className="text-xs text-emerald-600 font-semibold text-center">
                          ✅ Extras e checklist atualizados com sucesso para a sua próxima limpeza!
                        </p>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => handleSaveChecklist(order.id, order.total_amount)}
                          disabled={savingExtras}
                          className="bg-[#0B192C] text-white px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                        >
                          {savingExtras ? 'A guardar...' : 'Confirmar Extras para este Serviço'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}