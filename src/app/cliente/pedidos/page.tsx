"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ClientBottomNav from "@/app/cliente/ClientBottomNav";

interface Order {
  id: string;
  client_id: string;
  service_type: string;
  scheduled_date: string | null;
  total_amount: number;
  status: string;
  notes?: string | null;
  clients?: {
    name: string;
    phone: string;
    address?: string | null;
  };
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em Execu\u00e7\u00e3o",
  completed: "Conclu\u00eddo",
  cancelled: "Cancelado",
};

const STATUS_CLASSES: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border border-rose-200",
  in_progress: "bg-blue-50 text-blue-700 border border-blue-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "Sem data definida";
  return new Date(dateString).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPreco = (valor: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(valor);

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user?.email) {
        setError("Sess\u00e3o n\u00e3o encontrada. Inicie sess\u00e3o novamente.");
        setLoading(false);
        return;
      }

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, name, email, phone, address")
        .eq("email", session.user.email)
        .single();

      if (clientError || !clientData) {
        setError("Perfil de cliente n\u00e3o encontrado.");
        setLoading(false);
        return;
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*, clients(name, phone, address)")
        .eq("client_id", clientData.id)
        .order("scheduled_date", { ascending: false });

      if (ordersError) {
        setError("Erro ao carregar pedidos.");
        setLoading(false);
        return;
      }

      setOrders((ordersData || []) as Order[]);
    } catch {
      setError("Erro inesperado ao carregar pedidos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter((o) => {
    if (filterStatus === "todos") return true;
    return o.status === filterStatus;
  });

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#F5F7FA] pb-[calc(6rem+env(safe-area-inset-bottom))] text-[#0B192C] xl:pb-0">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0B192C] px-4 py-3 text-white shadow-lg sm:px-6 lg:px-8">
        <div className="flex items-center space-x-3">
          <div className="rounded-xl border border-[#00D4FF]/20 bg-[#00D4FF]/10 p-2">
            <span className="text-2xl font-bold tracking-wider text-[#00D4FF]">R&R</span>
          </div>
          <div>
            <span className="text-lg font-bold text-white block leading-none">Services</span>
            <span className="text-xs text-[#00D4FF]">Hist\u00f3rico de Pedidos</span>
          </div>
        </div>
        <Link
          href="/cliente"
          className="inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 sm:text-sm"
        >
          \u2190 Voltar ao Portal
        </Link>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        <div className="mb-7 sm:mb-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Portal do cliente</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0B192C] sm:text-3xl">
            Hist\u00f3rico de Pedidos e Interven\u00e7\u00f5es
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Consulte o estado das suas limpezas, servi\u00e7os extra e encomendas.
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 font-medium">
            A carregar pedidos...
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-center text-red-800 text-sm font-medium">
            {error}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
            {filterStatus !== "todos" ? (
              <>
                <p className="text-slate-600 font-medium text-lg">
                  Nenhum pedido encontrado com este estado.
                </p>
                <button
                  onClick={() => setFilterStatus("todos")}
                  className="mt-4 text-sm font-bold text-[#00D4FF] hover:underline"
                >
                  Ver todos os pedidos
                </button>
              </>
            ) : (
              <>
                <p className="text-slate-600 font-medium text-lg">
                  Ainda n\u00e3o tem pedidos registados.
                </p>
                <p className="text-slate-400 text-sm mt-2">
                  Os seus servi\u00e7os e interven\u00e7\u00f5es aparecer\u00e3o aqui assim que forem agendados.
                </p>
                <Link
                  href="/cliente/extras"
                  className="mt-6 inline-block bg-[#0B192C] text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition"
                >
                  Solicitar um servi\u00e7o
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-slate-500">
                  Filtrar por estado:
                </span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 sm:w-auto"
                >
                  <option value="todos">Todos os estados</option>
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em Execu\u00e7\u00e3o</option>
                  <option value="completed">Conclu\u00eddo</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <Link
                href="/cliente/extras"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#0B192C] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 sm:w-auto"
              >
                + Solicitar servi\u00e7o
              </Link>
            </div>

            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                  <tr>
                    <th className="p-4">Refer\u00eancia</th>
                    <th className="p-4">Servi\u00e7o</th>
                    <th className="p-4">Data e Hora</th>
                    <th className="p-4">Morada</th>
                    <th className="p-4">Valor</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-bold text-[#0B192C]">
                        #{order.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td className="p-4 text-slate-600 font-medium">
                        {order.service_type}
                      </td>
                      <td className="p-4 text-slate-600">
                        {formatDate(order.scheduled_date)}
                      </td>
                      <td className="p-4 text-slate-600 text-sm">
                        {order.clients?.address || "Morada n\u00e3o registada"}
                      </td>
                      <td className="p-4 font-extrabold text-[#0B192C]">
                        {formatPreco(order.total_amount || 0)}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${
                          STATUS_CLASSES[order.status] || STATUS_CLASSES.pending
                        }`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {order.notes ? (
                          <button
                            className="text-xs font-bold text-[#00D4FF] hover:underline cursor-pointer"
                          >
                            Ver detalhes
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Sem detalhes</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 lg:hidden">
              {filteredOrders.map((order) => (
                <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pedido #{order.id.substring(0, 8).toUpperCase()}</p>
                      <h2 className="mt-1 break-words text-base font-bold text-[#0B192C]">{order.service_type}</h2>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_CLASSES[order.status] || STATUS_CLASSES.pending}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                    <div><p className="text-xs font-medium text-slate-400">Data e hora</p><p className="mt-1 font-semibold text-slate-700">{formatDate(order.scheduled_date)}</p></div>
                    <div><p className="text-xs font-medium text-slate-400">Valor</p><p className="mt-1 font-extrabold text-[#0B192C]">{formatPreco(order.total_amount || 0)}</p></div>
                    <div className="col-span-2"><p className="text-xs font-medium text-slate-400">Morada</p><p className="mt-1 text-slate-700">{order.clients?.address || "Morada não registada"}</p></div>
                  </div>
                  {order.notes && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600">{order.notes}</p>}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    <ClientBottomNav />
    </div>
  );
}
