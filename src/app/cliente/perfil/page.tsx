"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function PerfilPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvoSucesso, setSalvoSucesso] = useState(false);
  const [mensagemSenha, setMensagemSenha] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Dados do Perfil do Cliente
  const [perfil, setPerfil] = useState({
    id: "",
    nome: "",
    email: "",
    telefone: "",
    morada: "",
    preferencias: {
      animaisEstimacao: "",
      instrucoesAcesso: "",
    }
  });

  // Estado para Alteração de Palavra-passe
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  useEffect(() => {
    carregarPerfil();
  }, []);

  async function carregarPerfil() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      return;
    }

    // Carrega dados da tabela 'clients' pelo e-mail autenticado
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('email', session.user.email)
      .single();

    if (data) {
      setPerfil({
        id: data.id,
        nome: data.name || "",
        email: data.email || session.user.email || "",
        telefone: data.phone || "",
        morada: data.address || "",
        preferencias: {
          animaisEstimacao: data.notes?.includes('Animais:') ? data.notes.split('Animais:')[1]?.split('|')[0]?.trim() : "",
          instrucoesAcesso: data.notes?.includes('Acesso:') ? data.notes.split('Acesso:')[1]?.trim() : (data.notes || ""),
        }
      });
    }

    setLoading(false);
  }

  // Guardar Dados Pessoais & Morada no Supabase
  const handleSalvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);

    const notasFormatadas = `Acesso: ${perfil.preferencias.instrucoesAcesso} | Animais: ${perfil.preferencias.animaisEstimacao}`;

    const { error } = await supabase
      .from('clients')
      .update({
        name: perfil.nome,
        phone: perfil.telefone,
        address: perfil.morada,
        notes: notasFormatadas
      })
      .eq('id', perfil.id);

    if (error) {
      alert("Erro ao guardar alterações: " + error.message);
    } else {
      setSalvoSucesso(true);
      setTimeout(() => setSalvoSucesso(false), 4000);
    }

    setSalvando(false);
  };

  // Alterar a Palavra-passe no Supabase Auth
  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemSenha(null);

    if (novaSenha.length < 6) {
      setMensagemSenha({ tipo: 'erro', texto: 'A palavra-passe deve ter pelo menos 6 caracteres.' });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setMensagemSenha({ tipo: 'erro', texto: 'As palavras-passe introduzidas não coincidem.' });
      return;
    }

    setSalvandoSenha(true);

    const { error } = await supabase.auth.updateUser({
      password: novaSenha
    });

    if (error) {
      setMensagemSenha({ tipo: 'erro', texto: 'Erro ao alterar palavra-passe: ' + error.message });
    } else {
      setMensagemSenha({ tipo: 'sucesso', texto: 'Palavra-passe atualizada com sucesso!' });
      setNovaSenha('');
      setConfirmarSenha('');
    }

    setSalvandoSenha(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-[#0B192C] font-sans pb-16">
      
      {/* CABEÇALHO */}
      <header className="bg-[#0B192C] text-white sticky top-0 z-50 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/cliente" className="flex items-center space-x-2">
            <span className="text-2xl font-extrabold text-[#00D4FF]">R&R</span>
            <span className="text-lg font-bold text-slate-100">Portal do Cliente</span>
          </Link>

          <nav className="flex items-center space-x-6 text-sm font-semibold text-slate-300">
            <Link href="/cliente" className="hover:text-[#00D4FF] transition">← Voltar ao Painel</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        <div>
          <h1 className="text-3xl font-extrabold text-[#0B192C]">O Meu Perfil e Preferências</h1>
          <p className="text-slate-600 text-sm mt-1">
            Gerencie os seus contactos, morada de intervenção, instruções para a equipa e a sua palavra-passe de acesso.
          </p>
        </div>

        {salvoSucesso && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm font-semibold text-center">
            ✓ As suas informações foram atualizadas com sucesso!
          </div>
        )}

        {/* 1. ALTERAÇÃO DE PALAVRA-PASSE */}
        <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b pb-3">
            <h2 className="text-lg font-bold text-[#0B192C]">Segurança & Acesso</h2>
            <p className="text-xs text-slate-500 mt-0.5">Altere a sua palavra-passe de acesso ao portal.</p>
          </div>

          {mensagemSenha && (
            <div className={`p-4 rounded-2xl text-sm font-semibold text-center border ${
              mensagemSenha.tipo === 'sucesso'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              {mensagemSenha.texto}
            </div>
          )}

          <form onSubmit={handleAlterarSenha} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Nova Palavra-passe *</label>
              <input
                type="password"
                required
                placeholder="Mínimo 6 caracteres"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#00D4FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Confirmar Palavra-passe *</label>
              <input
                type="password"
                required
                placeholder="Repita a palavra-passe"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#00D4FF]"
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={salvandoSenha}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow transition cursor-pointer"
              >
                {salvandoSenha ? 'A atualizar...' : '🔒 Atualizar Palavra-passe'}
              </button>
            </div>
          </form>
        </section>

        {/* 2. DADOS PESSOAIS & MORADA */}
        <form onSubmit={handleSalvarPerfil} className="space-y-8">
          
          <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-[#0B192C] border-b pb-3">Dados Pessoais & Contactos</h2>
            
            {loading ? (
              <p className="text-xs text-slate-400">A carregar dados do perfil...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={perfil.nome}
                    onChange={(e) => setPerfil({ ...perfil, nome: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#00D4FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">E-mail (Login)</label>
                  <input
                    type="email"
                    disabled
                    value={perfil.email}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Telemóvel / Telefone</label>
                  <input
                    type="text"
                    required
                    value={perfil.telefone}
                    onChange={(e) => setPerfil({ ...perfil, telefone: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#00D4FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Morada Principal</label>
                  <input
                    type="text"
                    value={perfil.morada}
                    onChange={(e) => setPerfil({ ...perfil, morada: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#00D4FF]"
                  />
                </div>
              </div>
            )}
          </section>

          {/* 3. INSTRUÇÕES PARA A EQUIPA */}
          <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-[#0B192C] border-b pb-3">Instruções para a Equipa de Limpeza</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Instruções de Acesso ao Imóvel</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Código do portão, onde se encontra a chave, etc."
                  value={perfil.preferencias.instrucoesAcesso}
                  onChange={(e) => setPerfil({
                    ...perfil,
                    preferencias: { ...perfil.preferencias, instrucoesAcesso: e.target.value }
                  })}
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#00D4FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Animais de Estimação no Imóvel</label>
                <input
                  type="text"
                  placeholder="Ex: Cão amigável na cozinha"
                  value={perfil.preferencias.animaisEstimacao}
                  onChange={(e) => setPerfil({
                    ...perfil,
                    preferencias: { ...perfil.preferencias, animaisEstimacao: e.target.value }
                  })}
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#00D4FF]"
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={salvando}
              className="bg-[#0B192C] hover:bg-slate-800 text-white font-bold text-sm px-8 py-3.5 rounded-xl shadow-lg transition cursor-pointer"
            >
              {salvando ? 'A guardar...' : 'Guardar Alterações do Perfil'}
            </button>
          </div>

        </form>

      </main>
    </div>
  );
}