"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, ShoppingBag, Sparkles, UserRound } from "lucide-react";

export const clientDestinations = [
  ["/cliente", "Visão geral", "home"],
  ["/cliente/pedidos", "As minhas marcações", "calendar"],
  ["/cliente/extras", "Serviços extra", "sparkles"],
  ["/cliente/loja", "Loja", "store"],
  ["/cliente/perfil", "O meu perfil", "user"],
] as const;

export function NavigationIcon({ name }: { name: (typeof clientDestinations)[number][2] }) {
  const Icon = name === "home" ? House : name === "calendar" ? CalendarDays : name === "sparkles" ? Sparkles : name === "store" ? ShoppingBag : UserRound;
  return <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />;
}

export default function ClientBottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação principal do cliente" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-200/80 bg-white/90 px-1 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] shadow-[0_-12px_30px_rgba(15,23,42,0.1)] backdrop-blur-xl md:hidden">
      {clientDestinations.map(([href, label, icon]) => {
        const active = pathname === href || (href !== "/cliente" && pathname.startsWith(`${href}/`));
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`group flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border-t-2 px-0.5 text-center transition ${active ? "border-cyan-400 text-[#0B1B34]" : "border-transparent text-slate-500 hover:text-[#0B1B34]"}`}>
          <span className={`grid h-7 w-9 place-items-center rounded-xl transition ${active ? "bg-cyan-50 text-cyan-700" : "text-current group-hover:bg-slate-100"}`}><NavigationIcon name={icon} /></span>
          <span className={`max-w-full text-[9px] font-bold leading-[1.1] sm:text-[10px] ${active ? "text-[#0B1B34]" : "text-slate-500"}`}>{label}</span>
        </Link>;
      })}
    </nav>
  );
}
