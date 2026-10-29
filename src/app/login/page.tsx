"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function formatPhoneLogin(value: string) {
  let digits = value.trim().replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('351')) return `+${digits}`;
  if (digits.length === 9) return `+351${digits}`;
  return digits.length >= 7 && digits.length <= 15 ? `+${digits}` : null;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [mode, setMode] = useState<'login' | 'recover' | 'reset'>('login');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resetAuthorized, setResetAuthorized] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') !== 'reset-password') return;

    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && event === 'PASSWORD_RECOVERY' && session) setResetAuthorized(true);
    });
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setMode('reset');
      if (session) setResetAuthorized(true);
      else setRecoveryError('O link de recuperação expirou ou é inválido. Peça um novo link.');
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');

    try {
      const identifier = email.trim();
      const credentials = identifier.includes('@')
        ? { email: identifier.toLowerCase(), password }
        : { phone: formatPhoneLogin(identifier) ?? identifier, password };
      const { data, error } = await supabase.auth.signInWithPassword(credentials);

      if (error) {
        setErro('E-mail ou palavra-passe incorretos.');
        setLoading(false);
        return;
      }

      if (!data.session) {
        setErro('Não foi possível iniciar sessão. Tente novamente.');
        setLoading(false);
        return;
      }

      // Resolve the role by the Auth subject, not by a user-editable email.
      let destino = '/cliente';
      try {
        const { data: clientData } = await supabase
          .from('clients')
          .select('role')
          .eq('auth_user_id', data.user.id)
          .maybeSingle();

        if (clientData?.role === 'admin') {
          destino = '/admin';
        }
      } catch {
        // Se não encontrar o perfil, mantém o destino padrão (/cliente)
      }

      router.push(destino);
    } catch {
      setErro('Ocorreu um erro ao tentar ligar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  async function requestPasswordRecovery(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRecoveryBusy(true);
    setRecoveryError('');
    try {
      const redirectTo = `${window.location.origin}/auth/callback?flow=recovery`;
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim().toLowerCase(), { redirectTo });
      if (error) throw error;
      setRecoverySent(true);
    } catch {
      setRecoveryError('Não foi possível enviar o pedido. Confirme o e-mail e tente novamente.');
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function saveRecoveredPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resetAuthorized) {
      setRecoveryError('Abra o link válido enviado por e-mail antes de definir uma nova palavra-passe.');
      return;
    }
    if (resetPassword.length < 12) {
      setRecoveryError('A palavra-passe deve ter pelo menos 12 caracteres.');
      return;
    }
    if (resetPassword !== confirmResetPassword) {
      setRecoveryError('As palavras-passe não coincidem.');
      return;
    }
    setResetBusy(true);
    setRecoveryError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: resetPassword });
      if (error) throw error;
      await supabase.auth.signOut();
      setResetAuthorized(false);
      setMode('login');
      setErro('Palavra-passe alterada. Inicie sessão com a nova palavra-passe.');
      window.history.replaceState(null, '', '/login?force=1');
    } catch {
      setRecoveryError('Não foi possível alterar a palavra-passe. Peça um novo link e tente novamente.');
      setResetBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 px-4 py-12 text-[#0B192C]">

      <div className="absolute top-6 left-6">
        <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-[#0B192C] flex items-center gap-1 transition">
          ← Voltar ao site
        </Link>
      </div>

      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-lg border border-slate-200">

        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <span className="text-3xl font-extrabold tracking-wider text-[#00D4FF]">R&R</span>
            <span className="text-2xl font-bold text-[#0B192C]">Services</span>
          </Link>
          <p className="text-sm text-slate-500 mt-2">Aceda à sua área reservada ou ao painel de gestão</p>
        </div>

        {erro && mode === 'login' && (
          <div className="mb-6 p-3 text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-center">
            {erro}
          </div>
        )}
        {recoveryError && <div role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700">{recoveryError}</div>}

        {mode === 'login' && <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
              E-mail ou telemóvel
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              placeholder="email@exemplo.pt ou 912 345 678"
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
          <button type="button" onClick={() => { setMode('recover'); setRecoveryEmail(email.includes('@') ? email : ''); setRecoveryError(''); setRecoverySent(false); }} className="min-h-11 w-full text-sm font-semibold text-sky-700 hover:text-sky-900 hover:underline">Esqueceu-se da palavra-passe?</button>
        </form>}

        {mode === 'recover' && <form onSubmit={requestPasswordRecovery} className="space-y-5">
          <div><h2 className="text-lg font-extrabold">Recuperar palavra-passe</h2><p className="mt-1 text-sm leading-5 text-slate-500">Enviaremos um link para o e-mail associado à sua conta.</p><p className="mt-2 text-xs leading-5 text-slate-500">A recuperação por e-mail requer um endereço real e acessível associado à conta. Se a sua conta foi criada apenas com telemóvel, entre com o telemóvel e atualize primeiro o e-mail em O meu perfil.</p></div>
          <label className="block text-xs font-bold uppercase text-slate-700">E-mail<input type="email" required autoComplete="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-[#00D4FF] focus:outline-none focus:ring-1 focus:ring-[#00D4FF]" /></label>
          {recoverySent && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Se o endereço estiver associado a uma conta, receberá um link de recuperação.</p>}
          <button type="submit" disabled={recoveryBusy} className="min-h-12 w-full rounded-xl bg-[#0B192C] px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">{recoveryBusy ? 'A enviar...' : 'Enviar link de recuperação'}</button>
          <button type="button" onClick={() => { setMode('login'); setRecoveryError(''); }} className="min-h-11 w-full text-sm font-semibold text-slate-600 hover:text-[#0B192C]">Voltar ao início de sessão</button>
        </form>}

        {mode === 'reset' && <form onSubmit={saveRecoveredPassword} className="space-y-5">
          <div><h2 className="text-lg font-extrabold">Definir nova palavra-passe</h2><p className="mt-1 text-sm leading-5 text-slate-500">Escolha uma palavra-passe com pelo menos 12 caracteres.</p></div>
          <label className="block text-xs font-bold uppercase text-slate-700">Nova palavra-passe<input type="password" required minLength={12} autoComplete="new-password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-[#00D4FF] focus:outline-none focus:ring-1 focus:ring-[#00D4FF]" /></label>
          <label className="block text-xs font-bold uppercase text-slate-700">Confirmar nova palavra-passe<input type="password" required minLength={12} autoComplete="new-password" value={confirmResetPassword} onChange={(event) => setConfirmResetPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-[#00D4FF] focus:outline-none focus:ring-1 focus:ring-[#00D4FF]" /></label>
          <button type="submit" disabled={!resetAuthorized || resetBusy} className="min-h-12 w-full rounded-xl bg-[#0B192C] px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">{resetBusy ? 'A guardar...' : 'Guardar nova palavra-passe'}</button>
        </form>}

        {mode === 'login' && <div className="mt-6 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 text-center">
          <p className="font-semibold text-[#0B192C]">Acesso de Administrador R&R</p>
          <p className="text-slate-500 mt-0.5">Autenticação oficial ligada ao Supabase.</p>
        </div>}

      </div>
    </div>
  );
}
