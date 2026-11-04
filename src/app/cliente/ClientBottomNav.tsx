"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const clientDestinations = [
  ["/cliente", "Visão geral", "home"],
  ["/cliente/pedidos", "As minhas marcações", "calendar"],
  ["/cliente/extras", "Serviços extra", "sparkles"],
  ["/cliente/loja", "Loja", "store"],
  ["/cliente/perfil", "O meu perfil", "user"],
] as const;

export function NavigationIcon({ name }: { name: (typeof clientDestinations)[number][2] }) {
  const common = { className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24", "aria-hidden": true as const };
  if (name === "home") return <svg {...common}><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h3m-3 3h6" /></svg>;
  if (name === "sparkles") return <svg {...common}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14ZM5 3l.7 1.3L7 5l-1.3.7L5 7l-.7-1.3L3 5l1.3-.7L5 3Z" /></svg>;
  if (name === "store") return <svg {...common}><path d="M4 10v10h16V10M3 4h18l-1 6H4L3 4Z" /><path d="M9 20v-6h6v6M3 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 3 0" /></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>;
}

export default function ClientBottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal do cliente" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden">
      {clientDestinations.map(([href, label, icon]) => {
        const active = pathname === href || (href !== "/cliente" && pathname.startsWith(`${href}/`));
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-center transition ${active ? "text-sky-800" : "text-slate-500 hover:text-slate-800"}`}>
            <span className={`grid h-7 w-9 place-items-center rounded-xl transition ${active ? "bg-cyan-50 text-sky-800" : "text-current"}`}><NavigationIcon name={icon} /></span>
            <span className={`max-w-full text-[9px] font-bold leading-[1.1] sm:text-[10px] ${active ? "text-sky-800" : "text-slate-500"}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
