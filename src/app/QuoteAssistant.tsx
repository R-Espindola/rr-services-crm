"use client";

import { useMemo, useState } from "react";

type SpaceType = "residencial" | "comercial";
type ServiceType = "residencial_regular" | "profunda" | "estofos" | "pos_obra";
type Typology = "t1" | "t2" | "t3" | "t4_plus" | "comercial";

const services: { id: ServiceType; title: string; description: string; icon: string }[] = [
  { id: "residencial_regular", title: "Limpeza de manutenção / regular", description: "Para manter o espaço cuidado ao longo do tempo.", icon: "🧹" },
  { id: "profunda", title: "Limpeza profunda", description: "Uma intervenção detalhada, do chão aos pontos difíceis.", icon: "✨" },
  { id: "estofos", title: "Higienização de estofos", description: "Sofás, colchões, cadeiras e outras peças estofadas.", icon: "🛋️" },
  { id: "pos_obra", title: "Limpeza pós-obra", description: "Remoção de pó e resíduos após obras ou remodelações.", icon: "🏗️" },
];

const spaces: { id: SpaceType; title: string; description: string; icon: string }[] = [
  { id: "residencial", title: "Espaço residencial", description: "Apartamento, moradia ou alojamento.", icon: "🏠" },
  { id: "comercial", title: "Espaço comercial / escritório", description: "Loja, escritório ou instalação empresarial.", icon: "🏢" },
];

const typologies: { id: Typology; title: string; detail: string }[] = [
  { id: "t1", title: "T0 / T1", detail: "Até 1 quarto" },
  { id: "t2", title: "T2", detail: "2 quartos" },
  { id: "t3", title: "T3", detail: "3 quartos" },
  { id: "t4_plus", title: "T4 ou superior", detail: "4+ quartos / moradia" },
];

const extras = ["Vidros & Estores", "Interior do Forno", "Interior do Frigorífico", "Limpeza de Varandas", "Passagem de Roupa"];
const frequencies = [
  { id: "pontual", label: "Pontual" },
  { id: "semanal", label: "Semanal" },
  { id: "quinzenal", label: "Quinzenal" },
  { id: "mensal", label: "Mensal" },
];

