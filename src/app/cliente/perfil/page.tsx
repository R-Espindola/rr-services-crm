"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { CLIENT_THEMES, saveClientTheme, useClientTheme } from "../client-theme";
import { eliminarConta, exportarDadosCliente } from "../actions";

type ProfileForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  postal_code: string;
  locality: string;
  birth_date: string;
};

const emptyProfile: ProfileForm = {
  name: "", phone: "", email: "", address: "", postal_code: "", locality: "", birth_date: "",
};

const fieldClass = "mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0B192C] outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10";
const labelClass = "text-xs font-extrabold uppercase tracking-[0.12em] text-slate-600";

export default function ClientProfilePage() {
  const activeTheme = useClientTheme();
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [newLoginEmail, setNewLoginEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityBusy, setSecurityBusy] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [securitySuccess, setSecuritySuccess] = useState("");
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("A sua sessão terminou. Inicie sessão novamente.");
        if (new URLSearchParams(window.location.search).get("emailUpdated") === "1") {
          setSecuritySuccess("E-mail de acesso confirmado e atualizado.");
        }
        const { data, error: profileError } = await supabase.from("clients")
          .select("name, phone, email, address, postal_code, locality, birth_date")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (profileError || !data) throw new Error("Não foi possível encontrar o perfil associado à sua conta.");
        if (active) {
          setUserId(user.id);
          setLoginEmail(user.email ?? "");
          setForm({
            name: data.name ?? "", phone: data.phone ?? "", email: data.email ?? user.email ?? "",
            address: data.address ?? "", postal_code: data.postal_code ?? "", locality: data.locality ?? "",
            birth_date: data.birth_date ?? "",
          });
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o perfil.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProfile();
    return () => { active = false; };
  }, []);

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess("");
    setError("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    if (form.birth_date && form.birth_date > new Date().toISOString().slice(0, 10)) {
      setError("A data de nascimento não pode ser futura.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { data, error: updateError } = await supabase.from("clients").update({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim().toLowerCase(),
        address: form.address.trim() || null,
        postal_code: form.postal_code.trim() || null,
        locality: form.locality.trim() || null,
        birth_date: form.birth_date || null,
      }).eq("auth_user_id", userId)
        .select("name, phone, email, address, postal_code, locality, birth_date")
        .single();
      if (updateError || !data) throw updateError ?? new Error("Não foi possível guardar as alterações.");
      setForm({
        name: data.name ?? "", phone: data.phone ?? "", email: data.email ?? "", address: data.address ?? "",
        postal_code: data.postal_code ?? "", locality: data.locality ?? "", birth_date: data.birth_date ?? "",
      });
      setSuccess("Perfil atualizado com sucesso.");
    } catch {
      setError("Não foi possível guardar o perfil. Confirme os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function updateLoginEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = newLoginEmail.trim().toLowerCase();
    if (!email || email === loginEmail.toLowerCase()) {
      setSecurityError("Introduza um e-mail diferente do e-mail de acesso atual.");
      return;
    }
    setSecurityBusy(true);
    setSecurityError("");
    setSecuritySuccess("");
    try {
      const emailRedirectTo = `${window.location.origin}/auth/callback?flow=email-change`;
      const { error: updateError } = await supabase.auth.updateUser({ email }, { emailRedirectTo });
      if (updateError) throw updateError;
      setNewLoginEmail("");
      setSecuritySuccess("Pedido enviado. Confirme a alteração através do link enviado pelo Supabase antes de usar o novo e-mail para iniciar sessão.");
    } catch {
      setSecurityError("Não foi possível atualizar o e-mail de acesso. Verifique o endereço e tente novamente.");
    } finally {
      setSecurityBusy(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 12) {
      setSecurityError("A nova palavra-passe deve ter pelo menos 12 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityError("As palavras-passe não coincidem.");
      return;
    }
    setSecurityBusy(true);
    setSecurityError("");
    setSecuritySuccess("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword("");
      setConfirmPassword("");
      setSecuritySuccess("Palavra-passe alterada com sucesso.");
    } catch {
      setSecurityError("Não foi possível alterar a palavra-passe. Inicie sessão novamente e tente outra vez.");
    } finally {
      setSecurityBusy(false);
    }
  }

  async function exportData() {
    setPrivacyBusy(true);
    setPrivacyMessage("");
    const result = await exportarDadosCliente();
    if (!result.success) {
      setPrivacyMessage(result.error);
      setPrivacyBusy(false);
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dados-pessoais-rr-services.json";
    link.click();
    URL.revokeObjectURL(url);
    setPrivacyMessage("Os seus dados foram exportados.");
    setPrivacyBusy(false);
  }

  async function deleteAccount() {
    if (!window.confirm("Esta ação anonimiza os seus dados e elimina a conta de acesso. Pretende continuar?")) return;
    setPrivacyBusy(true);
    setPrivacyMessage("");
    const result = await eliminarConta();
    if (!result.success) {
      setPrivacyMessage(result.error);
      setPrivacyBusy(false);
      return;
    }
    window.location.replace("/login?deleted=1");
  }

  return (
    <main className="min-h-dvh bg-[#F4F7FB] px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sky-700">Conta do cliente</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#0B192C]">O meu perfil</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Mantenha os seus dados e a morada de serviço atualizados.</p>
        </header>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm font-medium text-slate-500">A carregar os dados do perfil...</div> : <form onSubmit={saveProfile} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <section className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
            <div className="sm:col-span-2"><h2 className="text-lg font-extrabold">Dados pessoais</h2><p className="mt-1 text-sm text-slate-500">Os dados são atualizados no seu perfil de cliente.</p></div>
            <label className={labelClass}>Nome completo<input required maxLength={160} autoComplete="name" value={form.name} onChange={(event) => updateField("name", event.target.value)} className={fieldClass} /></label>
            <label className={labelClass}>Telemóvel / telefone<input type="tel" maxLength={40} autoComplete="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} className={fieldClass} /></label>
            <label className={labelClass}>E-mail<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className={fieldClass} /><span className="mt-1.5 block text-[11px] font-medium normal-case tracking-normal text-slate-400">E-mail de contacto do perfil.</span></label>
            <label className={labelClass}>Data de nascimento <span className="font-medium normal-case tracking-normal text-slate-400">(opcional)</span><input type="date" max={new Date().toISOString().slice(0, 10)} value={form.birth_date} onChange={(event) => updateField("birth_date", event.target.value)} className={fieldClass} /><span className="mt-1.5 block text-[11px] font-medium normal-case tracking-normal text-slate-400">Para receber surpresas e descontos especiais no seu aniversário!</span></label>
            <div className="sm:col-span-2 mt-2 border-t border-slate-100 pt-5"><h2 className="text-lg font-extrabold">Morada</h2><p className="mt-1 text-sm text-slate-500">Utilizada para as suas marcações e intervenções.</p></div>
            <label className={`${labelClass} sm:col-span-2`}>Morada completa<input maxLength={240} autoComplete="street-address" value={form.address} onChange={(event) => updateField("address", event.target.value)} placeholder="Rua, número, andar e fração" className={fieldClass} /></label>
            <label className={labelClass}>Código postal<input maxLength={20} autoComplete="postal-code" value={form.postal_code} onChange={(event) => updateField("postal_code", event.target.value)} placeholder="0000-000" className={fieldClass} /></label>
            <label className={labelClass}>Localidade<input maxLength={120} autoComplete="address-level2" value={form.locality} onChange={(event) => updateField("locality", event.target.value)} className={fieldClass} /></label>
          </section>
          <footer className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div aria-live="polite" className="text-sm">{error && <p role="alert" className="font-semibold text-rose-700">{error}</p>}{success && <p role="status" className="font-semibold text-emerald-700">{success}</p>}</div>
            <button type="submit" disabled={saving || loading || !userId} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#0B192C] px-6 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{saving ? "A guardar..." : "Guardar alterações"}</button>
          </footer>
        </form>}
        {!loading && userId && <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-7">
          <div className="mb-5 border-b border-slate-100 pb-4"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-700">Segurança</p><h2 className="mt-1 text-xl font-black">Credenciais de acesso</h2><p className="mt-1 text-sm text-slate-500">Altere o e-mail usado para entrar ou defina uma nova palavra-passe.</p></div>
          <div className="grid gap-7 lg:grid-cols-2">
            <form onSubmit={updateLoginEmail} className="space-y-4">
              <div><h3 className="font-extrabold">E-mail de acesso</h3><p className="mt-1 break-all text-sm text-slate-600">Atual: {loginEmail || "Sem e-mail de acesso"}</p></div>
              <label className={labelClass}>Novo e-mail de acesso<input required type="email" maxLength={254} autoComplete="email" value={newLoginEmail} onChange={(event) => { setNewLoginEmail(event.target.value); setSecurityError(""); setSecuritySuccess(""); }} className={fieldClass} placeholder="nome@exemplo.pt" /></label>
              <button type="submit" disabled={securityBusy || !newLoginEmail.trim()} className="min-h-11 rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50">{securityBusy ? "A atualizar..." : "Alterar e-mail de acesso"}</button>
              <p className="text-xs leading-5 text-slate-500">O novo e-mail só passa a ser usado depois de confirmar a mensagem enviada pelo Supabase.</p>
              {loginEmail.endsWith("@rrservices.internal") && <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Esta conta foi criada sem e-mail pessoal. No Supabase, desative “Secure email change” para que a confirmação seja enviada apenas para o novo endereço; a confirmação do novo e-mail continua obrigatória.</p>}
            </form>
            <form onSubmit={updatePassword} className="space-y-4">
              <div><h3 className="font-extrabold">Palavra-passe</h3><p className="mt-1 text-sm text-slate-500">Use pelo menos 12 caracteres.</p></div>
              <label className={labelClass}>Nova palavra-passe<input required type="password" minLength={12} autoComplete="new-password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setSecurityError(""); setSecuritySuccess(""); }} className={fieldClass} /></label>
              <label className={labelClass}>Confirmar palavra-passe<input required type="password" minLength={12} autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setSecurityError(""); setSecuritySuccess(""); }} className={fieldClass} /></label>
              <button type="submit" disabled={securityBusy || !newPassword || !confirmPassword} className="min-h-11 rounded-2xl bg-[#0B192C] px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50">{securityBusy ? "A atualizar..." : "Alterar palavra-passe"}</button>
            </form>
          </div>
          <div aria-live="polite" className="mt-5">{securityError && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{securityError}</p>}{securitySuccess && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{securitySuccess}</p>}</div>
        </section>}
        {!loading && userId && <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-7">
          <div className="border-b border-slate-100 pb-4"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-700">Privacidade e direitos</p><h2 className="mt-1 text-xl font-black">Os seus dados</h2><p className="mt-1 text-sm leading-6 text-slate-500">Pode exportar os dados associados à sua conta ou pedir a eliminação da conta, de acordo com o RGPD.</p></div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" disabled={privacyBusy} onClick={() => void exportData()} className="min-h-11 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Exportar os meus dados</button>
            <button type="button" disabled={privacyBusy} onClick={() => void deleteAccount()} className="min-h-11 rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">Eliminar conta e dados</button>
          </div>
          {privacyMessage && <p role="status" className="mt-4 text-xs font-semibold text-slate-600">{privacyMessage}</p>}
          <p className="mt-5 text-xs text-slate-500">Consulte também a <a href="/privacidade" className="font-bold text-sky-700 underline">Política de Privacidade</a> e os <a href="/termos" className="font-bold text-sky-700 underline">Termos e Condições</a>. <a href="https://www.livroreclamacoes.pt" target="_blank" rel="noreferrer" className="font-bold text-sky-700 underline">Livro de Reclamações Eletrónico</a>.</p>
        </section>}
        {!loading && userId && <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-7">
          <div className="mb-5 border-b border-slate-100 pb-4"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-700">Personalização</p><h2 className="mt-1 text-xl font-black">Tema de cores</h2><p className="mt-1 text-sm text-slate-500">Escolha a paleta do portal. A alteração é aplicada imediatamente neste dispositivo.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {CLIENT_THEMES.map((theme) => <ThemeOption key={theme.id} theme={theme} active={theme.id === activeTheme} onSelect={() => saveClientTheme(theme.id)} />)}
          </div>
          <p aria-live="polite" className="mt-4 text-xs font-semibold text-slate-500">Tema atual: {CLIENT_THEMES.find((theme) => theme.id === activeTheme)?.name}</p>
        </section>}
      </div>
    </main>
  );
}

function ThemeOption({ theme, active, onSelect }: { theme: (typeof CLIENT_THEMES)[number]; active: boolean; onSelect: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onSelect} className={`flex min-h-24 items-center gap-4 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${active ? "border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/15" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
    <span className="flex shrink-0 -space-x-2" aria-hidden="true">{theme.colors.map((color) => <span key={color} className="h-8 w-8 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />)}</span>
    <span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-extrabold text-[#0B192C]">{theme.name}{active && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold uppercase text-emerald-800">Ativo</span>}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{theme.description}</span></span>
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${active ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 text-transparent"}`} aria-hidden="true">✓</span>
  </button>;
}
