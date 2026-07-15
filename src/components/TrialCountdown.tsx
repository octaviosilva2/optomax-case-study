// Pill discreta que mostra dias restantes do período de teste da organização.
// Server component — lê trial_ends_at já carregado pelo cache de getSessionData.
//
// Regras:
//   - trial_ends_at NULL  → não renderiza
//   - faltam > 7 dias     → não renderiza (evita poluir)
//   - faltam 1-7 dias     → pill discreta primária ("Faltam N dias do seu teste")
//   - faltam <= 0 dias    → pill destrutiva ("Período de testes expirado")
//                           com link "Falar com a gente" (WhatsApp do Caio)

import { Clock } from 'lucide-react'
import { getSessionData } from '@/lib/auth/session'
import { ReportProblemButton } from '@/components/ReportProblemButton'
import { planoEhIlimitado } from '@/lib/utils/status'

export async function TrialCountdown() {
  const session = await getSessionData()
  // Plano admin = ilimitado → não mostra contagem de teste.
  if (planoEhIlimitado(session?.org?.plan)) return null
  const trialEndsAt = session?.org?.trial_ends_at
  if (!trialEndsAt) return null

  const now = Date.now()
  const end = new Date(trialEndsAt).getTime()
  const diasRestantes = Math.ceil((end - now) / (1000 * 60 * 60 * 24))

  // Mais de uma semana — não mostra nada.
  if (diasRestantes > 7) return null

  // Expirado.
  if (diasRestantes <= 0) {
    return (
      <span
        className={[
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
          'bg-destructive/10 text-destructive text-xs font-medium',
        ].join(' ')}
      >
        <Clock className="w-3 h-3" />
        Período de testes expirado
        <span className="opacity-60">·</span>
        <ReportProblemButton
          variant="inline"
          label="Falar com a gente"
          className="text-destructive"
        />
      </span>
    )
  }

  // Faltam 1-7 dias.
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'bg-primary/10 text-primary text-xs font-medium',
      ].join(' ')}
    >
      <Clock className="w-3 h-3" />
      Faltam {diasRestantes} {diasRestantes === 1 ? 'dia' : 'dias'} do seu teste
    </span>
  )
}

export default TrialCountdown
