"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelarMarcacao, reagendarMarcacao } from "../actions";
import type { CalendarOrder } from "./OrdersCalendar";

export default function BookingActions({ order }: { order: CalendarOrder }) {
  const router = useRouter();
  const [open, setOpen] = useState<"reschedule" | "cancel" | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!["pending", "confirmed"].includes(order.status)) return null;

  function submitReschedule() {
    if (!scheduledDate) return;
    setMessage("");
    startTransition(async () => {
      const result = await reagendarMarcacao({ orderId: order.id, scheduledDate: new Date(scheduledDate).toISOString() });
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      setMessage("Marcação reagendada com sucesso.");
      setOpen(null);
      router.refresh();
    });
  }

  function submitCancel(confirmLateCancellation = false) {
    setMessage("");
    startTransition(async () => {
      const result = await cancelarMarcacao({
        orderId: order.id,
        confirmLateCancellation,
        reason: "Cancelamento solicitado pelo cliente",
      });
      if (!result.success && result.code === "LATE_CANCELLATION" && window.confirm(result.error + "\n\nPretende confirmar o cancelamento?")) {
        submitCancel(true);
        return;
      }
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      setMessage(result.data.lateFeeApplied ? "Cancelamento registado. A equipa poderá aplicar uma taxa de cancelamento tardio." : "Marcação cancelada.");
      setOpen(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen(open === "reschedule" ? null : "reschedule")} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
          Reagendar
        </button>
        <button type="button" onClick={() => setOpen(open === "cancel" ? null : "cancel")} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-200 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50">
          Cancelar
        </button>
      </div>
      {open === "reschedule" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500" htmlFor={"reschedule-" + order.id}>Nova data e hora</label>
          <input id={"reschedule-" + order.id} type="datetime-local" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800" />
          <button type="button" disabled={!scheduledDate || isPending} onClick={submitReschedule} className="mt-2 min-h-11 w-full rounded-lg bg-[#0B192C] px-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50">
            {isPending ? "A guardar..." : "Confirmar nova data"}
          </button>
        </div>
      )}
      {open === "cancel" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs leading-5 text-rose-900">O cancelamento com menos de 24 horas de antecedência pode ter uma taxa associada.</p>
          <button type="button" disabled={isPending} onClick={() => submitCancel()} className="mt-2 min-h-11 w-full rounded-lg bg-rose-700 px-3 text-xs font-bold text-white transition hover:bg-rose-800 disabled:opacity-50">
            {isPending ? "A cancelar..." : "Confirmar cancelamento"}
          </button>
        </div>
      )}
      {message && <p role="status" className="text-xs font-semibold text-slate-600">{message}</p>}
    </div>
  );
}

