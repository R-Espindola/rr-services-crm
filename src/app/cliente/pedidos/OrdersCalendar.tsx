"use client";

import { useMemo, useState } from "react";

export interface CalendarOrder {
  id: string;
  client_id: string;
  service_type: string;
  scheduled_date: string | null;
  total_amount: number;
  status: string;
  notes?: string | null;
  duration_minutes?: number | null;
  worker_user_id?: string | null;
  clients?: {
    name: string;
    phone: string;
    address?: string | null;
    postal_code?: string | null;
    locality?: string | null;
  };
  worker_profiles?: { display_name: string } | null;
}

const statusStyles: Record<string, { label: string; dot: string; badge: string }> = {
  pending: { label: "Pendente", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-800 ring-amber-200" },
  confirmed: { label: "Confirmada", dot: "bg-blue-500", badge: "bg-blue-50 text-blue-800 ring-blue-200" },
  in_progress: { label: "Em execução", dot: "bg-sky-500", badge: "bg-sky-50 text-sky-800 ring-sky-200" },
  completed: { label: "Concluída", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  cancelled: { label: "Cancelada", dot: "bg-rose-500", badge: "bg-rose-50 text-rose-800 ring-rose-200" },
};

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const orderDateKey = (value: string) => {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const formatDate = (date: Date) => new Intl.DateTimeFormat("pt-PT", { dateStyle: "full", timeZone: "Europe/Lisbon" }).format(date);
const formatTime = (value: string) => new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" }).format(new Date(value));
const formatAddress = (order: CalendarOrder) => [order.clients?.address, order.clients?.postal_code, order.clients?.locality].filter(Boolean).join(", ") || "Morada não registada";
const statusFor = (status: string) => statusStyles[status] ?? { label: status, dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700 ring-slate-200" };

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function toIcsUtc(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function calendarLinks(order: CalendarOrder) {
  if (!order.scheduled_date) return null;
  const start = new Date(order.scheduled_date);
  const duration = Number.isFinite(order.duration_minutes) && Number(order.duration_minutes) > 0 ? Number(order.duration_minutes) : 120;
  const end = new Date(start.getTime() + duration * 60_000);
  const address = formatAddress(order);
  const description = `Estado: ${statusFor(order.status).label}${order.notes ? `\nDetalhes: ${order.notes}` : ""}`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//R&R Services//Portal do Cliente//PT", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${escapeIcs(order.id)}@rrservices.pt`, `DTSTAMP:${toIcsUtc(new Date())}`, `DTSTART:${toIcsUtc(start)}`, `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcs(`R&R Services - ${order.service_type}`)}`, `DESCRIPTION:${escapeIcs(description)}`, `LOCATION:${escapeIcs(address)}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return {
    ics: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`,
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`R&R Services - ${order.service_type}`)}&dates=${toIcsUtc(start)}/${toIcsUtc(end)}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(address)}`,
  };
}

export default function OrdersCalendar({ orders }: { orders: CalendarOrder[] }) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const ordersByDate = useMemo(() => {
    const grouped = new Map<string, CalendarOrder[]>();
    for (const order of orders) {
      if (!order.scheduled_date) continue;
      const key = orderDateKey(order.scheduled_date);
      grouped.set(key, [...(grouped.get(key) ?? []), order]);
    }
    return grouped;
  }, [orders]);

  const days = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const gridStart = new Date(firstDay);
    gridStart.setDate(1 - ((firstDay.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [visibleMonth]);

  const selectedOrders = selectedDate ? ordersByDate.get(selectedDate) ?? [] : [];
  const selectedOrder = selectedOrders.find((order) => order.id === selectedOrderId) ?? (selectedOrders.length === 1 ? selectedOrders[0] : null);
  const selectedDateObject = selectedDate ? new Date(`${selectedDate}T12:00:00`) : null;
  const selectedDateLabel = selectedDateObject ? formatDate(selectedDateObject) : "";
  const requestNewCleaning = selectedDate
    ? `https://wa.me/351969177571?text=${encodeURIComponent(`Olá, R&R Services. Gostaria de solicitar uma nova limpeza para ${selectedDateLabel}.` )}`
    : "https://wa.me/351969177571?text=Olá, R%26R%20Services.%20Gostaria%20de%20solicitar%20uma%20nova%20limpeza.";
  const addExtraHref = selectedDate ? `/cliente/extras?data=${encodeURIComponent(selectedDate)}` : "/cliente/extras";

  function openDate(key: string) {
    setSelectedDate(key);
    const appointments = ordersByDate.get(key) ?? [];
    setSelectedOrderId(appointments.length === 1 ? appointments[0].id : null);
  }

  return (
    <>
      <section aria-label="Calendário das marcações" className="mb-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div><h2 className="text-lg font-extrabold text-[#0B192C]">Calendário de marcações</h2><p className="mt-1 text-xs text-slate-500">Selecione um dia para consultar os detalhes ou pedir um novo serviço.</p></div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <button type="button" aria-label="Mês anterior" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-lg font-bold text-slate-600 hover:bg-slate-50">‹</button>
            <p className="min-w-36 text-center text-sm font-extrabold capitalize text-[#0B192C]">{new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(visibleMonth)}</p>
            <button type="button" aria-label="Mês seguinte" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-lg font-bold text-slate-600 hover:bg-slate-50">›</button>
          </div>
        </header>

        <div className="p-2 sm:p-4">
          <div className="grid grid-cols-7">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => <div key={label} className="py-2 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-400 sm:text-xs">{label}</div>)}</div>
          <div className="grid grid-cols-7 overflow-hidden rounded-2xl border-l border-t border-slate-100">
            {days.map((day) => {
              const key = dateKey(day);
              const dayOrders = ordersByDate.get(key) ?? [];
              const inMonth = day.getMonth() === visibleMonth.getMonth();
              const isToday = key === dateKey(new Date());
              const uniqueStatuses = [...new Set(dayOrders.map((order) => order.status))].slice(0, 3);
              return <button key={key} type="button" onClick={() => openDate(key)} aria-label={`${formatDate(day)}${dayOrders.length ? `, ${dayOrders.length} marcação(ões)` : ", sem marcações"}`} className={`flex min-h-[58px] min-w-0 flex-col items-center border-b border-r border-slate-100 p-1 transition hover:bg-sky-50 sm:min-h-[78px] sm:p-2 ${inMonth ? "bg-white" : "bg-slate-50/70 text-slate-300"}`}>
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold sm:h-8 sm:w-8 ${isToday ? "bg-[#0B192C] text-white" : inMonth ? "text-slate-700" : "text-slate-300"}`}>{day.getDate()}</span>
                <span className="mt-1 flex min-h-2 items-center gap-1">{uniqueStatuses.map((status) => <span key={status} className={`h-1.5 w-1.5 rounded-full ${statusFor(status).dot}`} />)}{dayOrders.length > 3 && <span className="text-[9px] font-bold text-slate-500">+{dayOrders.length - 3}</span>}</span>
              </button>;
            })}
          </div>
        </div>
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-6">
          {["pending", "confirmed", "completed"].map((status) => <span key={status} className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-600"><span className={`h-2 w-2 rounded-full ${statusFor(status).dot}`} />{statusFor(status).label}</span>)}
          <span className="ml-auto text-[10px] text-slate-400">{orders.length} marcação(ões)</span>
        </footer>
      </section>

      {selectedDate && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setSelectedDate(null); setSelectedOrderId(null); } }}>
        <section role="dialog" aria-modal="true" aria-labelledby="calendar-dialog-title" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
          <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-sky-700">As minhas marcações</p><h2 id="calendar-dialog-title" className="mt-1 text-xl font-black capitalize text-[#0B192C]">{selectedDateLabel}</h2></div><button type="button" aria-label="Fechar detalhes" onClick={() => { setSelectedDate(null); setSelectedOrderId(null); }} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-xl text-slate-500 hover:bg-slate-50">×</button></header>
          {selectedOrders.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center"><p className="text-sm font-bold text-slate-700">Sem marcações neste dia.</p><p className="mt-1 text-xs text-slate-500">Pode falar connosco ou pedir um serviço extra para esta data.</p></div> : <div className="mt-5 space-y-3">{selectedOrders.map((order) => {
            const style = statusFor(order.status);
            const active = selectedOrder?.id === order.id;
            return <article key={order.id} className={`rounded-2xl border p-4 transition ${active ? "border-sky-300 bg-sky-50/50" : "border-slate-200 bg-white"}`}>
              <button type="button" onClick={() => setSelectedOrderId(active ? null : order.id)} className="flex w-full items-start justify-between gap-3 text-left"><span className="min-w-0"><span className="block text-xs font-bold text-slate-500">{order.scheduled_date ? formatTime(order.scheduled_date) : "Hora a confirmar"}</span><span className="mt-1 block break-words font-extrabold text-[#0B192C]">{order.service_type}</span></span><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ring-inset ${style.badge}`}>{style.label}</span></button>
              {active && <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 text-sm">
                <Detail label="Horário" value={order.scheduled_date ? formatTime(order.scheduled_date) : "A confirmar"} />
                <Detail label="Morada" value={formatAddress(order)} />
                <Detail label="Equipa atribuída" value={order.worker_profiles?.display_name ?? (order.worker_user_id ? "Equipa confirmada" : "A atribuir")} />
                <Detail label="Serviço e extras" value={order.notes?.trim() || "Sem extras ou observações registadas."} />
                <div className="flex flex-wrap gap-2 pt-1"><CalendarActions order={order} /><a href={requestNewCleaning} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Solicitar nova limpeza</a><a href={addExtraHref} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Adicionar serviço extra</a></div>
              </div>}
            </article>;
          })}</div>}
          {selectedOrders.length === 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2"><a href={requestNewCleaning} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0B192C] px-3 text-xs font-bold text-white hover:bg-slate-800">Solicitar nova limpeza</a><a href={addExtraHref} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Adicionar serviço extra</a></div>}
        </section>
      </div>}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 whitespace-pre-line break-words text-sm leading-5 text-slate-700">{value}</p></div>;
}

function CalendarActions({ order }: { order: CalendarOrder }) {
  const links = calendarLinks(order);
  if (!links) return <span className="inline-flex min-h-11 items-center rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-500">Data por confirmar</span>;
  return <><a href={links.ics} download={`rr-services-${order.id.slice(0, 8)}.ics`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0B192C] px-3 text-xs font-bold text-white hover:bg-slate-800">Adicionar ao calendário</a><a href={links.google} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Google Calendar</a></>;
}
