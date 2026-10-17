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
  cost_price: number
  stock_quantity: number
  min_stock_alert: number
  is_available: boolean
  image_url?: string
}

export default function StoreAdminPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Modais
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Campos do Formulário de Produto
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Detergentes')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [stockQuantity, setStockQuantity] = useState('')
  const [minStockAlert, setMinStockAlert] = useState('5')
  const [imageUrl, setImageUrl] = useState('')
  const [isAvailable, setIsAvailable] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true })

    if (!error && data) {
      setProducts(data as Product[])
    }
    setLoading(false)
  }

  function handleOpenEdit(prod: Product) {
    setEditingProduct(prod)
    setName(prod.name || '')
    setDescription(prod.description || '')
    setCategory(prod.category || 'Detergentes')
    setPrice(String(prod.price || ''))
    setCostPrice(String(prod.cost_price || ''))
    setStockQuantity(String(prod.stock_quantity || ''))
    setMinStockAlert(String(prod.min_stock_alert || '5'))
    setImageUrl(prod.image_url || '')
    setIsAvailable(prod.is_available ?? true)
  }

  function closeModal() {
    setShowAddModal(false)
    setEditingProduct(null)
    setName('')
    setDescription('')
    setCategory('Detergentes')
    setPrice('')
    setCostPrice('')
    setStockQuantity('')
    setMinStockAlert('5')
    setImageUrl('')
    setIsAvailable(true)
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const cleanPrice = parseFloat(price.toString().replace(',', '.')) || 0
    const cleanCostPrice = parseFloat(costPrice.toString().replace(',', '.')) || 0

    const payload = {
      name,
      description: description || null,
      category: category || 'Detergentes',
      price: cleanPrice,
      cost_price: cleanCostPrice,
      stock_quantity: parseInt(stockQuantity) || 0,
      min_stock_alert: parseInt(minStockAlert) || 5,
      image_url: imageUrl || null,
      is_available: isAvailable,
    }

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProduct.id)

      if (error) alert('Erro ao atualizar produto: ' + error.message)
      else {
        closeModal()
        fetchProducts()
      }
    } else {
      const { error } = await supabase.from('products').insert([payload])

      if (error) alert('Erro ao criar produto: ' + error.message)
      else {
        closeModal()
        fetchProducts()
      }
    }
    setSubmitting(false)
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('Tem certeza que deseja eliminar este produto do catálogo?')) return

    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) alert('Erro ao eliminar: ' + error.message)
    else fetchProducts()
  }

  return (
    <main className="min-h-screen bg-slate-50 text-[#0B192C]">
      {/* Cabeçalho */}
      <header className="bg-[#0B192C] text-white py-4 px-8 shadow-md flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="bg-[#00D4FF]/10 p-2 rounded-xl border border-[#00D4FF]/20">
            <span className="text-2xl font-bold tracking-wider text-[#00D4FF]">R&R</span>
          </div>
          <div>
            <span className="text-lg font-bold text-white block leading-none">Services</span>
            <span className="text-xs text-slate-400">Loja & Gestão de Stock de Produtos (Admin)</span>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition border border-slate-700"
        >
          ← Voltar ao Painel
        </Link>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#0B192C]">Loja & Stock de Produtos</h1>
            <p className="text-slate-500 text-sm mt-1">
              Controle o stock de detergentes, produtos profissionais, preços de venda e alertas de nível mínimo.
            </p>
          </div>

          <button
            onClick={() => {
              closeModal()
              setShowAddModal(true)
            }}
            className="bg-[#0B192C] hover:bg-slate-800 text-white font-bold px-5 py-3 rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 border border-slate-700 text-xs"
          >
            <span>+</span> Adicionar Novo Produto
          </button>
        </div>

        {/* Tabela de Produtos */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Produto</th>
                  <th className="py-4 px-6">Categoria</th>
                  <th className="py-4 px-6">Preço Venda</th>
                  <th className="py-4 px-6">Custo</th>
                  <th className="py-4 px-6">Stock Atual</th>
                  <th className="py-4 px-6">Estado</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">A carregar stock de produtos...</td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-400">
                      Nenhum produto registado no catálogo.
                    </td>
                  </tr>
                ) : (
                  products.map((prod) => {
                    const isLowStock = prod.stock_quantity <= prod.min_stock_alert
                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6 font-bold text-[#0B192C] flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg overflow-hidden border border-slate-200 flex-shrink-0">
                            {prod.image_url ? (
                              <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                            ) : (
                              '🧴'
                            )}
                          </div>
                          <div>
                            {prod.name}
                            <div className="text-xs font-normal text-slate-400 line-clamp-1">{prod.description}</div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-medium text-xs">{prod.category}</td>
                        <td className="py-4 px-6 font-extrabold text-[#0B192C]">{Number(prod.price).toFixed(2)} €</td>
                        <td className="py-4 px-6 text-slate-500 text-xs">{Number(prod.cost_price || 0).toFixed(2)} €</td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            isLowStock ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {prod.stock_quantity} un {isLowStock && '⚠️ Baixo'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                            prod.is_available ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {prod.is_available ? 'Disponível' : 'Indisponível'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(prod)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-xs transition cursor-pointer"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* MODAL ADICIONAR / EDITAR PRODUTO */}
      {(showAddModal || editingProduct) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#0B192C]">
                  {editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">Configure o preço, custos e stock do item.</p>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome do Produto *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Detergente Profissional Multiusos 5L"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Categoria</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex: Detergentes"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">URL da Fotografia</label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://exemplo.com/foto.jpg"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Preço de Venda (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="19.99"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Custo de Aquisição (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="10.00"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Quantidade em Stock *</label>
                  <input
                    type="number"
                    required
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    placeholder="20"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Alerta Stock Mínimo</label>
                  <input
                    type="number"
                    required
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(e.target.value)}
                    placeholder="5"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Descrição do Produto</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes sobre o produto..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#00D4FF] bg-slate-50 text-sm font-medium h-20"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="avail"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="w-4 h-4 accent-[#0B192C]"
                />
                <label htmlFor="avail" className="text-xs font-bold text-slate-700 uppercase">Produto Disponível na Loja</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-7 py-3 bg-[#0B192C] hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'A guardar...' : editingProduct ? 'Guardar Alterações' : 'Criar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}