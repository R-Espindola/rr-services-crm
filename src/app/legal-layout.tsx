import Link from "next/link";
import type { ReactNode } from "react";

export function LegalLayout({
  title,
  description,
  updatedAt = "31 de outubro de 2026",
  children,
}: {
  title: string;
  description: string;
  updatedAt?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
            <span className="text-2xl font-extrabold tracking-wide text-[#0B192C]">R&amp;R</span>
            <span className="text-lg font-semibold text-slate-600">Services</span>
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100">
            ← Voltar ao início
          </Link>
        </header>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 md:p-10">
          <div className="mb-8 border-b border-slate-200 pb-6">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">R&amp;R Services</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0B192C] sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600">{description}</p>
            <p className="mt-4 text-xs text-slate-500">Última atualização: {updatedAt}</p>
          </div>

          

          <div className="legal-copy space-y-8 text-[15px] leading-7 text-slate-700 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-[#0B192C] [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-bold [&_h3]:text-[#0B192C] [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_p+p]:mt-3 [&_ul]:space-y-1">
            {children}
          </div>

          <div className="mt-10 flex flex-wrap gap-3 border-t border-slate-200 pt-6 text-sm">
            <a href="mailto:rrservices.pt@gmail.com" className="font-semibold text-cyan-800 underline underline-offset-4">Contactar por e-mail</a>
            <Link href="/" className="font-semibold text-slate-600 underline underline-offset-4">Voltar ao início</Link>
          </div>
        </article>

        <footer className="py-6 text-center text-xs text-slate-500">
          © 2026 R&amp;R Services · <Link href="/privacidade" className="underline underline-offset-2">Privacidade</Link> · <Link href="/termos" className="underline underline-offset-2">Termos e condições</Link>
        </footer>
      </div>
    </main>
  );
}
