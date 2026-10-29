"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";

type ServicoExtra = {
  id: string;
  titulo: string;
  preco: number;
  imagem: string;
  desc: string;
};

const servicosExtra: ServicoExtra[] = [
  { id: "ext-1", titulo: "Interior do forno", preco: 20, imagem: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=700&q=85", desc: "Desengorduramento e limpeza profunda." },
  { id: "ext-2", titulo: "Interior do frigorífico", preco: 18, imagem: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=700&q=85", desc: "Higienização e remoção de odores." },
  { id: "ext-3", titulo: "Vidros e estores", preco: 35, imagem: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=700&q=85", desc: "Limpeza de vidros, caixilharia e estores." },
  { id: "ext-4", titulo: "Higienização de sofá", preco: 60, imagem: "https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=700&q=85", desc: "Tratamento de tecidos e remoção de sujidade." },
];

const produtosLoja = [
  { id: "prod-1", nome: "Detergente multiusos profissional R&R 1 L", preco: 8.5, imagem: "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=700&q=85" },
  { id: "prod-2", nome: "Kit de 5 panos de microfibra", preco: 6.9, imagem: "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=700&q=85" },
  { id: "prod-3", nome: "Ambientador concentrado Brisa de Verão 500 ml", preco: 12, imagem: "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=700&q=85" },
];

const formatarPreco = (valor: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(valor);

const navItems = [
  { href: "/cliente", icon: "⌂", label: "Visão geral" },
  { href: "/cliente/pedidos", icon: "▦", label: "As minhas marcações" },
  { href: "/cliente/extras", icon: "✦", label: "Serviços extra" },
  { href: "/cliente/loja", icon: "▣", label: "Loja de produtos" },
  { href: "/cliente/perfil", icon: "◎", label: "O meu perfil" },
];

export default function ClienteDashboard() {
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const [menuPerfilAberto, setMenuPerfilAberto] = useState(false);
  const [menuTelemovelAberto, setMenuTelemovelAberto] = useState(false);
  const [extraSelecionado, setExtraSelecionado] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [mensagem, setMensagem] = useState("");

  // Dados demonstrativos: substituir pelos dados do cliente autenticado no Supabase.
  const cliente = {
    nome: "Maria Fernandes",
    email: "maria.fernandes@email.com",
    morada: "Rua das Flores, n.º 42, 2.º Dt.º, Lisboa",
    proximaLimpeza: {
      id: "LIM-2026-882",
      tipo: "Limpeza residencial regular",
      data: "24 de outubro de 2026",
      horario: "09:00–12:00",
      preco: 65,
      estado: "Confirmada",
      tarefas: ["Aspirar e lavar pavimentos", "Higienização de casas de banho", "Limpeza da cozinha", "Remoção de pó das superfícies"],
    },
  };

  const extrasEscolhidos = useMemo(
    () => servicosExtra.filter((item) => extraSelecionado.includes(item.id)),
    [extraSelecionado],
  );
  const totalExtras = extrasEscolhidos.reduce((total, item) => total + item.preco, 0);
  const totalEstimado = cliente.proximaLimpeza.preco + totalExtras;

  function alternarExtra(id: string) {
    setMensagem("");
    setExtraSelecionado((atuais) => atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]);
  }

  function submeterPedido(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (extraSelecionado.length === 0) return;
    setMensagem("A sua seleção está pronta. Para concluir o pedido, é necessária a ligação deste formulário à API/Supabase da R&R Services.");
  }

  return (
    <div className="min-h-screen bg-[#F3F6FA] text-[#0B192C]">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-white focus:p-3">Saltar para o conteúdo</a>

      {/* Barra superior */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#081426]/95 text-white shadow-xl backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/cliente" className="flex items-center gap-3" aria-label="R&R Services — portal do cliente">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D4FF] text-sm font-black tracking-tight text-[#0B192C] shadow-[0_0_25px_rgba(0,212,255,0.22)]">R&R</span>
            <span>
              <span className="block text-sm font-extrabold tracking-wide">R&R SERVICES</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">Portal do cliente</span>
            </span>
          </Link>

          <div className="hidden items-center gap-3 md:flex">
            <span className="mr-2 text-xs text-slate-400">A sua casa, sempre cuidada.</span>
            <div className="relative">
              <button type="button" aria-label="Ver notificações" aria-expanded={notificacoesAbertas} onClick={() => { setNotificacoesAbertas(!notificacoesAbertas); setMenuPerfilAberto(false); }} className="relative rounded-xl border border-white/10 bg-white/[0.06] p-3 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#00D4FF]">
                <span aria-hidden="true">♧</span><span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#00D4FF]" />
              </button>
              {notificacoesAbertas && <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-[#0B192C] shadow-2xl"><p className="font-extrabold">Notificações</p><p className="mt-2 leading-6 text-slate-600">A sua próxima limpeza está confirmada para {cliente.proximaLimpeza.data}, das {cliente.proximaLimpeza.horario}.</p><Link href="/cliente/pedidos" className="mt-3 inline-block font-bold text-sky-700 hover:underline">Consultar marcação →</Link></div>}
            </div>
            <div className="relative">
              <button type="button" aria-expanded={menuPerfilAberto} onClick={() => { setMenuPerfilAberto(!menuPerfilAberto); setNotificacoesAbertas(false); }} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] py-1.5 pl-2 pr-3 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#00D4FF]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#00D4FF] to-cyan-200 text-xs font-black text-[#0B192C]">MF</span>
                <span className="text-left"><span className="block text-xs font-bold">{cliente.nome}</span><span className="block text-[10px] text-slate-400">Conta de cliente</span></span><span className="text-xs text-slate-400">⌄</span>
              </button>
              {menuPerfilAberto && <div className="absolute right-0 mt-3 w-60 rounded-2xl border border-slate-200 bg-white py-2 text-sm text-[#0B192C] shadow-2xl"><Link href="/cliente/perfil" className="block px-4 py-3 hover:bg-slate-50">O meu perfil</Link><Link href="/cliente/pedidos" className="block px-4 py-3 hover:bg-slate-50">As minhas marcações</Link><Link href="/login" className="block border-t border-slate-100 px-4 py-3 font-semibold text-rose-600 hover:bg-rose-50">Terminar sessão</Link></div>}
            </div>
          </div>

          <button type="button" aria-label={menuTelemovelAberto ? "Fechar menu" : "Abrir menu"} aria-expanded={menuTelemovelAberto} onClick={() => setMenuTelemovelAberto(!menuTelemovelAberto)} className="rounded-xl border border-white/10 bg-white/[0.06] p-3 text-lg md:hidden">{menuTelemovelAberto ? "✕" : "☰"}</button>
        </div>
        {menuTelemovelAberto && <nav className="space-y-1 border-t border-white/10 px-4 py-3 md:hidden">{navItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuTelemovelAberto(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-200 hover:bg-white/10"><span className="text-[#00D4FF]">{item.icon}</span>{item.label}</Link>)}<Link href="/login" className="block rounded-xl px-3 py-3 text-sm font-semibold text-rose-300">Terminar sessão</Link></nav>}
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[245px_minmax(0,1fr)]">
        {/* Navegação lateral desktop */}
        <aside className="hidden border-r border-slate-200/80 bg-white/70 px-4 py-7 lg:block">
          <p className="px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Menu principal</p>
          <nav className="mt-4 space-y-1.5" aria-label="Navegação do portal">
            {navItems.map((item, index) => <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition ${index === 0 ? "bg-[#0B192C] text-white shadow-lg shadow-slate-900/10" : "text-slate-600 hover:bg-slate-100 hover:text-[#0B192C]"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${index === 0 ? "bg-[#00D4FF] text-[#0B192C]" : "bg-slate-100 text-slate-500"}`}>{item.icon}</span>{item.label}{index === 0 && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00D4FF]" />}</Link>)}
          </nav>
          <div className="mt-10 rounded-2xl bg-gradient-to-br from-[#0B192C] to-[#173957] p-4 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00D4FF] text-lg text-[#0B192C]">✦</div>
            <p className="mt-4 text-sm font-extrabold">Um apoio sempre por perto</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">Precisa de ajuda com uma marcação? Estamos disponíveis para si.</p>
            <a href="#apoio" className="mt-4 inline-flex text-xs font-bold text-[#00D4FF] hover:underline">Contactar equipa →</a>
          </div>
          <p className="mt-8 px-3 text-[10px] text-slate-400">© 2026 R&R Services</p>
        </aside>

        <main id="conteudo" className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">
          {/* Boas-vindas */}
          <section className="relative isolate overflow-hidden rounded-[28px] bg-[#0B192C] p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8 lg:p-10">
            <div className="absolute -right-12 -top-24 -z-10 h-72 w-72 rounded-full bg-[#00D4FF]/15 blur-3xl" />
            <div className="absolute bottom-[-100px] right-[20%] -z-10 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#00D4FF]/25 bg-[#00D4FF]/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#70E8FF]"><span className="h-1.5 w-1.5 rounded-full bg-[#00D4FF]" /> A sua área pessoal</span>
                <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Olá, {cliente.nome.split(" ")[0]}<span className="text-[#00D4FF]">.</span></h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Tudo em ordem com a sua casa. Consulte a próxima visita e personalize os serviços ao seu ritmo.</p>
              </div>
              <Link href="/cliente/perfil" className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#0B192C] transition hover:bg-[#00D4FF] sm:self-auto"><span>◎</span> Gerir o meu perfil</Link>
            </div>
            <div className="mt-8 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#00D4FF]">▦</span><span><span className="block text-[10px] uppercase tracking-wider text-slate-400">Próxima visita</span><span className="mt-1 block text-sm font-bold">24 out. · 09:00</span></span></div>
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#00D4FF]">✓</span><span><span className="block text-[10px] uppercase tracking-wider text-slate-400">Estado atual</span><span className="mt-1 block text-sm font-bold text-emerald-300">Marcação confirmada</span></span></div>
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#00D4FF]">⌂</span><span><span className="block text-[10px] uppercase tracking-wider text-slate-400">Morada guardada</span><span className="mt-1 block text-sm font-bold">Lisboa</span></span></div>
            </div>
          </section>

          {/* Próxima intervenção */}
          <section aria-labelledby="marcacao-titulo" className="mt-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-sky-700">Agenda</p><h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">A sua próxima intervenção</h2></div><Link href="/cliente/pedidos" className="text-xs font-extrabold text-sky-700 hover:underline">Ver todas as marcações →</Link></div>
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="grid lg:grid-cols-[175px_minmax(0,1fr)]">
                <div className="flex flex-row items-center gap-4 bg-gradient-to-br from-[#00D4FF] to-[#8CEEFF] p-5 text-[#0B192C] lg:flex-col lg:items-start lg:justify-center lg:p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/60 text-2xl">▦</div>
                  <div><p className="text-[10px] font-black uppercase tracking-[0.16em]">Outubro 2026</p><p className="mt-1 text-2xl font-black">24 <span className="text-sm font-bold">Sáb.</span></p><p className="mt-1 text-xs font-semibold">09:00–12:00</p></div>
                </div>
                <div className="p-5 sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">✓ {cliente.proximaLimpeza.estado}</span><span className="text-xs font-semibold text-slate-400">Ref. {cliente.proximaLimpeza.id}</span></div>
                  <div className="mt-4 flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
                    <div className="min-w-0 flex-1"><h3 id="marcacao-titulo" className="text-xl font-black sm:text-2xl">{cliente.proximaLimpeza.tipo}</h3><p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-500"><span className="text-sky-700">⌂</span>{cliente.morada}</p>
                      <div className="mt-5"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Incluído nesta visita</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{cliente.proximaLimpeza.tarefas.map((tarefa) => <p key={tarefa} className="flex items-start gap-2 text-xs font-medium text-slate-600"><span className="text-emerald-600">✓</span>{tarefa}</p>)}</div></div>
                    </div>
                    <div className="flex shrink-0 flex-row items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 xl:min-w-[190px] xl:flex-col xl:items-start"><div><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Valor da visita</p><p className="mt-1 text-3xl font-black tracking-tight">{formatarPreco(cliente.proximaLimpeza.preco)}</p></div><Link href="/cliente/pedidos" className="text-xs font-extrabold text-sky-700 hover:underline">Gerir visita →</Link></div>
                  </div>
                  <a href="#servicos-extra" className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B192C] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#173957] sm:w-auto"><span className="text-[#00D4FF]">＋</span> Adicionar serviços à visita</a>
                </div>
              </div>
            </div>
          </section>

          {/* Serviços extra */}
          <section id="servicos-extra" className="scroll-mt-28 mt-9">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-sky-700">À sua medida</p><h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Dê um cuidado extra à sua casa</h2><p className="mt-2 text-sm text-slate-500">Adicione serviços à próxima visita e veja o preço antes de continuar.</p></div>{extraSelecionado.length > 0 && <button type="button" onClick={() => { setExtraSelecionado([]); setMensagem(""); }} className="self-start text-xs font-bold text-slate-500 underline underline-offset-4 hover:text-[#0B192C]">Limpar seleção</button>}</div>
            {mensagem && <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{mensagem}</div>}
            <form onSubmit={submeterPedido}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {servicosExtra.map((item) => {
                  const selecionado = extraSelecionado.includes(item.id);
                  return <label key={item.id} className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-[22px] border bg-white transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5 ${selecionado ? "border-sky-500 ring-2 ring-sky-100" : "border-slate-200"}`}>
                    <input type="checkbox" checked={selecionado} onChange={() => alternarExtra(item.id)} className="sr-only" />
                    <div className="relative h-44 overflow-hidden bg-slate-100"><img src={item.imagem} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#0B192C]/50 via-transparent to-transparent" /><span className="absolute right-3 top-3 rounded-xl bg-white px-3 py-2 text-sm font-black text-[#0B192C] shadow-lg">{formatarPreco(item.preco)}</span>{selecionado && <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-3 py-1.5 text-[10px] font-extrabold text-white">✓ Selecionado</span>}</div>
                    <div className="flex flex-1 flex-col p-4"><h3 className="font-extrabold">{item.titulo}</h3><p className="mt-2 flex-1 text-xs leading-5 text-slate-500">{item.desc}</p><span className={`mt-4 flex min-h-11 items-center justify-center rounded-xl text-xs font-extrabold transition ${selecionado ? "bg-[#00D4FF] text-[#0B192C]" : "border border-slate-200 bg-slate-50 text-slate-700 group-hover:border-[#00D4FF] group-hover:bg-cyan-50"}`}>{selecionado ? "✓ Adicionado à seleção" : "+ Adicionar serviço"}</span></div>
                  </label>;
                })}
              </div>
              {extraSelecionado.length > 0 && <div className="mt-5 grid gap-4 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:grid-cols-[1fr_300px]"><div><label htmlFor="observacoes" className="text-sm font-extrabold">Alguma instrução para a equipa? <span className="font-normal text-slate-400">(opcional)</span></label><textarea id="observacoes" rows={3} maxLength={500} placeholder="Ex.: dar especial atenção ao interior do forno." value={observacoes} onChange={(event) => setObservacoes(event.target.value)} className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" /><p className="mt-1 text-right text-[10px] text-slate-400">{observacoes.length}/500 caracteres</p><p className="mt-2 text-xs leading-5 text-slate-500">O pedido só fica confirmado depois de ser submetido e validado pela equipa.</p></div><div className="flex flex-col justify-between rounded-2xl bg-[#0B192C] p-5 text-white"><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Resumo da visita</p><div className="mt-4 space-y-3 text-sm"><p className="flex justify-between gap-3 text-slate-300">Serviços extra <strong className="text-white">{formatarPreco(totalExtras)}</strong></p><p className="flex justify-between gap-3 text-slate-300">Valor base <strong className="text-white">{formatarPreco(cliente.proximaLimpeza.preco)}</strong></p></div><div className="my-4 border-t border-white/10" /><p className="text-xs text-slate-400">Total estimado</p><p className="mt-1 text-3xl font-black text-[#00D4FF]">{formatarPreco(totalEstimado)}</p><button type="submit" className="mt-5 min-h-12 rounded-xl bg-[#00D4FF] px-4 py-3 text-sm font-black text-[#0B192C] transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-white">Continuar pedido →</button></div></div>}
            </form>
          </section>

          {/* Loja */}
          <section className="mt-10">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-sky-700">Escolhas R&R</p><h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Pequenos essenciais para casa</h2><p className="mt-2 text-sm text-slate-500">Produtos selecionados para cuidar da sua casa entre visitas.</p></div><Link href="/cliente/loja" className="text-xs font-extrabold text-sky-700 hover:underline">Explorar a loja →</Link></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{produtosLoja.map((produto) => <article key={produto.id} className="group flex gap-4 rounded-[22px] border border-slate-200 bg-white p-4 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5 sm:flex-col"><div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:h-48 sm:w-full"><img src={produto.imagem} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div><div className="flex min-w-0 flex-1 flex-col"><h3 className="text-sm font-extrabold leading-5">{produto.nome}</h3><div className="mt-auto flex items-center justify-between gap-3 pt-4"><p className="text-lg font-black">{formatarPreco(produto.preco)}</p><Link href="/cliente/loja" className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-extrabold transition hover:border-[#00D4FF] hover:bg-cyan-50">Ver produto →</Link></div></div></article>)}</div>
          </section>

          {/* Apoio */}
          <section id="apoio" className="relative mt-10 scroll-mt-28 overflow-hidden rounded-[26px] bg-gradient-to-r from-[#0B192C] to-[#173957] p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8"><div className="absolute -right-8 -top-16 h-48 w-48 rounded-full bg-[#00D4FF]/10 blur-3xl" /><div className="relative"><span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#00D4FF]">Estamos aqui para si</span><h2 className="mt-2 text-xl font-black sm:text-2xl">Precisa de uma mão?</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Fale connosco sobre uma marcação, um serviço ou qualquer questão. Teremos todo o gosto em ajudar.</p></div><a href="mailto:rrservices.pt@gmail.com?subject=Pedido%20de%20apoio%20-%20R%26R%20Services" className="relative mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00D4FF] px-5 py-3 text-sm font-black text-[#0B192C] transition hover:bg-cyan-200 sm:mt-0 sm:w-auto sm:shrink-0">✉ Enviar mensagem</a></section>

          <footer className="flex flex-col gap-3 border-t border-slate-200 py-6 text-center text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:text-left"><p>© 2026 R&R Services. Todos os direitos reservados.</p><div className="flex justify-center gap-4"><Link href="/privacidade" className="hover:text-sky-700">Privacidade</Link><Link href="/termos" className="hover:text-sky-700">Termos e condições</Link></div></footer>
        </main>
      </div>
    </div>
  );
}
