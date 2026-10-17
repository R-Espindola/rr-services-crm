import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-[#0B192C]">
      {/* Cabeçalho */}
      <header className="w-full bg-[#0B192C] text-white py-4 px-6 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <span className="text-2xl font-bold tracking-wider text-[#00D4FF]">R&R</span>
          <span className="text-lg font-medium text-slate-200">Services</span>
        </div>
        <div className="space-x-4">
          <Link href="/login" className="text-sm font-medium hover:text-[#00D4FF] transition">
            Entrar
          </Link>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 flex flex-col items-center justify-center text-center">
        <div className="inline-block bg-[#00D4FF]/10 text-[#0B192C] px-4 py-1.5 rounded-full text-sm font-semibold mb-6 border border-[#00D4FF]/30">
          Limpeza Profissional e Rigor Técnico em Portugal
        </div>
        
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Excelência e Confiança <br />
          <span className="text-[#00D4FF]">na Limpeza do seu Espaço</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mb-10">
          Bem-vindo à R&R Services. Gerir as suas limpezas contratadas, solicitar serviços extra e encomendar produtos de manutenção doméstica nunca foi tão simples e seguro.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
          <Link
            href="/login"
            className="bg-[#0B192C] text-white font-semibold py-3 px-8 rounded-xl shadow-lg hover:bg-slate-800 transition text-center"
          >
            Aceder à minha conta
          </Link>
        </div>

        {/* Secção de Destaques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full text-left">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-lg mb-2 text-[#0B192C]">Rigor e Pontualidade</h3>
            <p className="text-sm text-slate-600">Serviços profissionais executados com padrões rigorosos de qualidade e atenção ao detalhe.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-lg mb-2 text-[#0B192C]">Serviços Extra Flexíveis</h3>
            <p className="text-sm text-slate-600">Adicione limpezas de forno, vidros, estores ou higienização de sofás diretamente à sua marcação.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-lg mb-2 text-[#0B192C]">Produtos Exclusivos</h3>
            <p className="text-sm text-slate-600">Encomende produtos de limpeza profissionais, ambientadores e kits de manutenção doméstica.</p>
          </div>
        </div>
      </main>

      {/* Rodapé */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        <p>© 2026 R&R Services. Todos os direitos reservados. Fuso horário: Europe/Lisbon | Moeda: €</p>
      </footer>
    </div>
  );
}