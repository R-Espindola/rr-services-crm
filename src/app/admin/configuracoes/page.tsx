'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function BusinessContextPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);

  const [companyName, setCompanyName] = useState('R&R Services');
  const [tagline, setTagline] = useState('Serviços profissionais de limpeza em Portugal');
  const [serviceRegion, setServiceRegion] = useState('Setúbal, Lisboa e arredores');
  const [differential, setDifferential] = useState('Rigor, confiança e atenção ao detalhe.');
  const [aiToneOfVoice, setAiToneOfVoice] = useState('Profissional, empático, claro e focado em conversão.');

  useEffect(() => {
    fetchContext();
  }, []);

  async function fetchContext() {
    setLoading(true);
    const { data, error } = await supabase.from('business_context').select('*').limit(1).single();
    if (data && !error) {
      setCompanyName(data.company_name || 'R&R Services');
      setTagline(data.tagline || '');
      setServiceRegion(data.service_region || '');
      setDifferential(data.differential || '');
      setAiToneOfVoice(data.ai_tone_of_voice || '');
    }
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    // Verificar se já existe registo
    const { data: existing } = await supabase.from('business_context').select('id').limit(1).single();

    let error;
    if (existing) {
      const res = await supabase.from('business_context').update({
        company_name: companyName,
        tagline,
        service_region: serviceRegion,
        differential,
        ai_tone_of_voice: aiToneOfVoice,
        updated_at: new Date().toISOString()
      }).eq('id', existing.id);
      error = res.error;
    } else {
      const res = await supabase.from('business_context').insert([{
        company_name: companyName,
        tagline,
        service_region: serviceRegion,
        differential,
        ai_tone_of_voice: aiToneOfVoice
      }]);
      error = res.error;
    }

    if (error) {
      setFeedback({ message: 'Erro ao guardar o contexto: ' + error.message, error: true });
    } else {
      setFeedback({ message: 'Contexto do negócio atualizado com sucesso!', error: false });
    }
    setSubmitting(false);
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">A carregar contexto do negócio...</div>;
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 text-[#0B192C] p-4 sm:p-6 md:p-8">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Item 01 · Estratégia</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B192C] mt-1">Contexto do Negócio</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Defina as informações centrais da R&R Services para alimentar as automações e a inteligência artificial.</p>
        </div>

        {feedback && (
          <p className={`rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
            {feedback.message}
          </p>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Nome da Empresa</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Slogan / Proposta de Valor</label>
            <input
              type="text"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Zonas de Atuação (Geografia)</label>
            <input
              type="text"
              value={serviceRegion}
              onChange={e => setServiceRegion(e.target.value)}
              placeholder="Ex: Setúbal, Almada, Lisboa..."
              className="w-full px-4 py-3 border rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#00D4FF]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Diferenciais Competitivos</label>
            <textarea
              value={differential}
              onChange={e => setDifferential(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl text-sm bg-slate-50 h-24 outline-none focus:ring-2 focus:ring-[#00D4FF]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Tom de Voz da IA (Atendimento / Marketing)</label>
            <textarea
              value={aiToneOfVoice}
              onChange={e => setAiToneOfVoice(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl text-sm bg-slate-50 h-24 outline-none focus:ring-2 focus:ring-[#00D4FF]"
            />
          </div>

          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-[#0B192C] text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'A guardar...' : 'Guardar Contexto'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}