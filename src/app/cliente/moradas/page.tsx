"use client";

import { useEffect, useState } from "react";
import { guardarMorada, eliminarMorada } from "../actions";
import { supabase } from "@/lib/supabase";

type Property = {
  id: string;
  label: string;
  street_address: string;
  postal_code: string;
  city: string;
  reference_notes: string;
  access_instructions: string;
  cleaning_notes: string;
  company_provides_supplies: boolean;
};

const emptyForm = {
  label: "",
  streetAddress: "",
  postalCode: "",
  city: "",
  referenceNotes: "",
  accessInstructions: "",
  cleaningNotes: "",
  companyProvidesSupplies: true,
};

export default function MoradasPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadProperties() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("A sua sessão terminou. Inicie sessão novamente.");
      setLoading(false);
      return;
    }
    const { data: client } = await supabase.from("clients").select("id").eq("auth_user_id", user.id).single();
    if (!client) {
      setMessage("Perfil de cliente não encontrado.");
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from("properties").select("*").eq("client_id", client.id).eq("is_active", true).order("created_at", { ascending: true });
    setProperties((data ?? []) as Property[]);
    if (error) setMessage("Não foi possível carregar as moradas.");
    setLoading(false);
  }

  useEffect(() => {
    void loadProperties();
  }, []);

  function editProperty(property: Property) {
    setEditingId(property.id);
    setForm({
      label: property.label,
      streetAddress: property.street_address,
      postalCode: property.postal_code,
      city: property.city,
      referenceNotes: property.reference_notes,
      accessInstructions: property.access_instructions,
      cleaningNotes: property.cleaning_notes,
      companyProvidesSupplies: property.company_provides_supplies,
    });
    setMessage("");
  }

  function resetForm() {
    setEditingId(undefined);
    setForm(emptyForm);
  }

  function updateField(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const result = await guardarMorada({ ...form, id: editingId });
    setSaving(false);
    if (!result.success) {
      setMessage(result.error);
      return;
    }
    setMessage("Morada guardada com sucesso.");
    resetForm();
    await loadProperties();
  }

  async function archiveProperty(id: string) {
    if (!window.confirm("Pretende arquivar esta morada?")) return;
    const result = await eliminarMorada(id);
    setMessage(result.success ? "Morada arquivada." : result.error);
    if (result.success) await loadProperties();
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/60 sm:p-8">
        <span className="inline-flex rounded-full bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-sky-800">Dados de acesso</span>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-[#0B192C]">As minhas moradas</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Guarde as casas, escritórios ou alojamentos locais onde a R&R Services presta serviços. Estas instruções ajudam a equipa a preparar cada visita.</p>
      </section>

      {message && <p role="status" className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-semibold text-cyan-900">{message}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-[#0B192C]">{editingId ? "Editar morada" : "Adicionar morada"}</h2>
            {editingId && <button type="button" onClick={resetForm} className="text-xs font-bold text-slate-500 hover:text-slate-800">Cancelar edição</button>}
          </div>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Identificação" value={form.label} placeholder="Casa Principal, AL..." onChange={(value) => updateField("label", value)} required />
            <Field label="Morada" value={form.streetAddress} placeholder="Rua, número e andar" onChange={(value) => updateField("streetAddress", value)} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Código postal" value={form.postalCode} placeholder="0000-000" pattern="\d{4}-\d{3}" onChange={(value) => updateField("postalCode", value)} required />
              <Field label="Localidade" value={form.city} placeholder="Setúbal" onChange={(value) => updateField("city", value)} required />
            </div>
            <TextArea label="Referências de localização" value={form.referenceNotes} placeholder="Ex.: entrada junto ao café..." onChange={(value) => updateField("referenceNotes", value)} />
            <TextArea label="Acesso, chaves, códigos ou animais" value={form.accessInstructions} placeholder="Instruções para a equipa..." onChange={(value) => updateField("accessInstructions", value)} />
            <TextArea label="Cuidados de limpeza" value={form.cleaningNotes} placeholder="Superfícies, materiais ou produtos a evitar..." onChange={(value) => updateField("cleaningNotes", value)} />
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <input type="checkbox" checked={form.companyProvidesSupplies} onChange={(event) => updateField("companyProvidesSupplies", event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#00D4FF]" />
              <span><span className="block text-sm font-bold text-[#0B192C]">A R&R Services leva produtos e equipamentos</span><span className="mt-1 block text-xs leading-5 text-slate-500">Desmarque se pretende utilizar os produtos disponíveis no imóvel.</span></span>
            </label>
            <button type="submit" disabled={saving} className="min-h-11 w-full rounded-xl bg-[#0B192C] px-4 py-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50">{saving ? "A guardar..." : editingId ? "Guardar alterações" : "Adicionar morada"}</button>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-black text-[#0B192C]">Moradas guardadas</h2>
          {loading ? <div className="rounded-3xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">A carregar moradas...</div> : properties.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Ainda não tem moradas guardadas.</div> : properties.map((property) => (
            <article key={property.id} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 transition hover:border-cyan-200 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">{property.label}</span><h3 className="mt-3 font-black text-[#0B192C]">{property.street_address}</h3><p className="mt-1 text-sm text-slate-500">{property.postal_code}, {property.city}</p></div>
                <button type="button" onClick={() => editProperty(property)} className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Editar</button>
              </div>
              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-xs text-slate-600 sm:grid-cols-2">
                <p><strong className="text-slate-800">Acesso:</strong> {property.access_instructions || "Sem instruções registadas."}</p>
                <p><strong className="text-slate-800">Produtos:</strong> {property.company_provides_supplies ? "Levados pela R&R Services" : "Disponíveis no imóvel"}</p>
              </div>
              <button type="button" onClick={() => archiveProperty(property.id)} className="mt-4 text-xs font-bold text-rose-600 hover:underline">Arquivar morada</button>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, placeholder, pattern, onChange, required }: { label: string; value: string; placeholder: string; pattern?: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="block text-xs font-bold text-slate-700">{label}{required ? " *" : ""}<input required={required} pattern={pattern} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm font-normal text-[#0B192C] outline-none transition focus:border-[#00D4FF] focus:ring-2 focus:ring-cyan-500/20" /></label>;
}

function TextArea({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-bold text-slate-700">{label}<textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm font-normal text-[#0B192C] outline-none transition focus:border-[#00D4FF] focus:ring-2 focus:ring-cyan-500/20" /></label>;
}

