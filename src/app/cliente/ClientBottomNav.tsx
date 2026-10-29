'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const destinations = [
  ["/cliente", "Início", "⌂"],
  ["/cliente/pedidos", "Pedidos", "▤"],
  ["/cliente/extras", "Extras", "+"],
  ["/cliente/loja", "Loja", "□"],
  ["/cliente/perfil", "Perfil", "○"],
];

export default function ClientBottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação do portal" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-200/80 bg-white/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-12px_36px_rgba(15,23,42,0.10)] backdrop-blur-xl xl:hidden">
      {destinations.map(([href, label, icon]) => {
        const active = pathname === href || (href !== "/cliente" && pathname.startsWith(`${href}/`));
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold transition-colors sm:text-[11px] ${active ? "bg-cyan-50 text-[#007F99]" : "text-slate-500 hover:bg-slate-50"}`}>
            <span aria-hidden="true" className="text-xl leading-5">{icon}</span>
            <span className="max-w-full truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
