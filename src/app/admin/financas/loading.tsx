export default function FinanceLoading() {
  return <main aria-label="A carregar dados financeiros" aria-busy="true" className="min-w-0 animate-pulse space-y-5 pb-12">
    <div className="h-14 rounded-2xl bg-slate-200" />
    <div className="h-64 rounded-2xl bg-[#061121]" />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-slate-200" />)}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="h-72 rounded-2xl bg-slate-200" />
      <div className="h-72 rounded-2xl bg-slate-200" />
    </div>
  </main>
}
