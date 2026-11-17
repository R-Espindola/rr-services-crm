'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { listAdminReviews, resolverOcorrencia, type AdminReview } from './actions'

export default function AdminOcorrenciasPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const result = await listAdminReviews()
    if (result.success) setReviews(result.data)
    else setError(result.error)
    setLoading(false)
  }
  useEffect(() => { void load() }, [])
  const openIssues = reviews.filter((review) => review.has_issue && review.issue_status === 'open')

  return <main className="space-y-6">
    <header><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-600">Pós-serviço</p><h1 className="mt-1 text-2xl font-black text-[#0B192C]">Ocorrências & Avaliações</h1><p className="mt-2 text-sm text-slate-500">Acompanhe o feedback dos clientes e resolva ocorrências pendentes.</p></header>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{openIssues.length} ocorrência(s) aberta(s)</div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p>}
    <section className="space-y-3">
      {loading ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">A carregar avaliações...</div> : reviews.length === 0 ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Ainda não existem avaliações.</div> : reviews.map((review) => <article key={review.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${review.has_issue && review.issue_status === 'open' ? 'border-amber-300' : 'border-slate-200'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-black text-[#0B192C]">{review.clientName}</h2><p className="text-xs text-slate-500">Trabalhador: {review.workerName} · {new Date(review.created_at).toLocaleDateString('pt-PT')}</p></div><span className="rounded-full bg-cyan-50 px-3 py-1 text-sm font-black text-cyan-800">{'★'.repeat(Math.max(0, Math.min(5, review.rating)))}{'☆'.repeat(Math.max(0, 5 - review.rating))}</span></div>
        {review.comment && <p className="mt-4 text-sm leading-6 text-slate-700">{review.comment}</p>}
        {review.has_issue && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-900">Ocorrência · {review.issue_status === 'open' ? 'Aberta' : 'Resolvida'}</p>{review.issue_description && <p className="mt-2 whitespace-pre-wrap text-sm text-amber-950">{review.issue_description}</p>}{review.photoUrls.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{review.photoUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer"><Image src={url} alt="Fotografia da ocorrência" width={240} height={160} unoptimized className="h-24 w-full rounded-lg object-cover" /></a>)}</div>}{review.issue_status === 'open' && <button type="button" onClick={async () => { const result = await resolverOcorrencia(review.id); if (result.success) setReviews((current) => current.map((item) => item.id === review.id ? { ...item, issue_status: 'resolved' } : item)) }} className="mt-4 min-h-11 rounded-xl bg-[#0B192C] px-4 text-xs font-black text-white">Marcar como Resolvida</button>}</div>}
      </article>)}
    </section>
  </main>
}
