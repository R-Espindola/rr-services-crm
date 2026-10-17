'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setErrorMsg('Erro ao entrar: ' + error.message)
        setLoading(false)
        return
      }

      // Redireciona para o dashboard após login com sucesso
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setErrorMsg('Ocorreu um erro inesperado.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        
        {/* Cabeçalho do Card */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-3">
            <span className="text-3xl font-bold tracking-wider text-[#00D4FF]">R&R</span>
            <span className="text-xl font-medium text-[#0B192C]"> Services</span>
          </Link>
          <h2 className="text-xl font-bold text-[#0B192C]">Aceder à Plataforma</h2>
          <p className="text-sm text-slate-500 mt-1">Insira as suas credenciais para gerir os seus serviços</p>
        </div>

        {/* Mensagem de Erro */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {errorMsg}
          </div>
        )}

        {/* Formulário de Login */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@email.com"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00D4FF] focus:border-[#00D4FF] outline-none transition text-slate-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Palavra-passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00D4FF] focus:border-[#00D4FF] outline-none transition text-slate-800"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0B192C] text-white font-semibold py-3 rounded-xl shadow-md hover:bg-slate-800 transition disabled:opacity-50"
          >
            {loading ? 'A entrar...' : 'Entrar na Conta'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="hover:text-[#0B192C] font-medium">
            ← Voltar à página inicial
          </Link>
        </div>

      </div>
    </div>
  )
}