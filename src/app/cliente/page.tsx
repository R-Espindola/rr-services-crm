"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ClienteDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const [extraSelecionado, setExtraSelecionado] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [pedidoSucesso, setPedidoSucesso] = useState(false);

  // Estados dinâmicos ligados à base de dados
  const [cliente, setCliente] = useState<any>({
    nome: "A carregar...",
    email: "",
    telefone: "",
    moradaPadrao: "A carregar morada..."
  });
  
  const [proximaLimpeza, setProximaLimpeza] = useState<any | null>(null);
  const [historicoIntervencoes, setHistoricoIntervencoes] = useState<any[]>([]);

  // Catálogo estático de Serviços Extra (disponíveis para seleção)
  const servicosExtra = [
    { id: 'ext-1', titulo: 'Interior do Forno', preco: 20.00, imagem: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80', desc: 'Desengorduramento e limpeza profunda a alta temperatura.' },
    { id: 'ext-2', titulo: 'Interior do Frigorífico', preco: 18.00, imagem: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=400&q=80', desc: 'Higienização, remoção de odores e desinfeção completa.' },
    { id: 'ext-3', titulo: 'Vidros & Estores Exterior', preco: 35.00, imagem: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=400&q=80', desc: 'Limpeza de caixilharia, vidros duplos e estores.' },
    { id: 'ext-4', titulo: 'Higienização de Sofá', preco: 60.00, imagem: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=400&q=80', desc: 'Limpeza a seco e extração de nódoas e ácaros.' }
  ];

  // Produtos de Manutenção
  const produtosLoja = [
    { id: 'prod-1', nome: 'Detergente Multiusos Profissional R&R 1L', preco: '8,50 €', imagem: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=400&q=80' },
    { id: 'prod-2', nome: 'Kit 5 Panos Microfibra Ultra-Absorventes', preco: '6,90 €', imagem: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=400&q=80' },
    { id: 'prod-3', nome: 'Ambientador Concentrado Brisa de Verão 500ml', preco: '12,00 €', imagem: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=400&q=80' }
  ];

  useEffect(() => {
    fetchClientData();
  }, []);

  async function fetchClientData() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      return;
    }

    // 1. Obter dados do cliente logado pelo e-mail
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('email', session.user.email)
      .single();

    if (clientData) {
      setCliente({
        id: clientData.id,
        nome: clientData.name,
        email: clientData.email,
        telefone: clientData.phone,
        moradaPadrao: clientData.address || 'Sem morada registada'
      });

      // 2. Obter as encomendas/agendamentos deste cliente
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('client_id', clientData.id)
        .order('scheduled_date', { ascending: false });

      if (ordersData && ordersData.length > 0) {
        // Separar a próxima intervenção (pendente ou futura) do histórico
        const futuras = ordersData.filter(o => o.status === 'pending' || o.status === 'in_progress');
        if (futuras.length > 0) {
          setProximaLimpeza(futuras[0]);
        } else {
          setProximaLimpeza(ordersData[0]); // fallback para a mais recente
        }
        setHistoricoIntervencoes(ordersData);
      }
    }

    setLoading(false);
  }

  const handleToggleExtra = (id: string) => {
    setExtraSelecionado(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Submeter serviço extra diretamente para a base de dados
  const handleSubmeterExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (extraSelecionado.length === 0) return;

    setLoading(true);

    // Calcular valor total dos extras selecionados
    let totalExtra = 0;
    const nomesExtras: string[] = [];
    
    extraSelecionado.forEach(extId => {
      const servico = servicosExtra.find(s => s.id === extId);
      if (servico) {
        totalExtra += servico.preco;
        nomesExtras.push(servico.titulo);
      }
    });

    const { error } = await supabase.from('orders').insert([
      {
        client_id: cliente.id,
        service_type: `Extra: ${nomesExtras.join(', ')}`,
        scheduled_date: new Date().toISOString(),
        total_amount: totalExtra,
        status: 'pending',
        notes: observacoes ? `Observações do Cliente: ${observacoes}` : 'Serviço extra solicitado pelo Portal do Cliente'
      }
    ]);

    if (error) {
      alert('Erro ao submeter pedido extra: ' + error.message);
    } else {
      setPedidoSucesso(true);
      setExtraSelecionado([]);
      setObservacoes('');
      fetchClientData();
      setTimeout(() => setPedidoSucesso(false), 4000);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; path=/; max-age=0';
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-[#0B192C] font-sans pb-16">
      
      {/* 1. CABEÇALHO */}
      <header className="bg-[#0B192C] text-white sticky top-0 z-50 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/cliente" className="flex items-center space-x-2">
            <span className="text-2xl font-extrabold text-[#00D4FF]">R&R</span>
            <span className="text-lg font-bold text-slate-100">Portal do Cliente</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-300">
            <Link href="/cliente" className="text-[#00D4FF]">Início</Link>
            <Link href="/cliente/extras" className="hover:text-[#00D4FF] transition">Serviços Extra</Link>
            <Link href="/cliente/loja" className="hover:text-[#00D4FF] transition">Loja</Link>
            <Link href="/cliente/pedidos" className="hover:text-[#00D4FF] transition">Histórico</Link>
            <Link href="/cliente/perfil" className="hover:text-[#00D4FF] transition">Meu Perfil</Link>
          </nav>

          <div className="flex items-center space-x-4">
            {/* Notificações */}
            <div className="relative">
              <button 
                onClick={() => setNotificacoesAbertas(!notificacoesAbertas)}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 relative focus:outline-none cursor-pointer"
              >
                🔔
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#00D4FF] rounded-full" />
              </button>

              {notificacoesAbertas && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 text-[#0B192C] p-4 text-xs z-50">
                  <h4 className="font-bold border-b pb-2 mb-2">Notificações</h4>
                  <p className="text-slate-600 mb-2">Aceda ao seu histórico para consultar o estado atualizado das suas limpezas.</p>
                </div>
              )}
            </div>

            {/* Sair */}
            <button
              onClick={handleLogout}
              className="bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition border border-red-500/30 cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">

        {/* 2. SAUDAÇÃO PERSONALIZADA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#0B192C]">
              Olá, {cliente.nome} 👋
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Bem-vinda à sua área pessoal R&R Services. Acompanhe a sua próxima visita e solicite serviços extra com facilidade.
            </p>
          </div>
          <Link
            href="/cliente/perfil"
            className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-[#0B192C] px-4 py-2.5 rounded-xl border border-slate-300 transition"
          >
            📍 {cliente.moradaPadrao}
          </Link>
        </div>

        {/* 3. CARTÃO DESTACADO DA PRÓXIMA LIMPEZA */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden relative">
          <div className="bg-[#0B192C] text-white p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <span className="bg-[#00D4FF] text-[#0B192C] text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                  Próxima Intervenção
                </span>
                <span className="text-xs text-slate-300">ID: #{proximaLimpeza ? String(proximaLimpeza.id).substring(0, 8) : '---'}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                {proximaLimpeza ? proximaLimpeza.service_type : 'Nenhuma limpeza agendada'}
              </h2>
              <p className="text-[#00D4FF] font-bold text-lg mt-1">
                🗓️ {proximaLimpeza ? new Date(proximaLimpeza.scheduled_date).toLocaleString('pt-PT') : 'Aguarde agendamento'}
              </p>
            </div>

            <div className="text-left md:text-right">
              <span className="text-xs text-slate-400 block uppercase font-semibold">Valor Registado</span>
              <span className="text-3xl font-extrabold text-[#00D4FF]">{proximaLimpeza ? `${Number(proximaLimpeza.total_amount).toFixed(2)} €` : '0.00 €'}</span>
              <span className="block text-xs text-emerald-400 font-bold mt-1">✓ {proximaLimpeza ? proximaLimpeza.status : 'Pendente'}</span>
            </div>
          </div>

          <div className="p-6 md:p-8 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 border-t border-slate-100">
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-1">Local da Intervenção</h4>
              <p className="text-sm font-semibold text-[#0B192C]">{cliente.moradaPadrao}</p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-1">Observações / Notas</h4>
              <p className="text-xs text-slate-600">{proximaLimpeza?.notes || 'Sem observações especiais registadas.'}</p>
            </div>

            <div className="flex flex-col justify-center space-y-3">
              <a
                href="#catalogo-extras"
                className="w-full bg-[#00D4FF] hover:bg-[#00c2ea] text-[#0B192C] font-extrabold text-sm py-3 px-4 rounded-xl text-center shadow transition"
              >
                + Adicionar Serviço Extra a esta Visita
              </a>
            </div>
          </div>
        </section>

        {/* 4. CATÁLOGO DE SERVIÇOS EXTRA */}
        <section id="catalogo-extras" className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
              <h3 className="text-xl font-bold text-[#0B192C]">Catálogo de Serviços Adicionais</h3>
              <p className="text-xs text-slate-500">Selecione os extras que pretende adicionar[cite: 1].</p>
            </div>
            {extraSelecionado.length > 0 && (
              <span className="text-xs font-bold bg-[#00D4FF]/20 text-[#0B192C] px-3 py-1 rounded-full mt-2 sm:mt-0">
                {extraSelecionado.length} selecionado(s)
              </span>
            )}
          </div>

          {pedidoSucesso && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm font-semibold text-center">
              ✓ O seu pedido de serviço extra foi registado com sucesso na base de dados!
            </div>
          )}

          <form onSubmit={handleSubmeterExtra} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {servicosExtra.map((item) => {
                const selecionado = extraSelecionado.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleExtra(item.id)}
                    className={`cursor-pointer rounded-2xl border overflow-hidden transition flex flex-col justify-between ${
                      selecionado ? 'border-[#00D4FF] ring-2 ring-[#00D4FF] bg-cyan-50/20' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="h-36 w-full relative">
                        <img src={item.imagem} alt={item.titulo} className="w-full h-full object-cover" />
                        <span className="absolute top-3 right-3 bg-[#0B192C] text-[#00D4FF] text-xs font-extrabold px-2.5 py-1 rounded-lg">
                          {item.preco.toFixed(2)} €
                        </span>
                      </div>
                      <div className="p-4">
                        <h4 className="font-bold text-sm text-[#0B192C]">{item.titulo}</h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>

                    <div className="p-4 pt-0">
                      <div className={`w-full py-2 rounded-xl text-xs font-bold text-center border transition ${
                        selecionado ? 'bg-[#00D4FF] text-[#0B192C] border-[#00D4FF]' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {selecionado ? '✓ Selecionado' : '+ Adicionar Extra'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {extraSelecionado.length > 0 && (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0B192C] mb-1">Observações ou instruções específicas</label>
                  <input
                    type="text"
                    placeholder="Ex: Dar atenção especial ao forno..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 bg-white text-xs"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-slate-500">* Pedido sujeito a confirmação prévia pela equipa técnica.</span>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#0B192C] hover:bg-slate-800 text-white font-bold text-sm px-6 py-3 rounded-xl shadow transition cursor-pointer"
                  >
                    {loading ? 'A processar...' : 'Confirmar e Submeter Pedido'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </section>

        {/* 5. HISTÓRICO DE INTERVENÇÕES */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-[#0B192C] mb-4">Histórico de Intervenções & Pedidos</h3>
          <div className="space-y-3">
            {historicoIntervencoes.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Sem histórico registado.</p>
            ) : (
              historicoIntervencoes.map((int) => (
                <div key={int.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-[#0B192C] text-sm block">{int.service_type}</span>
                    <span className="text-slate-500">Data: {new Date(int.scheduled_date).toLocaleDateString('pt-PT')}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-[#0B192C] text-sm block">{Number(int.total_amount).toFixed(2)} €</span>
                    <span className="font-bold uppercase text-[10px] text-sky-600">{int.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </main>

      <footer className="max-w-7xl mx-auto px-6 mt-12 text-center text-xs text-slate-500">
        © 2026 R&R Services. Todos os direitos reservados.
      </footer>

    </div>
  );
}