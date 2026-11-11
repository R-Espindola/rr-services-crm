"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string | null;
  postal_code?: string | null;
  locality?: string | null;
  notes?: string | null;
  payment_terms?: string | null;
}

interface Order {
  id: string;
  client_id: string;
  service_type: string;
  scheduled_date: string | null;
  total_amount: number;
  status: string;
  payment_status?: string | null;
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
}

interface Product {
  id: string;
  nome: string;
  preco: number;
  imagem: string;
  description?: string | null;
}

interface ExtraCatalogRow {
  id: string;
  name: string;
  price: number | null;
  price_type: "fixed" | "per_unit" | "quote";
  image_url: string | null;
  description: string | null;
}

interface ProductCatalogRow {
  id: string;
  name: string;
  price: number | null;
  image_url: string | null;
  description: string | null;
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
  const [extraSelecionado, setExtraSelecionado] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [submittingExtra, setSubmittingExtra] = useState(false);

  // Estados de Avaliação
  const [rating, setRating] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackEnviado, setFeedbackEnviado] = useState(false);

  // Dados do cliente autenticado
  const [cliente, setCliente] = useState<Client | null>(null);
  const [proximoServico, setProximoServico] = useState<Order | null>(null);
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
        setError("Sessão não encontrada.");
        setLoading(false);
        return;
      }

      // 1. Carregar o perfil ligado ao ID autenticado
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, name, email, phone, address, postal_code, locality, notes, payment_terms")
        .eq("auth_user_id", user.id)
        .single();

      if (clientError || !clientData) {
        setError("Perfil de cliente não encontrado.");
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
        setError("Erro ao carregar serviços.");
        setLoading(false);
        return;
      }

      const orders = (ordersData || []) as Order[];
      const now = new Date();

      const proximo = orders.find(
        (o) =>
          (o.status === "pending" || o.status === "in_progress") &&
          o.scheduled_date &&
          new Date(o.scheduled_date) >= now
      );
      setProximoServico(proximo || null);

      const concluidos = orders
        .filter((o) => o.status === "completed")
        .sort(
          (a, b) =>
            new Date(b.scheduled_date || 0).getTime() -
            new Date(a.scheduled_date || 0).getTime()
        );
      setUltimoConcluido(concluidos[0] || null);

      // 3. Carregar orçamentos pendentes
      const { data: quotesData } = await supabase
        .from("quotes")
        .select("*")
        .eq("client_id", clientData.id)
        .in("status", ["pending", "sent"])
        .order("created_at", { ascending: false });

      if (quotesData) {
        setOrcamentosPendentes(quotesData as Quote[]);
      }

      // 4. Carregar serviços extra
      const { data: extrasData } = await supabase
        .from("services_catalog")
        .select("*")
        .eq("is_available", true)
        .order("category", { ascending: true });

      if (extrasData) {
        setServicosExtra(
          (extrasData as unknown as ExtraCatalogRow[]).map((item) => ({
            id: item.id,
            titulo: item.name,
            preco: item.price_type === "quote" ? 0 : item.price || 0,
            imagem: item.image_url || "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=700&q=85",
            desc: item.description || "Sem descrição detalhada.",
          }))
        );
      }

      // 5. Carregar produtos da loja
      const { data: productsData } = await supabase
        .from("products")
        .select("*")
        .eq("is_available", true)
        .gt("stock_quantity", 0)
        .order("name", { ascending: true });

      if (productsData) {
        setProdutosLoja(
          (productsData as unknown as ProductCatalogRow[]).map((item) => ({
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
    const initialLoad = window.setTimeout(() => void carregarDados(), 0);
    return () => window.clearTimeout(initialLoad);
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

  async function submeterPedido(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (extraSelecionado.length === 0 || !cliente || !proximoServico) return;

    setSubmittingExtra(true);
    setMensagem("");

    try {
      const nomesExtras = extrasEscolhidos.map(e => e.titulo).join(", ");
      const notasCompletas = `Serviço extra solicitado pelo cliente: ${nomesExtras}. Obs: ${observacoes}`;
      const novoTotal = Number(proximoServico.total_amount) + totalExtras;

      // Atualiza a ordem atual com o novo valor e as notas dos extras
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          total_amount: novoTotal,
          notes: proximoServico.notes ? `${proximoServico.notes} | ${notasCompletas}` : notasCompletas
        })
        .eq("id", proximoServico.id);

      if (updateError) throw updateError;

      setMensagem("Sucesso! Os serviços extra foram acrescentados à sua próxima visita.");
      setExtraSelecionado([]);
      setObservacoes("");
      await carregarDados();
    } catch (err: unknown) {
      const errorMessage = err && typeof err === "object" && "message" in err
        ? String(err.message)
        : "Tente novamente.";
      setMensagem("Erro ao submeter o pedido: " + errorMessage);
    } finally {
      setSubmittingExtra(false);
    }
  }

  async function enviarFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!ultimoConcluido || !cliente) return;

    try {
      // Regista feedback nas notas da ordem ou numa tabela dedicada se existir
      await supabase
        .from("orders")
        .update({ notes: `${ultimoConcluido.notes || ''} [Avaliação do cliente: ${rating}⭐ - "${feedbackText}"]` })
        .eq("id", ultimoConcluido.id);

      setFeedbackEnviado(true);
    } catch {
      alert("Erro ao enviar avaliação.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh overflow-x-hidden bg-[#F5F7FA] text-[#0B192C]">
        <main className="mx-auto max-w-7xl px-4 py-20 text-center text-slate-400 font-medium">
          A carregar o seu portal...
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh overflow-x-hidden bg-[#F5F7FA] text-[#0B192C]">
        <main className="mx-auto max-w-7xl px-4 py-20">
          <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-center text-red-800 text-sm font-medium">
            {error}
          </div>
        </main>
      </div>
    );
  }

  const nomeCurto = cliente?.name?.split(" ")[0] || "Cliente";

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#F5F7FA] text-[#0B192C]">
      <main id="conteudo" className="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-12 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
        
        {/* CABEÇALHO */}
        <section className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-sky-800">
              A sua área pessoal
            </span>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl text-[#0B192C]">
              Olá, {nomeCurto} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Consulte a sua próxima visita, personalize serviços e acompanhe o estado da sua conta.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/cliente/perfil" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold transition hover:border-[#00D4FF] hover:bg-cyan-50 shadow-xs">
              ⚙️ Gerir perfil e morada
            </Link>
          </div>
        </section>

        {/* ALERTA DE ORÇAMENTOS PENDENTES (NOVO RECURSO) */}
        {orcamentosPendentes.length > 0 && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-200/60 px-2.5 py-1 rounded-full">Proposta Pendente</span>
                <h2 className="text-base font-black text-amber-950 mt-2">Tem {orcamentosPendentes.length} orçamento(s) a aguardar aprovação</h2>
                <p className="text-xs text-amber-900 mt-0.5">Reveza os detalhes da proposta enviada pela R&R Services.</p>
              </div>
              <Link href="/cliente/pedidos" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition">
                Ver Proposta →
              </Link>
            </div>
          </section>
        )}

        {/* PRÓXIMO SERVIÇO */}
        {proximoServico ? (
          <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            <div className="bg-[#0B192C] p-6 text-white sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#00D4FF] px-3.5 py-1 text-[11px] font-black text-[#0B192C]">Próxima intervenção</span>
                  <span className="text-xs text-slate-300 font-mono">Ref: #{proximoServico.id.substring(0, 8).toUpperCase()}</span>
                </div>
                <h2 className="mt-3 text-xl font-black sm:text-2xl text-white">
                  {proximoServico.service_type}
                </h2>
                <p className="mt-2 text-sm font-extrabold text-[#00D4FF] sm:text-base flex items-center gap-1.5">
                  <span>🗓️</span> {data} às {horario}
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/10 pt-4 lg:mt-0 lg:block lg:text-right">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Valor da marcação</p>
                  <p className="mt-1 text-2xl sm:text-3xl font-black text-[#00D4FF]">{formatarPreco(proximoServico.total_amount)}</p>
                </div>
                <div className="mt-2">
                  {cliente?.payment_terms === 'monthly_invoice' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-300 border border-sky-500/20">
                      📅 Faturação Mensal (Fim do Mês)
                    </span>
                  ) : proximoServico.payment_status === 'paid' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 border border-emerald-500/20">
                      ✓ Pago
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 border border-amber-500/20">
                      ⏳ Pagamento no local / por serviço
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_1.2fr_0.9fr]">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Local da intervenção</h3>
                <p className="mt-2 text-xs sm:text-sm font-bold text-[#0B192C] leading-relaxed">
                  {[cliente?.address, cliente?.postal_code, cliente?.locality].filter(Boolean).join(", ") || "Morada não registada"}
                </p>
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Detalhes associados</h3>
                <p className="mt-2 text-xs sm:text-sm font-medium text-slate-600">
                  {proximoServico.notes || "Nenhuma observação especial registada para esta visita."}
                </p>
              </div>
              <div className="flex flex-col justify-center gap-2.5 lg:border-l lg:border-slate-100 lg:pl-6">
                <a href="#servicos-extra" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00D4FF] px-4 py-2.5 text-xs font-black text-[#0B192C] transition hover:bg-[#00c2ea] shadow-sm">
                  + Adicionar Serviços Extra
                </a>
                <Link href="/cliente/pedidos" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
                  Ver Histórico de Marcações
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm text-center space-y-3">
            <h2 className="text-lg font-black text-[#0B192C]">Sem serviços agendados de momento</h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Precisa de uma nova limpeza ou manutenção? Solicite um orçamento ou adicione serviços extra agora mesmo.
            </p>
            <Link href="/cliente/pedidos" className="inline-flex items-center justify-center rounded-2xl bg-[#0B192C] px-5 py-3 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm">
              Agendar Novo Serviço
            </Link>
          </section>
        )}

        {/* ATALHOS RÁPIDOS */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { href: "#servicos-extra", icon: "✦", title: "Serviços extra", text: "Personalize a visita" },
            { href: "/cliente/pedidos", icon: "▤", title: "Marcações", text: "Histórico completo" },
            { href: "/cliente/loja", icon: "🛒", title: "Loja de produtos", text: "Manutenção em casa" },
            { href: "#apoio", icon: "☏", title: "Apoio direto", text: "Fale connosco" },
          ].map((atalho) => (
            <a key={atalho.title} href={atalho.href} className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-[#00D4FF] hover:shadow-lg">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-base text-sky-800 transition group-hover:bg-[#00D4FF]">{atalho.icon}</span>
              <h3 className="mt-3 text-xs sm:text-sm font-black text-[#0B192C]">{atalho.title}</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">{atalho.text}</p>
            </a>
          ))}
        </section>

        {/* SECÇÃO DE AVALIAÇÃO DO ÚLTIMO SERVIÇO (NOVO RECURSO) */}
        {ultimoConcluido && !feedbackEnviado && (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">Último Serviço Concluído</span>
                <h3 className="text-base font-black text-[#0B192C] mt-2">Como avalia a limpeza de “{ultimoConcluido.service_type}”?</h3>
              </div>
            </div>
            <form onSubmit={enviarFeedback} className="space-y-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`text-2xl transition ${star <= rating ? 'text-amber-400 scale-110' : 'text-slate-200'}`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-2 text-xs font-extrabold text-slate-600">{rating} de 5 estrelas</span>
              </div>
              <div>
                <textarea
                  rows={2}
                  placeholder="Deixe um comentário ou sugestão sobre a equipa..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF]"
                />
              </div>
              <button type="submit" className="bg-[#0B192C] text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-slate-800 transition">
                Submeter Avaliação
              </button>
            </form>
          </section>
        )}

        {feedbackEnviado && (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center text-xs font-bold text-emerald-800 shadow-sm">
            Obrigado pelo seu feedback! A sua avaliação foi registada com sucesso. 🎉
          </section>
        )}

        {/* SERVIÇOS ADICIONAIS / EXTRA */}
        <section id="servicos-extra" className="scroll-mt-28 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full">Personalize a visita</span>
              <h2 className="mt-2 text-xl font-black text-[#0B192C]">Serviços adicionais disponíveis</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">Selecione os extras que pretende acrescentar à sua próxima limpeza agendada.</p>
            </div>
            {extraSelecionado.length > 0 && (
              <button type="button" onClick={() => { setExtraSelecionado([]); setMensagem(""); }} className="text-xs font-bold text-rose-600 hover:underline">
                Limpar seleção
              </button>
            )}
          </div>

          {mensagem && (
            <div role="status" className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-xs font-bold text-cyan-900">
              {mensagem}
            </div>
          )}

          {servicosExtra.length === 0 ? (
            <div className="bg-slate-50 p-6 rounded-2xl text-center text-xs text-slate-400 font-bold">
              Nenhum serviço extra disponível neste momento.
            </div>
          ) : (
            <form onSubmit={submeterPedido} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {servicosExtra.map((item) => {
                  const selecionado = extraSelecionado.includes(item.id);
                  return (
                    <label key={item.id} className={`flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white transition hover:shadow-md ${selecionado ? "border-[#00D4FF] ring-2 ring-[#00D4FF]/20 shadow-sm" : "border-slate-200/80"}`}>
                      <input
                        type="checkbox"
                        checked={selecionado}
                        onChange={() => alternarExtra(item.id)}
                        className="peer sr-only"
                      />
                      <span className="relative block h-36 overflow-hidden bg-slate-100">
                        <Image src={item.imagem} alt={item.titulo} fill unoptimized sizes="(min-width: 1280px) 25vw, 50vw" className="object-cover transition duration-300 hover:scale-105" />
                        <span className="absolute right-3 top-3 rounded-xl bg-[#0B192C] px-2.5 py-1 text-xs font-black text-[#00D4FF] shadow-xs">{formatarPreco(item.preco)}</span>
                        {selecionado && <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs">Selecionado ✓</span>}
                      </span>
                      <span className="flex flex-1 flex-col p-4">
                        <span className="font-extrabold text-xs text-[#0B192C]">{item.titulo}</span>
                        <span className="mt-1 flex-1 text-[11px] text-slate-500 leading-normal">{item.desc}</span>
                        <span className={`mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold transition ${selecionado ? "border-[#0B192C] bg-[#0B192C] text-white" : "border-slate-200 bg-slate-50 text-[#0B192C]"}`}>
                          {selecionado ? "✓ Adicionado" : "+ Adicionar"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {extraSelecionado.length > 0 && (
                <div className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-[1fr_280px]">
                  <div>
                    <label htmlFor="observacoes" className="block text-xs font-bold uppercase text-slate-700">Instruções para a equipa (opcional)</label>
                    <textarea
                      id="observacoes"
                      rows={3}
                      maxLength={500}
                      placeholder="Ex.: dar especial atenção ao interior do forno ou janelas da sala."
                      value={observacoes}
                      onChange={(event) => setObservacoes(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs outline-none focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF]"
                    />
                    <p className="mt-1 text-right text-[10px] text-slate-400">{observacoes.length}/500 caracteres</p>
                  </div>
                  <div className="flex flex-col justify-between rounded-2xl bg-white p-4 border border-slate-200/80 shadow-2xs">
                    <div>
                      <p className="text-xs font-black uppercase text-slate-400">Resumo do acréscimo</p>
                      <p className="mt-2 text-xs font-semibold text-slate-600">{extraSelecionado.length} {extraSelecionado.length === 1 ? "extra selecionado" : "extras selecionados"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-600">Valor extra <span className="float-right font-black text-[#0B192C]">{formatarPreco(totalExtras)}</span></p>
                      <div className="my-2.5 border-t border-slate-100" />
                      <p className="text-xs font-bold text-[#0B192C]">Total estimado da visita</p>
                      <p className="mt-0.5 text-xl font-black text-[#00D4FF]">{formatarPreco((proximoServico?.total_amount || 0) + totalExtras)}</p>
                    </div>
                    <button 
                      type="submit" 
                      disabled={submittingExtra || !proximoServico} 
                      className="mt-4 min-h-11 w-full rounded-xl bg-[#0B192C] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      {submittingExtra ? 'A atualizar...' : 'Confirmar e Adicionar à Visita'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
        </section>

        {/* PRODUTOS DA LOJA RECOMENDADOS */}
        {produtosLoja.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full">Cuidados em casa</span>
                <h2 className="mt-2 text-xl font-black text-[#0B192C]">Produtos recomendados</h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">Mantenha a sua casa limpa e protegida entre as nossas visitas.</p>
              </div>
              <Link href="/cliente/loja" className="text-xs font-extrabold text-sky-700 hover:underline">Ver toda a loja →</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {produtosLoja.slice(0, 3).map((produto) => (
                <article key={produto.id} className="flex gap-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md sm:flex-col">
                  <Image src={produto.imagem} alt={produto.nome} width={320} height={320} unoptimized className="h-28 w-28 shrink-0 rounded-2xl bg-slate-100 object-cover sm:h-40 sm:w-full" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="text-xs font-black text-[#0B192C] leading-snug">{produto.nome}</h3>
                    <p className="mt-2 text-base font-black text-[#0B192C]">{formatarPreco(produto.preco)}</p>
                    <Link href="/cliente/loja" className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-[#00D4FF] hover:bg-cyan-50 sm:mt-auto">
                      Comprar na Loja
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* APOIO AO CLIENTE */}
        <section id="apoio" className="scroll-mt-28 rounded-3xl bg-[#0B192C] p-6 sm:p-8 text-white shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <span className="rounded-full bg-[#00D4FF]/20 text-[#00D4FF] px-3 py-1 text-[10px] font-black uppercase tracking-wider">Conte connosco</span>
            <h2 className="mt-2 text-xl font-black">Precisa de suporte personalizado?</h2>
            <p className="mt-1 max-w-xl text-xs sm:text-sm text-slate-300">Tem dúvidas sobre uma marcação, horário ou faturação? A nossa equipa responde rapidamente.</p>
          </div>
          <a href="mailto:rrservices.pt@gmail.com?subject=Pedido%20de%20apoio%20-%20R%26R%20Services" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-5 py-3 text-xs font-extrabold text-[#0B192C] transition hover:bg-cyan-50 sm:mt-0 sm:shrink-0 shadow-sm">
            Enviar Mensagem à Equipa
          </a>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400 font-medium">
        <p>© 2026 R&R Services. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
