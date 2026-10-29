import { listWorkers } from './actions'
import FuncionariosManager from './funcionarios-manager'

export default async function FuncionariosPage() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  const initialMonth = `${parts.find((part) => part.type === 'year')?.value ?? '2026'}-${parts.find((part) => part.type === 'month')?.value ?? '01'}`
  const result = await listWorkers(initialMonth)
  return <FuncionariosManager initialWorkers={result.success ? result.data ?? [] : []} initialError={result.success ? '' : result.error} initialMonth={initialMonth} />
}
