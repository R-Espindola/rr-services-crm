"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orcamentoSubmetido, setOrcamentoSubmetido] = useState(false);
  const [carregando, setCarregando] = useState(false);

  // Estado do Form do Simulador
  const [formData, setFormData] = useState({
    tipoServico: 'residencial_regular',
    tipologia: 't2',
    frequencia: 'pontual',
    servicosAdicionais: [] as string[],
    nome: '',
    email: '',
    telefone: '',
    observacoes: ''
  });

  const handleExtraToggle = (item: string) => {
    setFormData(prev => ({
      ...prev,
      servicosAdicionais: prev.servicosAdicionais.includes(item)
        ? prev.servicosAdicionais.filter(i => i !== item)
        : [...prev.servicosAdicionais, item]
    }));
  };

  const [orcamentoReference, setOrcamentoReference] = useState<string | null>(null);
  const [orcamentoErro, setOrcamentoErro] = useState<string | null>(null);

  const handleSimularSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setOrcamentoErro(null);

    try {
      const response = await fetch('/api/orcamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.nome,
          email: formData.email,
          telefone: formData.telefone,
          tipoServico: formData.tipoServico,
          tipologia: formData.tipologia,
          frequencia: formData.frequencia,
          servicosAdicionais: formData.servicosAdicionais,
          observacoes: formData.observacoes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setOrcamentoErro(result.error || 'Erro ao submeter orçamento.');
        setCarregando(false);
        return;
      }

      setOrcamentoReference(result.reference);
      setOrcamentoSubmetido(true);
    } catch (err) {
      setOrcamentoErro('Erro de conexão ao submeter o orçamento.');
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-[#0B192C] font-sans scroll-smooth">
      
      {/* 1. CABEÇALHO / NAVBAR */}
      <header className="sticky top-0 z-50 w-full bg-[#0B192C] text-white py-4 px-6 md:px-12 shadow-lg flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-extrabold tracking-wider text-[#00D4FF]">R&R</span>
            <span className="text-lg font-semibold text-slate-100">Services</span>
          </Link>
        </div>

        {/* Links Desktop */}
        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
          <a href="#servicos" className="hover:text-[#00D4FF] transition">Serviços</a>
          <a href="#simulador" className="hover:text-[#00D4FF] transition">Simulador</a>
          <a href="#como-funciona" className="hover:text-[#00D4FF] transition">Como Funciona</a>
          <a href="#faq" className="hover:text-[#00D4FF] transition">FAQ</a>
          <a href="#contactos" className="hover:text-[#00D4FF] transition">Contactos</a>
        </nav>

        {/* Botão Acesso Área do Cliente */}
        <div className="hidden md:flex items-center space-x-4">
          <Link
            href="/login?next=%2Fcliente&force=1"
            className="text-sm font-semibold bg-[#00D4FF] text-[#0B192C] px-5 py-2.5 rounded-xl hover:bg-[#00bfe6] transition shadow-md"
          >
            Área do Cliente
          </Link>
        </div>

        {/* Botão Menu Mobile */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-slate-200 hover:text-white focus:outline-none"
          aria-label="Abrir menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* Menu Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0B192C] border-b border-slate-800 px-6 py-4 flex flex-col space-y-4 text-slate-200 font-medium text-sm">
          <a href="#servicos" onClick={() => setMobileMenuOpen(false)}>Serviços</a>
          <a href="#simulador" onClick={() => setMobileMenuOpen(false)}>Simulador</a>
          <a href="#como-funciona" onClick={() => setMobileMenuOpen(false)}>Como Funciona</a>
          <a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
          <a href="#contactos" onClick={() => setMobileMenuOpen(false)}>Contactos</a>
          <Link
            href="/login?next=%2Fcliente&force=1"
            onClick={() => setMobileMenuOpen(false)}
            className="text-center font-semibold bg-[#00D4FF] text-[#0B192C] py-2.5 rounded-xl"
          >
            Área do Cliente
          </Link>
        </div>
      )}

      {/* 2. SECÇÃO PRINCIPAL (HERO) */}
      <section className="relative bg-white py-16 md:py-24 px-6 md:px-12 border-b border-slate-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block bg-[#00D4FF]/10 text-[#0B192C] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-[#00D4FF]/30">
              Serviços Profissionais de Limpeza em Portugal
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#0B192C] leading-tight mb-6">
              O seu espaço merece um <br className="hidden sm:inline" />
              <span className="text-[#00D4FF]">cuidado ao detalhe.</span>
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-xl">
              Limpeza residencial, profunda, pós-obra e higienização de estofos com profissionalismo, transparência e atenção a cada detalhe.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#simulador"
                className="bg-[#0B192C] text-white font-semibold py-3.5 px-8 rounded-xl shadow-lg hover:bg-slate-800 transition text-center"
              >
                Pedir Orçamento
              </a>
              <a
                href="#servicos"
                className="bg-white text-[#0B192C] font-semibold py-3.5 px-8 rounded-xl border border-slate-300 hover:border-[#00D4FF] hover:text-[#00D4FF] transition text-center shadow-sm"
              >
                Conhecer os Serviços
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="w-full h-[350px] md:h-[450px] bg-slate-200 rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex items-center justify-center relative">
              {/* Imagem de Destaque */}
              <img
                src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80"
                alt="Equipa de limpeza profissional da R&R Services"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B192C]/40 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. SERVIÇOS PRINCIPAIS */}
      <section id="servicos" className="py-20 px-6 md:px-12 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0B192C] mb-4">Serviços Principais</h2>
            <p className="text-slate-600">Soluções completas e adaptadas às necessidades do seu lar ou empresa.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Cartão 1 */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col justify-between">
              <div>
                <img
                  src="https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80"
                  alt="Limpeza residencial regular"
                  className="w-full h-48 object-cover"
                />
                <div className="p-6">
                  <h3 className="text-xl font-bold text-[#0B192C] mb-2">Limpeza Residencial Regular</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Manutenção periódica para manter a sua casa limpa, organizada e agradável semanalmente ou quinzenalmente.
                  </p>
                </div>
              </div>
              <div className="p-6 pt-0">
                <a href="#simulador" className="block text-center w-full py-2.5 rounded-lg border border-[#0B192C] text-[#0B192C] font-semibold text-sm hover:bg-[#0B192C] hover:text-white transition">
                  Pedir Orçamento
                </a>
              </div>
            </div>

            {/* Cartão 2 */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col justify-between">
              <div>
                <img
                  src="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80"
                  alt="Limpeza profunda"
                  className="w-full h-48 object-cover"
                />
                <div className="p-6">
                  <h3 className="text-xl font-bold text-[#0B192C] mb-2">Limpeza Profunda</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Higienização minuciosa de rodapés, azulejos, eletrodomésticos e áreas de difícil acesso.
                  </p>
                </div>
              </div>
              <div className="p-6 pt-0">
                <a href="#simulador" className="block text-center w-full py-2.5 rounded-lg border border-[#0B192C] text-[#0B192C] font-semibold text-sm hover:bg-[#0B192C] hover:text-white transition">
                  Pedir Orçamento
                </a>
              </div>
            </div>

            {/* Cartão 3 */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col justify-between">
              <div>
                <img
                  src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80"
                  alt="Limpeza pós-obra"
                  className="w-full h-48 object-cover"
                />
                <div className="p-6">
                  <h3 className="text-xl font-bold text-[#0B192C] mb-2">Limpeza Pós-Obra</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Remoção eficaz de resíduos, tintas, poeiras e restos de materiais para deixar o imóvel pronto a habitar.
                  </p>
                </div>
              </div>
              <div className="p-6 pt-0">
                <a href="#simulador" className="block text-center w-full py-2.5 rounded-lg border border-[#0B192C] text-[#0B192C] font-semibold text-sm hover:bg-[#0B192C] hover:text-white transition">
                  Pedir Orçamento
                </a>
              </div>
            </div>

            {/* Cartão 4 */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col justify-between">
              <div>
                <img
                  src="https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=800&q=80"
                  alt="Higienização de estofos"
                  className="w-full h-48 object-cover"
                />
                <div className="p-6">
                  <h3 className="text-xl font-bold text-[#0B192C] mb-2">Higienização de Sofás e Estofos</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Limpeza a fundo de sofás, colchões, cadeiras e tapetes com eliminação de nódoas, ácaros e odores.
                  </p>
                </div>
              </div>
              <div className="p-6 pt-0">
                <a href="#simulador" className="block text-center w-full py-2.5 rounded-lg border border-[#0B192C] text-[#0B192C] font-semibold text-sm hover:bg-[#0B192C] hover:text-white transition">
                  Pedir Orçamento
                </a>
              </div>
            </div>

            {/* Cartão 5 */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col justify-between md:col-span-2 lg:col-span-1">
              <div>
                <img
                  src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80"
                  alt="Limpeza de espaços comerciais"
                  className="w-full h-48 object-cover"
                />
                <div className="p-6">
                  <h3 className="text-xl font-bold text-[#0B192C] mb-2">Espaços Comerciais e Escritórios</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Manutenção de instalações empresariais, lojas e escritórios garantindo um ambiente profissional e higienizado.
                  </p>
                </div>
              </div>
              <div className="p-6 pt-0">
                <a href="#simulador" className="block text-center w-full py-2.5 rounded-lg border border-[#0B192C] text-[#0B192C] font-semibold text-sm hover:bg-[#0B192C] hover:text-white transition">
                  Pedir Orçamento
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SIMULADOR DE ORÇAMENTO */}
      <section id="simulador" className="py-20 px-6 md:px-12 bg-white border-y border-slate-200">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[#00D4FF] font-bold text-sm uppercase tracking-wider">Simulação Rápida</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0B192C] mt-2">Simular Pedido de Orçamento</h2>
            <p className="text-slate-600 mt-2">Selecione os detalhes e receba a sua estimativa personalizada.</p>
          </div>

          {orcamentoSubmetido ? (
            <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-2xl text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                ✓
              </div>
              <h3 className="text-2xl font-bold text-emerald-900 mb-2">Pedido Recebido com Sucesso!</h3>
              {orcamentoReference && (
                <p className="text-emerald-700 mb-4">
                  Referência do orçamento: <span className="font-bold text-[#0B192C]">{orcamentoReference}</span>
                </p>
              )}
              <p className="text-emerald-700 max-w-lg mx-auto mb-6">
                Obrigado pelo seu pedido. A equipa da R&R Services irá analisar os detalhes e entrar em contacto em breve.
              </p>
              <button
                onClick={() => setOrcamentoSubmetido(false)}
                className="bg-[#0B192C] text-white px-6 py-2.5 rounded-xl font-semibold text-sm"
              >
                Fazer Nova Simulação
              </button>
            </div>
          ) : (
            <form onSubmit={handleSimularSubmit} className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tipo de Serviço */}
                <div>
                  <label className="block text-sm font-semibold text-[#0B192C] mb-2">Tipo de Serviço</label>
                  <select
                    value={formData.tipoServico}
                    onChange={(e) => setFormData({ ...formData, tipoServico: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#00D4FF]"
                  >
                    <option value="residencial_regular">Limpeza Residencial Regular</option>
                    <option value="profunda">Limpeza Profunda</option>
                    <option value="pos_obra">Limpeza Pós-Obra</option>
                    <option value="estofos">Higienização de Sofás / Estofos</option>
                    <option value="comercial">Espaço Comercial / Escritório</option>
                  </select>
                </div>

                {/* Tipologia */}
                <div>
                  <label className="block text-sm font-semibold text-[#0B192C] mb-2">Tipologia / Espaço</label>
                  <select
                    value={formData.tipologia}
                    onChange={(e) => setFormData({ ...formData, tipologia: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#00D4FF]"
                  >
                    <option value="t1">T0 / T1</option>
                    <option value="t2">T2</option>
                    <option value="t3">T3</option>
                    <option value="t4_plus">T4 ou superior / Moradia</option>
                    <option value="comercial">Comercial (por m²)</option>
                  </select>
                </div>
              </div>

              {/* Frequência */}
              <div>
                <label className="block text-sm font-semibold text-[#0B192C] mb-2">Frequência Desejada</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'pontual', label: 'Pontual' },
                    { id: 'semanal', label: 'Semanal' },
                    { id: 'quinzenal', label: 'Quinzenal' },
                    { id: 'mensal', label: 'Mensal' }
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, frequencia: item.id })}
                      className={`p-3 text-sm font-semibold rounded-xl border transition ${
                        formData.frequencia === item.id
                          ? 'bg-[#0B192C] text-white border-[#0B192C]'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Serviços Adicionais */}
              <div>
                <label className="block text-sm font-semibold text-[#0B192C] mb-2">Serviços Adicionais (Opcional)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {['Vidros & Estores', 'Interior do Forno', 'Interior do Frigorífico', 'Limpeza de Varandas', 'Passagem de Roupa'].map((extra) => (
                    <label
                      key={extra}
                      className={`flex items-center space-x-2 p-3 rounded-xl border cursor-pointer text-xs sm:text-sm font-medium transition ${
                        formData.servicosAdicionais.includes(extra)
                          ? 'bg-[#00D4FF]/10 border-[#00D4FF] text-[#0B192C]'
                          : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.servicosAdicionais.includes(extra)}
                        onChange={() => handleExtraToggle(extra)}
                        className="rounded text-[#00D4FF] focus:ring-0"
                      />
                      <span>{extra}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Dados do Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="O seu nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    placeholder="exemplo@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Telefone</label>
                  <input
                    type="tel"
                    required
                    placeholder="912 345 678"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Observações / Detalhes do Espaço</label>
                <textarea
                  rows={3}
                  placeholder="Indique a localização, detalhes dos estofos ou necessidades específicas..."
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>

              {/* Nota de Isenção de Confirmacão Automática */}
              <p className="text-xs text-slate-500 italic">
                * Os valores calculados são estimativos sujeitos a confirmação após avaliação técnica do espaço.
              </p>

              {orcamentoErro && (
                <div className="mb-4 p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-medium text-center">
                  {orcamentoErro}
                </div>
              )}

              <button
                type="submit"
                disabled={carregando}
                className="w-full bg-[#0B192C] text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition shadow-lg flex items-center justify-center space-x-2"
              >
                {carregando ? (
                  <span>A processar pedido...</span>
                ) : (
                  <span>Enviar Pedido de Orçamento</span>
                )}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* 5. COMO FUNCIONA */}
      <section id="como-funciona" className="py-20 px-6 md:px-12 bg-slate-50">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0B192C] mb-12">Como Funciona a Contratação</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative">
              <div className="w-12 h-12 bg-[#00D4FF] text-[#0B192C] font-extrabold rounded-xl flex items-center justify-center mx-auto mb-6 text-xl">
                1
              </div>
              <h3 className="font-bold text-lg mb-2">Pedido ou Simulação</h3>
              <p className="text-slate-600 text-sm">Escolha o serviço desejado e envie os detalhes do seu espaço através do simulador online.</p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative">
              <div className="w-12 h-12 bg-[#00D4FF] text-[#0B192C] font-extrabold rounded-xl flex items-center justify-center mx-auto mb-6 text-xl">
                2
              </div>
              <h3 className="font-bold text-lg mb-2">Confirmação & Agendamento</h3>
              <p className="text-slate-600 text-sm">Analisamos a proposta, confirmamos o valor final e agendamos a data de execução com total conveniência.</p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative">
              <div className="w-12 h-12 bg-[#00D4FF] text-[#0B192C] font-extrabold rounded-xl flex items-center justify-center mx-auto mb-6 text-xl">
                3
              </div>
              <h3 className="font-bold text-lg mb-2">Execução com Rigor</h3>
              <p className="text-slate-600 text-sm">A equipa R&R Services realiza o serviço com elevados padrões de qualidade e atenção a cada detalhe.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. PERGUNTAS FREQUENTES (FAQ) */}
      <section id="faq" className="py-20 px-6 md:px-12 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[#0B192C] mb-12">Perguntas Frequentes</h2>
          <div className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <h3 className="font-bold text-lg text-[#0B192C] mb-2">É necessário fornecer os produtos e utensílios de limpeza?</h3>
              <p className="text-slate-600 text-sm">A equipa R&R Services pode levar todos os produtos e equipamentos profissionais necessários para a execução do serviço, garantindo a máxima eficácia.</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <h3 className="font-bold text-lg text-[#0B192C] mb-2">Como posso acompanhar as minhas marcações e orçamentos?</h3>
              <p className="text-slate-600 text-sm">Basta aceder à <Link href="/login?next=%2Fcliente&force=1" className="text-[#00D4FF] font-semibold underline">Área do Cliente</Link> para consultar o histórico, ver o estado das suas solicitações e solicitar novos serviços extra.</p>
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
              <li><a href="#simulador" className="hover:text-white transition">Simulador de Orçamento</a></li>
              <li><Link href="/login?next=%2Fcliente&force=1" className="hover:text-white transition">Área de Clientes</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm text-[#00D4FF] uppercase tracking-wider mb-4">Área de Atendimento</h4>
            <p className="text-slate-300 text-sm mb-2">Portugal (Lisboa, Margem Sul e Regiões Metropolitanas)</p>
            <p className="text-xs text-slate-400">Fuso horário: Europe/Lisbon | Moeda: € (EUR)</p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
          © 2026 R&R Services. Todos os direitos reservados.
        </div>
      </footer>

    </div>
  );
}