"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');

    try {
      // 1. Autenticação no Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        setErro('E-mail ou palavra-passe incorretos.');
        setLoading(false);
        return;
      }

      // 2. Guardar o token no Cookie para o Middleware ler no servidor
      if (data.session) {
        document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${data.session.expires_in}; SameSite=Lax`;
      }

      // 3. Redirecionar conforme o e-mail
      const userEmail = data.user?.email?.toLowerCase() || email.toLowerCase();

      if (
        userEmail === 'rrservices.pt@gmail.com' ||
        userEmail.includes('admin') ||
        userEmail.includes('gestor')
      ) {
        router.push('/admin');
      } else {
        router.push('/cliente');
      }
    } catch (err) {
      setErro('Ocorreu um erro ao tentar ligar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 px-4 py-12 text-[#0B192C]">
      
      {/* Botão de regresso */}
      <div className="absolute top-6 left-6">
        <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-[#0B192C] flex items-center gap-1 transition">
          ← Voltar ao site
        </Link>
      </div>

      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-lg border border-slate-200">
        
        {/* Logótipo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <span className="text-3xl font-extrabold tracking-wider text-[#00D4FF]">R&R</span>
            <span className="text-2xl font-bold text-[#0B192C]">Services</span>
          </Link>
          <p className="text-sm text-slate-500 mt-2">Aceda à sua área reservada ou ao painel de gestão</p>
        </div>

        {/* Mensagem de Erro */}
        {erro && (
          <div className="mb-6 p-3 text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-center">
            {erro}
          </div>
        )}

        {/* Formulário de Autenticação */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
              E-mail
            </label>
            <input
              type="email"
              required
              placeholder="rrservices.pt@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
              Palavra-passe
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0B192C] text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition shadow-md flex items-center justify-center cursor-pointer"
          >
            {loading ? 'A autenticar...' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-6 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 text-center">
          <p className="font-semibold text-[#0B192C]">Acesso de Administrador R&R</p>
          <p className="text-slate-500 mt-0.5">Autenticação oficial ligada ao Supabase.</p>
        </div>

      </div>
    </div>
  );
}