import { AtendimentoCentral } from './AtendimentoCentral'
import { requireSession } from '@/lib/auth/session'

export const metadata = {
  title: 'Iniciar Atendimento | OptoMax',
}

export default async function AtendimentoPage() {
  await requireSession()

  return (
    <div className="pb-10">
      <AtendimentoCentral />
    </div>
  )
}
