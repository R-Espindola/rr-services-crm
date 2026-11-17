'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowDown, CheckCircle2, LogIn, Menu, Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Estados do formulário de captura de leads da Landing Page
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [serviceType, setServiceType] = useState('Limpeza Residencial');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      // 1. Regista o cliente na tabela clients
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert([{ name, phone, address }])
        .select('id')
        .single();

      if (clientError) throw clientError;

      // 2. Cria automaticamente uma ordem/lead na tabela orders para o CRM do admin
      if (clientData) {
        await supabase.from('orders').insert([{
          client_id: clientData.id,
          service_type: serviceType,
          scheduled_date: new Date(Date.now() + 86400000).toISOString(), // Amanhã por defeito
          total_amount: 60.00,
          status: 'pending',
          notes: 'Lead gerada via Landing Page da página principal'
        }]);
      }

      setSuccess(true);
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'Erro desconhecido.';
      alert(`Erro ao enviar pedido: ${message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8fb] text-[#0B192C] font-sans scroll-smooth">
      
      {/* 1. CABEÇALHO / NAVBAR */}
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#061326]/90 text-white backdrop-blur-md">
        <div className="relative mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#00D4FF] text-base font-black tracking-tight text-[#0B192C] shadow-lg shadow-cyan-500/20">R&R</span>
            <span className="text-lg font-semibold tracking-tight text-slate-100">Services</span>
          </Link>
        </div>

        {/* Links Desktop */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 text-[13px] font-medium text-slate-300 lg:flex">
          <a href="#servicos" className="transition hover:text-[#00D4FF]">Serviços</a>
          <a href="#como-funciona" className="transition hover:text-[#00D4FF]">Como Funciona</a>
          <a href="#extras" className="transition hover:text-[#00D4FF]">Extras</a>
          <Link href="/login?next=%2Fcliente&force=1" className="transition hover:text-[#00D4FF]">Portal do Cliente</Link>
        </nav>

        {/* Botões Ação Header */}
        <div className="hidden items-center gap-2 lg:flex">
          <a href="#orcamento" className="inline-flex items-center rounded-xl bg-[#00D4FF] px-4 py-2.5 text-xs font-black text-[#061121] shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300">Pedir Orçamento / Agendar</a>
          <Link
            href="/login?next=%2Fcliente&force=1"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15"
          >
            <LogIn className="h-4 w-4" />Área do Cliente
          </Link>
        </div>

        {/* Botão Menu Mobile */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-slate-200 hover:text-white focus:outline-none lg:hidden"
          aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
        </div>
      </header>

      {/* Menu Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="flex flex-col space-y-4 border-b border-slate-800 bg-[#0B192C] px-6 py-4 text-sm font-medium text-slate-200 lg:hidden">
          <a href="#servicos" onClick={() => setMobileMenuOpen(false)}>Serviços</a>
          <a href="#como-funciona" onClick={() => setMobileMenuOpen(false)}>Como Funciona</a>
          <a href="#extras" onClick={() => setMobileMenuOpen(false)}>Extras</a>
          <a href="#orcamento" onClick={() => setMobileMenuOpen(false)} className="rounded-xl bg-[#00D4FF] px-4 py-3 text-center font-black text-[#061121]">Pedir Orçamento / Agendar</a>
          <Link
            href="/login?next=%2Fcliente&force=1"
            onClick={() => setMobileMenuOpen(false)}
            className="text-center font-semibold bg-white/10 border border-white/15 text-white py-2.5 rounded-xl"
          >
            Área do Cliente
          </Link>
        </div>
      )}

      {/* 2. SECÇÃO PRINCIPAL (HERO + FORMULÁRIO DE CAPTURA) */}
      <section className="relative isolate overflow-hidden border-b border-white/[0.06] bg-[linear-gradient(125deg,#071321_0%,#0a1b30_55%,#0b2136_100%)] py-14 text-white md:py-20 lg:py-24">
        <div className="pointer-events-none absolute -right-32 -top-44 h-[32rem] w-[32rem] rounded-full bg-cyan-400/[0.07] blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8">
          <div className="max-w-3xl space-y-6 lg:col-span-7 md:space-y-7">
            <div className="inline-flex items-center gap-2.5 bg-white/[0.035] text-slate-200 px-3.5 py-2 rounded-full text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] border border-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00D4FF]" /> Serviços profissionais de limpeza em Portugal
            </div>
            
            <h1 className="max-w-xl text-[2.5rem] font-bold leading-[1.06] tracking-[-0.045em] text-white sm:text-[2.9rem] md:text-5xl lg:text-[3.65rem]">
              <span className="block">O seu espaço</span>
              <span className="block">merece um <span className="text-[#00D4FF]">cuidado</span></span>
              <span className="block text-[#00D4FF]">ao detalhe.</span>
            </h1>

            <p className="text-[15px] md:text-base text-slate-300/90 leading-7 max-w-xl">
              Limpeza residencial, profunda, pós-obra e higienização de estofos com profissionalismo, transparência e atenção a cada detalhe.
            </p>

            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-200">
              <span className="tracking-[0.12em] text-amber-300">★★★★★</span>
              <span>Confiança de clientes em Portugal</span>
              <span className="h-1 w-1 rounded-full bg-cyan-400" />
              <span>Resposta rápida e acompanhamento digital</span>
            </div>

            <div className="space-y-2.5 pt-1 text-xs font-medium text-slate-300/90">
              <span className="flex items-center gap-2.5"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#00D4FF]" aria-hidden="true" />Equipamentos e produtos profissionais incluídos</span>
              <span className="flex items-center gap-2.5"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#00D4FF]" aria-hidden="true" />Orçamento rápido e transparente em 15 min</span>
              <span className="flex items-center gap-2.5"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#00D4FF]" aria-hidden="true" />Acompanhamento e checklist digital de cada limpeza</span>
            </div>

            <a href="#servicos" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200 transition hover:text-[#00D4FF]">
              Explorar serviços <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          {/* FORMULÁRIO DE CAPTURA DIRETA DE LEADS */}
          <div className="relative lg:col-span-5">
            <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[3rem] bg-cyan-500/10 blur-3xl" aria-hidden="true" />
            <div id="orcamento" className="scroll-mt-28 relative rounded-[1.6rem] border border-white/80 bg-white p-6 pt-14 text-[#0B192C] shadow-[0_22px_60px_-30px_rgba(0,0,0,0.5)] sm:p-7 sm:pt-14">
            <div className="mb-5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-800">Sem compromisso</p>
              <span className="shrink-0 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
                Resposta em 15 min
              </span>
            </div>

            <div className="mb-5">
              <h2 className="text-[1.4rem] sm:text-2xl font-bold tracking-tight text-[#0B192C] mb-2">Peça o seu orçamento</h2>
              <p className="text-slate-500 text-sm">Deixe os seus dados. A nossa equipa trata do resto.</p>
            </div>

            {success ? (
              <div className="bg-emerald-950 border border-emerald-500/50 p-6 rounded-2xl text-center space-y-3">
                <span className="text-3xl">🎉</span>
                <h3 className="text-base font-bold text-emerald-300">Pedido enviado com sucesso!</h3>
                <p className="text-xs text-emerald-400">Obrigado! O seu pedido foi registado no sistema e entraremos em contacto brevemente.</p>
                <button 
                  onClick={() => setSuccess(false)}
                  className="mt-4 text-xs bg-slate-800 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-700 transition cursor-pointer"
                >
                  Fazer outro pedido
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1.5">Nome completo *</label>
                  <input 
                    type="text" 
                    required 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="O seu nome" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] placeholder:text-slate-400 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1.5">Telemóvel *</label>
                  <input 
                    type="text" 
                    required 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    placeholder="912 345 678" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] placeholder:text-slate-400 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1.5">Tipo de serviço *</label>
                  <select 
                    value={serviceType} 
                    onChange={e => setServiceType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  >
                    <option value="Limpeza Residencial">Limpeza Residencial</option>
                    <option value="Limpeza Comercial / Escritórios">Limpeza Comercial / Escritórios</option>
                    <option value="Limpeza Profunda / Pós-Obra">Limpeza Profunda / Pós-Obra</option>
                    <option value="Higienização de Estofados">Higienização de Estofados</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1.5">Morada / localidade</label>
                  <input 
                    type="text" 
                    value={address} 
                    onChange={e => setAddress(e.target.value)} 
                    placeholder="Ex: Setúbal ou Lisboa" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] placeholder:text-slate-400 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={submitting}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00C2FF] py-3.5 text-sm font-extrabold text-[#061326] shadow-lg shadow-cyan-700/15 transition hover:bg-[#06B6D4] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'A enviar pedido...' : 'Solicitar Orçamento Agora'}
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Orçamento gratuito</span>
                  <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-cyan-600" />Equipamentos e produtos incluídos</span>
                  <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-cyan-600" />Faturação com NIF</span>
                </div>
              </form>
            )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. SERVIÇOS PRINCIPAIS */}
      <section id="servicos" className="scroll-mt-20 bg-[#f5f8fb] px-0 py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700 mb-3">O que fazemos</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#0B192C] mb-4">Um serviço para cada espaço</h2>
            <p className="text-slate-600 leading-relaxed">Soluções completas e adaptadas às necessidades do seu lar ou empresa.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Cartão 1 */}
            <div className="group bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 transition duration-300 flex flex-col justify-between">
              <div>
                <Image
                  src="https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80"
                  alt="Limpeza residencial regular"
                  width={800}
                  height={520}
                  unoptimized
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="w-full h-52 object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="p-6 pt-5">
                  <h3 className="text-xl font-bold text-[#0B192C] mb-2">Limpeza Residencial Regular</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Manutenção periódica para manter a sua casa limpa, organizada e agradável semanalmente ou quinzenalmente.
                  </p>
                </div>
              </div>
              <div className="p-6 pt-0">
                <a href="#orcamento" className="block text-center w-full py-3 rounded-xl bg-slate-50 border border-slate-200 text-[#0B192C] font-bold text-sm hover:bg-[#0B192C] hover:text-white hover:border-[#0B192C] transition">
                  Pedir Orçamento
                </a>
              </div>
            </div>

            {/* Cartão 2 */}
            <div className="group bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 transition duration-300 flex flex-col justify-between">
              <div>
                <Image
                  src="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80"
                  alt="Limpeza profunda"
                  width={800}
                  height={520}
                  unoptimized
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="w-full h-52 object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="p-6 pt-5">
                  <h3 className="text-xl font-bold text-[#0B192C] mb-2">Limpeza Profunda</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Higienização minuciosa de rodapés, azulejos, eletrodomésticos e áreas de difícil acesso.
                  </p>
                </div>
              </div>
              <div className="p-6 pt-0">
                <a href="#orcamento" className="block text-center w-full py-3 rounded-xl bg-slate-50 border border-slate-200 text-[#0B192C] font-bold text-sm hover:bg-[#0B192C] hover:text-white hover:border-[#0B192C] transition">
                  Pedir Orçamento
                </a>
              </div>
            </div>

            {/* Cartão 3 */}
            <div className="group bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 transition duration-300 flex flex-col justify-between">
              <div>
                <Image
                  src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80"
                  alt="Limpeza pós-obra"
                  width={800}
                  height={520}
                  unoptimized
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="w-full h-52 object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="p-6 pt-5">
                  <h3 className="text-xl font-bold text-[#0B192C] mb-2">Limpeza Pós-Obra</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Remoção eficaz de resíduos, tintas, poeiras e restos de materiais para deixar o imóvel pronto a habitar.
                  </p>
                </div>
              </div>
              <div className="p-6 pt-0">
                <a href="#orcamento" className="block text-center w-full py-3 rounded-xl bg-slate-50 border border-slate-200 text-[#0B192C] font-bold text-sm hover:bg-[#0B192C] hover:text-white hover:border-[#0B192C] transition">
                  Pedir Orçamento
                </a>
              </div>
            </div>

            {/* Cartão 4 */}
            <div className="group bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 transition duration-300 flex flex-col justify-between">
              <div>
                <Image
                  src="https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=800&q=80"
                  alt="Higienização de estofos"
                  width={800}
                  height={520}
                  unoptimized
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="w-full h-52 object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="p-6 pt-5">
                  <h3 className="text-xl font-bold text-[#0B192C] mb-2">Higienização de Sofás e Estofos</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Limpeza a fundo de sofás, colchões, cadeiras e tapetes com eliminação de nódoas, ácaros e odores.
                  </p>
                </div>
              </div>
              <div className="p-6 pt-0">
                <a href="#orcamento" className="block text-center w-full py-3 rounded-xl bg-slate-50 border border-slate-200 text-[#0B192C] font-bold text-sm hover:bg-[#0B192C] hover:text-white hover:border-[#0B192C] transition">
                  Pedir Orçamento
                </a>
              </div>
            </div>

            {/* Cartão 5 */}
            <div className="group bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 transition duration-300 flex flex-col justify-between md:col-span-2 lg:col-span-1">
              <div>
                <Image
                  src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80"
                  alt="Limpeza de espaços comerciais"
                  width={800}
                  height={520}
                  unoptimized
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="w-full h-52 object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="p-6 pt-5">
                  <h3 className="text-xl font-bold text-[#0B192C] mb-2">Espaços Comerciais e Escritórios</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Manutenção de instalações empresariais, lojas e escritórios garantindo um ambiente profissional e higienizado.
                  </p>
                </div>
              </div>
              <div className="p-6 pt-0">
                <a href="#orcamento" className="block text-center w-full py-3 rounded-xl bg-slate-50 border border-slate-200 text-[#0B192C] font-bold text-sm hover:bg-[#0B192C] hover:text-white hover:border-[#0B192C] transition">
                  Pedir Orçamento
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. EXTRAS POPULARES */}
      <section id="extras" className="scroll-mt-20 border-t border-slate-200/80 bg-[#F4F7FB] px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Detalhes que fazem a diferença</p>
              <h2 className="text-3xl font-extrabold tracking-tight text-[#061121] md:text-4xl">Extras populares</h2>
            </div>
            <a href="#orcamento" className="text-sm font-bold text-cyan-700 transition hover:text-[#061121]">Personalizar orçamento →</a>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
            {[
              ['Frigorífico', 'Interior higienizado e organizado'],
              ['Forno', 'Remoção de gordura e resíduos'],
              ['Vidros / Estores', 'Mais luz e acabamento cuidado'],
              ['Tratamento com Ozono', 'Neutralização de odores'],
            ].map(([title, description]) => (
              <a key={title} href="#orcamento" className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-xl sm:p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-lg text-cyan-700 transition group-hover:bg-[#00D4FF]">✦</span>
                <h3 className="mt-4 text-sm font-extrabold text-[#061121] sm:text-base">{title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">{description}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 5. COMO FUNCIONA */}
      <section id="como-funciona" className="scroll-mt-20 py-20 md:py-24 px-5 md:px-10 lg:px-12 bg-white border-t border-slate-200/80">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700 mb-3">Simples e transparente</p>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#0B192C] mb-12">Como funciona a contratação</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#f7fafc] p-8 rounded-3xl border border-slate-200/80 shadow-sm relative">
              <div className="w-12 h-12 bg-[#00D4FF] text-[#0B192C] font-extrabold rounded-xl flex items-center justify-center mx-auto mb-6 text-xl">
                1
              </div>
                <h3 className="font-bold text-lg mb-2">Escolha o serviço e a morada</h3>
              <p className="text-slate-600 text-sm">Indique o tipo de limpeza, a localização e as necessidades do seu espaço.</p>
            </div>

            <div className="bg-[#f7fafc] p-8 rounded-3xl border border-slate-200/80 shadow-sm relative">
              <div className="w-12 h-12 bg-[#00D4FF] text-[#0B192C] font-extrabold rounded-xl flex items-center justify-center mx-auto mb-6 text-xl">
                2
              </div>
                <h3 className="font-bold text-lg mb-2">Acompanhe a equipa</h3>
              <p className="text-slate-600 text-sm">Receba a confirmação e acompanhe o estado da intervenção em tempo real.</p>
            </div>

            <div className="bg-[#f7fafc] p-8 rounded-3xl border border-slate-200/80 shadow-sm relative">
              <div className="w-12 h-12 bg-[#00D4FF] text-[#0B192C] font-extrabold rounded-xl flex items-center justify-center mx-auto mb-6 text-xl">
                3
              </div>
                <h3 className="font-bold text-lg mb-2">Avalie e descarregue a fatura</h3>
              <p className="text-slate-600 text-sm">Consulte a checklist, avalie o serviço e aceda à sua faturação com NIF.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. PERGUNTAS FREQUENTES (FAQ) */}
      <section id="faq" className="scroll-mt-20 py-20 md:py-24 px-5 md:px-10 lg:px-12 bg-[#f5f8fb] border-t border-slate-200/80">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700 text-center mb-3">Estamos aqui para ajudar</p>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-center text-[#0B192C] mb-12">Perguntas frequentes</h2>
          <div className="space-y-6">
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm">
              <h3 className="font-bold text-lg text-[#0B192C] mb-2">É necessário fornecer os produtos e utensílios de limpeza?</h3>
              <p className="text-slate-600 text-sm">A equipa R&R Services pode levar todos os produtos e equipamentos profissionais necessários para a execução do serviço, garantindo a máxima eficácia.</p>
            </div>
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm">
              <h3 className="font-bold text-lg text-[#0B192C] mb-2">Como posso acompanhar as minhas marcações e orçamentos?</h3>
              <p className="text-slate-600 text-sm">Basta aceder à <Link href="/login?next=%2Fcliente&force=1" className="text-[#00D4FF] font-semibold underline">Área do Cliente</Link> para consultar o histórico, ver o estado das suas solicitações e gerir os serviços.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. RODAPÉ */}
      <footer id="contactos" className="bg-[#0B192C] text-white py-12 px-6 md:px-12 border-t border-slate-800">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl font-bold text-[#00D4FF]">R&R</span>
              <span className="text-lg font-medium text-slate-200">Services</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Excelência, rigor e transparência na prestação de serviços de limpeza e manutenção.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-sm text-[#00D4FF] uppercase tracking-wider mb-4">Navegação</h4>
            <ul className="space-y-2 text-sm text-slate-300">
              <li><a href="#servicos" className="hover:text-white transition">Serviços</a></li>
              <li><a href="#orcamento" className="hover:text-white transition">Pedir Orçamento</a></li>
              <li><Link href="/login?next=%2Fcliente&force=1" className="hover:text-white transition">Portal do Cliente</Link></li>
              <li><a href="/privacidade" className="hover:text-white transition">Política de Privacidade</a></li>
              <li><a href="/termos" className="hover:text-white transition">Termos e Condições</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm text-[#00D4FF] uppercase tracking-wider mb-4">Área de Atendimento</h4>
            <p className="text-slate-300 text-sm mb-2">Portugal (Setúbal, Lisboa e Regiões Metropolitanas)</p>
            <p className="text-xs text-slate-400">Fuso horário: Europe/Lisbon | Moeda: € (EUR)</p>
            <a href="https://www.livroreclamacoes.pt" target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-slate-300 transition hover:text-[#00D4FF]">Livro de Reclamações Eletrónico →</a>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} R&R Services. Todos os direitos reservados.
        </div>
      </footer>

    </div>
  );
}