export default function QuoteAssistant() {
  const [step, setStep] = useState(1);
  const [space, setSpace] = useState<SpaceType | null>(null);
  const [service, setService] = useState<ServiceType | null>(null);
  const [typology, setTypology] = useState<Typology>("t2");
  const [pieceCount, setPieceCount] = useState(1);
  const [commercialArea, setCommercialArea] = useState("");
  const [frequency, setFrequency] = useState("pontual");
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [details, setDetails] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ reference: string; total: number } | null>(null);

  const selectedService = services.find((item) => item.id === service);
  const detailTypology: Typology = useMemo(() => {
    if (service === "estofos") {
      if (pieceCount <= 2) return "t1";
      if (pieceCount <= 4) return "t2";
      if (pieceCount <= 6) return "t3";
      return "t4_plus";
    }
    return space === "comercial" ? "comercial" : typology;
  }, [pieceCount, service, space, typology]);

  function toggleExtra(extra: string) {
    setSelectedExtras((current) => current.includes(extra) ? current.filter((item) => item !== extra) : [...current, extra]);
  }

  async function submitLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!service || !space) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/orcamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: name,
          email,
          telefone: phone,
          tipoServico: service,
          tipoEspaco: space,
          tipologia: detailTypology,
          frequencia: service === "residencial_regular" ? frequency : "pontual",
          servicosAdicionais: selectedExtras,
          observacoes: [
            details.trim(),
            service === "estofos" ? `Quantidade de peças: ${pieceCount}` : "",
            space === "comercial" ? `Área aproximada: ${commercialArea || "não indicada"} m²` : "",
          ].filter(Boolean).join(" | "),
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== "object" || !("reference" in payload) || !("total" in payload)) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Não foi possível guardar o pedido. Tente novamente.";
        throw new Error(message);
      }
      setResult({ reference: String(payload.reference), total: Number(payload.total) });
      setStep(5);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar o pedido. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const serviceLabel = selectedService?.title ?? "Serviço de limpeza";
  const estimate = result ? new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(result.total) : "";
  const whatsappText = encodeURIComponent(
    `Olá, R&R Services! Gostaria de falar sobre este pedido de orçamento.\n\n` +
    `Nome: ${name}\nEspaço: ${space === "comercial" ? "Comercial / escritório" : "Residencial"}\n` +
    `Serviço: ${serviceLabel}\nDimensão: ${service === "estofos" ? `${pieceCount} peça(s)` : space === "comercial" ? `${commercialArea || "Não indicada"} m²` : typologies.find((item) => item.id === typology)?.title}\n` +
    `Frequência: ${service === "residencial_regular" ? frequencies.find((item) => item.id === frequency)?.label : "Pontual"}\n` +
    `Estimativa indicativa: ${estimate}\nReferência: ${result?.reference}\n` +
    `Contacto: ${phone}${details.trim() ? `\nDetalhes: ${details.trim()}` : ""}`
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
      <div className="lg:sticky lg:top-28">
        <span className="inline-flex rounded-full border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-[#0B192C]">Assistente R&amp;R</span>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-[#0B192C] sm:text-4xl">Encontre o serviço ideal para si.</h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600 sm:text-base">Responda a algumas perguntas rápidas. A nossa equipa recebe os detalhes e confirma a proposta consigo.</p>
        <div className="mt-7 grid grid-cols-4 gap-2" aria-label={`Passo ${Math.min(step, 4)} de 4`}>
          {[1, 2, 3, 4].map((number) => <div key={number} className={`h-1.5 rounded-full ${step >= number ? "bg-[#00D4FF]" : "bg-slate-200"}`} />)}
        </div>
        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-500">{step < 5 ? `Passo ${step} de 4` : "Recomendação pronta"}</p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-7">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#0B192C] text-lg text-[#00D4FF]">R&amp;R</div>
          <div><p className="text-sm font-extrabold text-[#0B192C]">Assistente de Serviços</p><p className="text-xs text-slate-500">Vamos preparar a melhor recomendação</p></div>
          <span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">● Online</span>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          {step === 1 && <>
            <Prompt>Que tipo de espaço pretende cuidar?</Prompt>
            <div className="grid gap-3 sm:grid-cols-2">{spaces.map((item) => <button key={item.id} type="button" onClick={() => { setSpace(item.id); setStep(2); }} className="group min-h-28 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-[#00D4FF] hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"><span className="text-2xl">{item.icon}</span><span className="mt-2 block font-extrabold text-[#0B192C]">{item.title}</span><span className="mt-1 block text-xs text-slate-500">{item.description}</span></button>)}</div>
          </>}

          {step === 2 && <>
            <Prompt>Que tipo de serviço procura?</Prompt>
            <div className="grid gap-3 sm:grid-cols-2">{services.map((item) => <button key={item.id} type="button" onClick={() => { setService(item.id); setFrequency(item.id === "residencial_regular" ? "semanal" : "pontual"); setStep(3); }} className="min-h-24 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-[#00D4FF] hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"><span className="text-xl">{item.icon}</span><span className="mt-2 block text-sm font-extrabold text-[#0B192C]">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span></button>)}</div>
            <Back onClick={() => setStep(1)} />
          </>}

          {step === 3 && <>
            <Prompt>{service === "estofos" ? "Quantas peças pretende higienizar?" : space === "comercial" ? "Qual é a dimensão aproximada do espaço?" : "Qual é a dimensão da casa?"}</Prompt>
            {service === "estofos" ? <label className="block text-sm font-bold text-slate-700">Número de peças<input type="number" min={1} max={40} required value={pieceCount} onChange={(event) => setPieceCount(Math.max(1, Math.min(40, Number(event.target.value))))} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Considere cada sofá, colchão, cadeira ou peça como uma unidade.</span></label>
              : space === "comercial" ? <label className="block text-sm font-bold text-slate-700">Área aproximada (m²)<input type="number" min={1} max={100000} required value={commercialArea} onChange={(event) => setCommercialArea(event.target.value)} className={inputClass} placeholder="Ex.: 120" /></label>
              : <div className="grid grid-cols-2 gap-3">{typologies.map((item) => <button key={item.id} type="button" onClick={() => setTypology(item.id)} className={`min-h-16 rounded-2xl border p-3 text-left transition ${typology === item.id ? "border-[#00D4FF] bg-sky-50 ring-1 ring-[#00D4FF]" : "border-slate-200 hover:border-slate-300"}`}><span className="block text-sm font-extrabold text-[#0B192C]">{item.title}</span><span className="mt-1 block text-xs text-slate-500">{item.detail}</span></button>)}</div>}

            {service === "residencial_regular" && <div><p className="mb-2 text-sm font-bold text-slate-700">Com que frequência?</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{frequencies.map((item) => <button key={item.id} type="button" onClick={() => setFrequency(item.id)} className={`min-h-11 rounded-xl border px-2 text-xs font-bold transition ${frequency === item.id ? "border-[#0B192C] bg-[#0B192C] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}>{item.label}</button>)}</div></div>}
            <div><p className="mb-2 text-sm font-bold text-slate-700">Quer acrescentar algum detalhe?</p><div className="flex flex-wrap gap-2">{extras.map((extra) => <button key={extra} type="button" onClick={() => toggleExtra(extra)} className={`min-h-10 rounded-xl border px-3 text-xs font-semibold transition ${selectedExtras.includes(extra) ? "border-sky-300 bg-sky-50 text-sky-900" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>{selectedExtras.includes(extra) ? "✓ " : "+ "}{extra}</button>)}</div></div>
            <label className="block text-sm font-bold text-slate-700">Observações (opcional)<textarea rows={2} maxLength={1000} value={details} onChange={(event) => setDetails(event.target.value)} className={`${inputClass} resize-y`} placeholder="Conte-nos algo importante sobre o espaço..." /></label>
            <div className="flex items-center justify-between gap-3"><Back onClick={() => setStep(2)} /><button type="button" onClick={() => { setError(""); setStep(4); }} className={primaryButton}>Continuar <span aria-hidden="true">→</span></button></div>
          </>}

          {step === 4 && <form onSubmit={submitLead} className="space-y-4">
            <Prompt>Como podemos enviar a proposta?</Prompt>
            <p className="-mt-2 text-sm leading-5 text-slate-500">Deixe o seu contacto para a equipa confirmar os detalhes do serviço consigo.</p>
            <label className="block text-sm font-bold text-slate-700">Nome completo<input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="O seu nome" /></label>
            <label className="block text-sm font-bold text-slate-700">Telemóvel / WhatsApp<input required type="tel" minLength={9} maxLength={30} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} placeholder="912 345 678" /></label>
            <label className="block text-sm font-bold text-slate-700">E-mail<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="nome@exemplo.pt" /></label>
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <div className="flex items-center justify-between gap-3"><Back onClick={() => setStep(3)} /><button type="submit" disabled={busy} className={`${primaryButton} disabled:cursor-wait disabled:opacity-60`}>{busy ? "A enviar pedido…" : "Ver recomendação"}</button></div>
            <p className="text-center text-xs leading-5 text-slate-400">Ao continuar, autoriza a R&amp;R Services a usar estes dados para responder ao seu pedido.</p>
          </form>}

          {step === 5 && result && <div className="space-y-5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">Pedido registado · {result.reference}</p><h3 className="mt-2 text-2xl font-black text-[#0B192C]">A solução recomendada é {serviceLabel.toLowerCase()}.</h3><p className="mt-2 text-sm leading-6 text-slate-600">Com base nas respostas, a estimativa inicial é <strong className="text-[#0B192C]">{estimate}</strong>. O valor final será confirmado pela equipa após analisar o espaço e os detalhes.</p></div>
            <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm sm:grid-cols-2"><Summary label="Espaço" value={space === "comercial" ? "Comercial / escritório" : "Residencial"} /><Summary label="Serviço" value={serviceLabel} /><Summary label="Dimensão" value={service === "estofos" ? `${pieceCount} peça(s)` : space === "comercial" ? `${commercialArea} m²` : typologies.find((item) => item.id === typology)?.title ?? ""} /><Summary label="Frequência" value={service === "residencial_regular" ? frequencies.find((item) => item.id === frequency)?.label ?? "Pontual" : "Pontual"} /></div>
            <div className="grid gap-3 sm:grid-cols-2"><a href="/login?next=%2Fcliente&force=1" className={`${primaryButton} justify-center`}>Agendar no Portal</a><a href={`https://wa.me/351969177571?text=${whatsappText}`} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-600 px-5 text-sm font-extrabold text-white transition hover:bg-emerald-700">Falar no WhatsApp com este resumo</a></div>
            <button type="button" onClick={() => { setStep(1); setResult(null); setSpace(null); setService(null); }} className="min-h-11 w-full text-sm font-bold text-slate-500 hover:text-[#0B192C]">Iniciar novo pedido</button>
          </div>}
        </div>
      </div>
    </div>
  );
}

function Prompt({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-extrabold leading-7 text-[#0B192C] sm:text-xl">{children}</h3>;
}

function Back({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="min-h-11 rounded-xl px-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-[#0B192C]">← Voltar</button>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-800">{value}</p></div>;
}

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
const primaryButton = "inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#0B192C] px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-slate-800";
