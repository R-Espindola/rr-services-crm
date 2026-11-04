"use client";

import { useState } from 'react';
import Link from 'next/link';
import QuoteAssistant from './QuoteAssistant';

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          <a href="#simulador" className="hover:text-[#00D4FF] transition">Assistente de Serviços</a>
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
          <a href="#simulador" onClick={() => setMobileMenuOpen(false)}>Assistente de Serviços</a>
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

      {/* 4. ASSISTENTE CONVERSACIONAL DE SERVIÇOS */}
      <section id="simulador" className="border-y border-slate-200 bg-slate-50 px-4 py-16 sm:px-6 md:px-12 md:py-20">
        <QuoteAssistant />
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
              <h3 className="font-bold text-lg mb-2">Recomendação Conversacional</h3>
              <p className="text-slate-600 text-sm">Responda ao assistente para receber uma recomendação e enviar os detalhes do seu espaço.</p>
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
              <li><a href="#simulador" className="hover:text-white transition">Assistente de Serviços</a></li>
              <li><Link href="/login?next=%2Fcliente&force=1" className="hover:text-white transition">Área de Clientes</Link></li>
              <li><Link href="/privacidade" className="hover:text-white transition">Política de Privacidade</Link></li>
              <li><Link href="/termos" className="hover:text-white transition">Termos e Condições</Link></li>
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
