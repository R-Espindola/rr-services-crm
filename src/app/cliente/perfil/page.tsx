"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

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

const fieldClass = "mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0B192C] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10";
const labelClass = "text-xs font-extrabold uppercase tracking-[0.12em] text-slate-600";

export default function ClientProfilePage() {
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("A sua sessão terminou. Inicie sessão novamente.");
        const { data, error: profileError } = await supabase.from("clients")
          .select("name, phone, email, address, postal_code, locality, birth_date")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (profileError || !data) throw new Error("Não foi possível encontrar o perfil associado à sua conta.");
        if (active) {
          setUserId(user.id);
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

  return (
    <main className="min-h-dvh px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
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
      </div>
    </main>
  );
}
