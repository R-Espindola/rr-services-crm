"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import ClientBottomNav from "@/app/cliente/ClientBottomNav";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string | null;
  notes?: string | null;
}

interface Order {
  id: string;
  client_id: string;
  service_type: string;
  scheduled_date: string | null;
  total_amount: number;
  status: string;
  notes?: string | null;
}

interface Quote {
  id: string;
  client_id: string;
  service_type: string;
  typology?: string | null;
  frequency?: string | null;
  total: number;
  status: string;
  created_at: string;
  valid_until?: string | null;
  notes?: string | null;
}

interface ExtraService {
  id: string;
  titulo: string;
  desc: string;
  preco: number;
  imagem: string;
  price_type?: string | null;
  price?: number;
  category?: string | null;
  image_url?: string | null;
  is_available?: boolean;
}

interface Product {
  id: string;
  nome: string;
  preco: number;
  imagem: string;
  description?: string | null;
  category?: string | null;
  price?: number;
  stock_quantity?: number;
  image_url?: string | null;
  is_available?: boolean;
}

const formatarPreco = (valor: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(valor);

const formatarDataHora = (dateString: string | null) => {
  if (!dateString) return { data: "Sem data", horario: "" };
  const d = new Date(dateString);
  return {
    data: d.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    horario: d.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
};

export default function ClienteDashboard() {
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const [menuPerfilAberto, setMenuPerfilAberto] = useState(false);
  const [extraSelecionado, setExtraSelecionado] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [mensagem, setMensagem] = useState("");

  const router = useRouter();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/login');
    } catch (err) {
      console.error('Erro ao terminar sessão:', err);
    }
  };

  // Dados do cliente autenticado
  const [cliente, setCliente] = useState<Client | null>(null);
  const [proximoServico, setProximoServico] = useState<Order | null>(null);
  const [pedidosPendentes, setPedidosPendentes] = useState<Order[]>([]);
  const [orcamentosPendentes, setOrcamentosPendentes] = useState<Quote[]>([]);
  const [ultimoConcluido, setUltimoConcluido] = useState<Order | null>(null);
  const [servicosExtra, setServicosExtra] = useState<ExtraService[]>([]);
  const [produtosLoja, setProdutosLoja] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregarDados = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setError("Sess\u00e3o n\u00e3o encontrada.");
        setLoading(false);
        return;
      }

      // 1. Carregar o perfil ligado ao ID autenticado (não confiar em email do cliente)
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, name, email, phone, address, notes")
        .eq("auth_user_id", user.id)
        .single();

      if (clientError || !clientData) {
        setError("Perfil de cliente n\u00e3o encontrado.");
        setLoading(false);
        return;
      }

      setCliente(clientData as Client);

      // 2. Carregar ordens do cliente
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("client_id", clientData.id)
        .order("scheduled_date", { ascending: true });

      if (ordersError) {
        setError("Erro ao carregar servi\u00e7os.");
        setLoading(false);
        return;
      }

      const orders = (ordersData || []) as Order[];
      const now = new Date();

      // Próximo serviço confirmado (pendente ou em execução, data futura ou hoje)
      const proximo = orders.find(
        (o) =>
          (o.status === "pending" || o.status === "in_progress") &&
          o.scheduled_date &&
          new Date(o.scheduled_date) >= now
      );
      setProximoServico(proximo || null);

      // Pedidos pendentes de confirmação
      const pendentes = orders.filter((o) => o.status === "pending");
      setPedidosPendentes(pendentes);

      // Último serviço concluído
      const concluidos = orders
        .filter((o) => o.status === "completed")
        .sort(
          (a, b) =>
            new Date(b.scheduled_date || 0).getTime() -
            new Date(a.scheduled_date || 0).getTime()
        );
      setUltimoConcluido(concluidos[0] || null);

      // 3. Carregar orçamentos pendentes/por responder do cliente
      const { data: quotesData, error: quotesError } = await supabase
        .from("quotes")
        .select("*")
        .eq("client_id", clientData.id)
        .in("status", ["pending", "sent"])
        .order("created_at", { ascending: false });

      if (!quotesError && quotesData) {
        setOrcamentosPendentes(quotesData as Quote[]);
      }

      // 4. Carregar serviços extra disponíveis
      const { data: extrasData, error: extrasError } = await supabase
        .from("services_catalog")
        .select("*")
        .eq("is_available", true)
        .order("category", { ascending: true });

      if (!extrasError && extrasData) {
        setServicosExtra(
          (extrasData as any[]).map((item) => ({
            id: item.id,
            titulo: item.name,
            preco: item.price_type === "quote" ? 0 : item.price || 0,
            imagem: item.image_url || "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=700&q=85",
            desc: item.description || "Sem descrição detalhada.",
          }))
        );
      }

      // 5. Carregar produtos da loja disponíveis
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("is_available", true)
        .gt("stock_quantity", 0)
        .order("name", { ascending: true });

      if (!productsError && productsData) {
        setProdutosLoja(
          (productsData as any[]).map((item) => ({
            id: item.id,
            nome: item.name,
            preco: item.price || 0,
            imagem: item.image_url || "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=700&q=85",
            description: item.description || undefined,
          }))
        );
      }
    } catch {
      setError("Erro inesperado ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const extrasEscolhidos = servicosExtra.filter((item) =>
    extraSelecionado.includes(item.id)
  );
  const totalExtras = extrasEscolhidos.reduce(
    (total, item) => total + item.preco,
    0
  );
  const { data, horario } = proximoServico
    ? formatarDataHora(proximoServico.scheduled_date)
    : { data: "", horario: "" };

  function alternarExtra(id: string) {
    setMensagem("");
    setExtraSelecionado((atuais) =>
      atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]
    );
  }

  function submeterPedido(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (extraSelecionado.length === 0) return;

    setMensagem(
      "Sele\u00e7\u00e3o preparada. Para concluir o pedido, ligue este formulário à API/Supabase da R&R Services."
    );
  }

  if (loading) {
    return (
      <div className="min-h-dvh overflow-x-hidden bg-[#F5F7FA] text-[#0B192C]">
        <header className="bg-[#0B192C] text-white py-4 px-8 shadow-md flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="bg-[#00D4FF]/10 p-2 rounded-xl border border-[#00D4FF]/20">
              <span className="text-2xl font-bold tracking-wider text-[#00D4FF]">R&R</span>
            </div>
            <div>
              <span className="text-lg font-bold text-white block leading-none">Services</span>
              <span className="text-xs text-[#00D4FF]">Portal do Cliente</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 p-2.5 md:hidden focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
            >
              ☰
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="text-center py-20 text-slate-400 font-medium">
            A carregar o seu portal...
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh overflow-x-hidden bg-[#F5F7FA] text-[#0B192C]">
        <header className="bg-[#0B192C] text-white py-4 px-8 shadow-md flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="bg-[#00D4FF]/10 p-2 rounded-xl border border-[#00D4FF]/20">
              <span className="text-2xl font-bold tracking-wider text-[#00D4FF]">R&R</span>
            </div>
            <div>
              <span className="text-lg font-bold text-white block leading-none">Services</span>
              <span className="text-xs text-[#00D4FF]">Portal do Cliente</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 p-2.5 md:hidden focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
            >
              ☰
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-center text-red-800 text-sm font-medium">
            {error}
          </div>
          <Link
            href="/cliente"
            className="mt-6 inline-block text-sm font-bold text-[#00D4FF] hover:underline"
          >
            Tentar novamente
          </Link>
        </main>
      </div>
    );
  }

  const nomeCurto = cliente?.name?.split(" ")[0] || "Cliente";

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#F5F7FA] text-[#0B192C]">
      <a
        href="#conteudo"
        className="sr-only z-[60] rounded-lg bg-white p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar para o conteúdo
      </a>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B192C] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/cliente" className="flex shrink-0 items-center gap-2" aria-label="R&R Services — início do portal">
            <span className="text-2xl font-black tracking-tight text-[#00D4FF]">R&R</span>
            <span className="hidden border-l border-slate-600 pl-2 text-sm font-semibold text-slate-100 sm:block">
              Portal do Cliente
            </span>
          </Link>

          <nav className="hidden items-center gap-5 text-sm font-medium text-slate-300 xl:flex" aria-label="Navegação principal">
            <Link href="/cliente" className="text-[#00D4FF]">Início</Link>
            <Link href="/cliente/pedidos" className="transition hover:text-white">Marcações</Link>
            <Link href="/cliente/extras" className="transition hover:text-white">Serviços extra</Link>
            <Link href="/cliente/loja" className="transition hover:text-white">Loja</Link>
          </nav>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                aria-label="Ver notificações"
                aria-expanded={notificacoesAbertas}
                onClick={() => {
                  setNotificacoesAbertas(!notificacoesAbertas);
                  setMenuPerfilAberto(false);
                }}
                className="relative rounded-xl border border-white/10 bg-white/5 p-2.5 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
              >
                <span aria-hidden="true">♧</span>
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#00D4FF]" />
              </button>
              {notificacoesAbertas && (
                <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-[#0B192C] shadow-xl sm:w-80">
                  <p className="font-bold">Notificações</p>
                  {proximoServico ? (
                    <p className="mt-2 text-slate-600">
                      A sua próxima limpeza está confirmada para {data}, das {horario}.
                    </p>
                  ) : (
                    <p className="mt-2 text-slate-600">Não tem serviços agendados neste momento.</p>
                  )}
                  {proximoServico && (
                    <Link href="/cliente/pedidos" className="mt-3 inline-block font-semibold text-sky-700 hover:underline">
                      Consultar marcação
                    </Link>
                  )}
                </div>
              )}
            </div>

            <div className="relative hidden sm:block">
              <button
                type="button"
                aria-expanded={menuPerfilAberto}
                onClick={() => {
                  setMenuPerfilAberto(!menuPerfilAberto);
                  setNotificacoesAbertas(false);
                }}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00D4FF] text-xs font-extrabold text-[#0B192C]">
                  {cliente?.name?.charAt(0) || "?"}{cliente?.name?.split(" ")[1]?.charAt(0) || "?"}
                </span>
                <span className="text-sm font-semibold">{nomeCurto}</span>
                <span aria-hidden="true" className="text-slate-400">⌄</span>
              </button>
              {menuPerfilAberto && (
                <div className="absolute right-0 mt-3 w-60 rounded-2xl border border-slate-200 bg-white py-2 text-sm text-[#0B192C] shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="font-bold">{cliente?.name}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{cliente?.email}</p>
                  </div>
                  <Link href="/cliente/perfil" className="block px-4 py-3 hover:bg-slate-50">O meu perfil</Link>
                  <Link href="/cliente/pedidos" className="block px-4 py-3 hover:bg-slate-50">As minhas marcações</Link>
                  <button
                    onClick={handleLogout}
                    className="block border-t border-slate-100 px-4 py-3 font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    Terminar sessão
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:space-y-7 sm:px-6 sm:py-8 sm:pb-32 xl:pb-8 lg:px-8">
        <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.02] sm:flex-row sm:items-center sm:p-7">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-sky-700">A sua área pessoal</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Olá, {nomeCurto} <span aria-hidden="true">👋</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Consulte a sua próxima visita, geriu os seus serviços e encontre ajuda sempre que precisar.
            </p>
          </div>
          <Link href="/cliente/perfil" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold transition hover:border-[#00D4FF] hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-sky-500">
            <span aria-hidden="true">⌖</span> Gerir morada
          </Link>
        </section>

        {proximoServico ? (
          <section aria-labelledby="marcacao-titulo" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-[#0B192C] p-5 text-white sm:p-7 lg:flex lg:items-center lg:justify-between lg:gap-8">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#00D4FF] px-3 py-1 text-xs font-extrabold text-[#0B192C]">Próxima intervenção</span>
                  <span className="text-xs text-slate-300">Referência: #{proximoServico.id.substring(0, 8).toUpperCase()}</span>
                </div>
                <h2 id="marcacao-titulo" className="mt-3 text-xl font-extrabold sm:text-2xl">
                  {proximoServico.service_type}
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#00D4FF] sm:text-base">
                  <span aria-hidden="true">▦</span> {data} · {horario}
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/10 pt-4 lg:mt-0 lg:block lg:min-w-40 lg:border-0 lg:pt-0 lg:text-right">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Valor da marcação</p>
                  <p className="mt-1 text-3xl font-black text-[#00D4FF]">{formatarPreco(proximoServico.total_amount)}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300 lg:mt-2">
                  <span aria-hidden="true">✓</span> {proximoServico.status === "completed" ? "Concluído" : "Confirmada"}
                </span>
              </div>
            </div>

            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_1.2fr_0.9fr]">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Local da intervenção</h3>
                <p className="mt-2 text-sm font-semibold leading-6">{cliente?.address || "Morada não registada"}</p>
                <Link href="/cliente/perfil" className="mt-2 inline-block text-sm font-semibold text-sky-700 hover:underline">Alterar morada</Link>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Serviços incluídos</h3>
                <ul className="mt-2 space-y-2">
                  <li className="flex gap-2 text-sm text-slate-700">
                    <span className="font-black text-emerald-600" aria-hidden="true">✓</span>{proximoServico.service_type}
                  </li>
                  {proximoServico.notes && (
                    <li className="flex gap-2 text-sm text-slate-700">
                      <span className="font-black text-emerald-600" aria-hidden="true">✓</span>{proximoServico.notes}
                    </li>
                  )}
                </ul>
              </div>
              <div className="flex flex-col justify-center gap-3 lg:border-l lg:border-slate-100 lg:pl-6">
                <a href="#servicos-extra" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#00D4FF] px-4 py-3 text-sm font-extrabold text-[#0B192C] transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2">
                  + Adicionar serviços extra
                </a>
                <Link href="/cliente/pedidos" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500">
                  Gerir marcação
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            <h2 className="text-lg font-bold text-[#0B192C] mb-4">Não tem serviços agendados</h2>
            <p className="text-slate-600 text-sm mb-6">
              Neste momento não tem nenhuma limpeza agendada. Pode solicitar um novo serviço abaixo.
            </p>
            <Link href="/cliente/extras" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B192C] px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition shadow-sm">
              <span>+ Solicitar serviço</span>
            </Link>
          </section>
        )}

        <section aria-label="Acesso rápido" className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[
            { href: "#servicos-extra", icon: "✦", title: "Serviços extra", text: "Personalize a sua limpeza" },
            { href: "/cliente/pedidos", icon: "▤", title: "Marcações", text: "Consulte o seu histórico" },
            { href: "/cliente/loja", icon: "🛒", title: "Loja", text: "Produtos de manutenção" },
            { href: "#apoio", icon: "☏", title: "Apoio ao cliente", text: "Estamos aqui para ajudar" },
          ].map((atalho) => (
            <a key={atalho.title} href={atalho.href} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#00D4FF] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 sm:p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-lg text-sky-800 transition group-hover:bg-[#00D4FF]" aria-hidden="true">{atalho.icon}</span>
              <h3 className="mt-3 text-sm font-extrabold">{atalho.title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">{atalho.text}</p>
            </a>
          ))}
        </section>

        <section id="servicos-extra" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Personalize a sua visita</p>
              <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">Serviços adicionais</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Selecione os serviços que pretende acrescentar. O total estimado é atualizado automaticamente.</p>
            </div>
            {extraSelecionado.length > 0 && (
              <button type="button" onClick={() => { setExtraSelecionado([]); setMensagem(""); }} className="self-start text-sm font-semibold text-slate-600 underline underline-offset-4 hover:text-slate-900 sm:self-auto">
                Limpar seleção
              </button>
            )}
          </div>

          {mensagem && (
            <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              {mensagem}
            </div>
          )}

          {servicosExtra.length === 0 ? (
            <div className="mt-6 bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center text-sm text-slate-600">
              Nenhum serviço extra disponível neste momento.
            </div>
          ) : (
            <form onSubmit={submeterPedido} className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {servicosExtra.map((item) => {
                  const selecionado = extraSelecionado.includes(item.id);
                  return (
                    <label key={item.id} className={`flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-0.5 hover:shadow-md ${selecionado ? "border-sky-500 ring-2 ring-sky-100" : "border-slate-200"}`}>
                      <input
                        type="checkbox"
                        checked={selecionado}
                        onChange={() => alternarExtra(item.id)}
                        className="peer sr-only"
                      />
                      <span className="relative block h-40 overflow-hidden bg-slate-100">
                        <img src={item.imagem} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 hover:scale-105" />
                        <span className="absolute right-3 top-3 rounded-lg bg-[#0B192C] px-2.5 py-1.5 text-sm font-extrabold text-[#00D4FF]">{formatarPreco(item.preco)}</span>
                        {selecionado && <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">Selecionado ✓</span>}
                      </span>
                      <span className="flex flex-1 flex-col p-4">
                        <span className="font-bold">{item.titulo}</span>
                        <span className="mt-1 flex-1 text-sm leading-5 text-slate-600">{item.desc}</span>
                        <span className={`mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-sm font-bold transition ${selecionado ? "border-[#0B192C] bg-[#0B192C] text-white" : "border-slate-300 bg-slate-50 text-[#0B192C]"}`}>
                          {selecionado ? "✓ Adicionado" : "+ Adicionar"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {extraSelecionado.length > 0 && (
                <div className="mt-6 grid gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6 lg:grid-cols-[1fr_280px]">
                  <div>
                    <label htmlFor="observacoes" className="block text-sm font-bold">Instruções para a equipa <span className="font-normal text-slate-500">(opcional)</span></label>
                    <textarea
                      id="observacoes"
                      rows={3}
                      maxLength={500}
                      placeholder="Ex.: dar especial atenção ao interior do forno."
                      value={observacoes}
                      onChange={(event) => setObservacoes(event.target.value)}
                      className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                    <p className="mt-1 text-right text-xs text-slate-500">{observacoes.length}/500 caracteres</p>
                    <p className="mt-3 text-xs leading-5 text-slate-500">O pedido só fica confirmado depois de ser submetido e validado pela equipa R&R Services.</p>
                  </div>
                  <div className="flex flex-col justify-between rounded-xl bg-white p-4 ring-1 ring-slate-200">
                    <div>
                      <p className="text-sm font-bold">Resumo do pedido</p>
                      <p className="mt-3 text-sm text-slate-600">{extraSelecionado.length} {extraSelecionado.length === 1 ? "serviço selecionado" : "serviços selecionados"}</p>
                      <p className="mt-1 text-sm text-slate-600">Serviços extra <span className="float-right font-semibold text-[#0B192C]">{formatarPreco(totalExtras)}</span></p>
                      <div className="my-3 border-t border-slate-200" />
                      <p className="text-sm text-slate-600">Total estimado da visita</p>
                      <p className="mt-1 text-2xl font-black">{formatarPreco((proximoServico?.total_amount || 0) + totalExtras)}</p>
                      <p className="mt-1 text-xs text-slate-500">Valor base + serviços selecionados</p>
                    </div>
                    <button type="submit" className="mt-5 min-h-12 w-full rounded-xl bg-[#0B192C] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2">
                      Continuar pedido
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
        </section>

        {produtosLoja.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Cuidados em casa</p>
                <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">Produtos recomendados</h2>
                <p className="mt-1 text-sm text-slate-600">Essenciais para manter a sua casa cuidada entre visitas.</p>
              </div>
              <Link href="/cliente/loja" className="text-sm font-bold text-sky-700 hover:underline">Ver toda a loja →</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {produtosLoja.map((produto) => (
                <article key={produto.id} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:flex-col">
                  <img src={produto.imagem} alt="" loading="lazy" className="h-28 w-28 shrink-0 rounded-xl bg-slate-100 object-cover sm:h-44 sm:w-full" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="text-sm font-bold leading-5">{produto.nome}</h3>
                    <p className="mt-2 text-lg font-black">{formatarPreco(produto.preco)}</p>
                    <Link href="/cliente/loja" className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold transition hover:border-[#00D4FF] hover:bg-cyan-50 sm:mt-auto sm:pt-2">
                      Ver produto
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section id="apoio" className="scroll-mt-28 rounded-2xl bg-[#0B192C] p-5 text-white shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#00D4FF]">Conte connosco</p>
            <h2 className="mt-1 text-xl font-extrabold">Precisa de ajuda?</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Tem dúvidas sobre uma marcação ou precisa de ajustar algum detalhe? A nossa equipa está disponível para ajudar.</p>
          </div>
          <a href="mailto:rrservices.pt@gmail.com?subject=Pedido%20de%20apoio%20-%20R%26R%20Services" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#0B192C] transition hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-[#00D4FF] focus:ring-offset-2 focus:ring-offset-[#0B192C] sm:mt-0 sm:w-auto sm:shrink-0">
            Enviar mensagem
          </a>
        </section>
      </main>

      <ClientBottomNav />
      <footer className="border-t border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500">
        <p>© 2026 R&R Services. Todos os direitos reservados.</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link href="/privacidade" className="hover:text-sky-700 hover:underline">Privacidade</Link>
          <Link href="/termos" className="hover:text-sky-700 hover:underline">Termos e condições</Link>
        </div>
      </footer>
    </div>
  );
}
