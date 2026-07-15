// Banner global que aparece quando o período gratuito (7 dias a partir
// do cadastro) já expirou. Decisão de produto (Octavio, 29/05/2026):
//   - Durante o período gratuito NÃO bloqueia o uso — o usuário continua mexendo no sistema.
//   - Mostra uma faixa persistente avisando que expirou e pedindo contato com
//     o suporte (WhatsApp do Caio, via ReportProblemButton).
//   - A contagem de "dias restantes" enquanto o trial está ativo fica só no
//     modal "Conta e plano" (não polui o header) — ver ModalConta.
//
// Server component: lê trial_ends_at de getSessionData (cache hit no layout).

import { AlertTriangle } from 'lucide-react'
import { getSessionData } from '@/lib/auth/session'
import { ReportProblemButton } from '@/components/ReportProblemButton'
import { planoEhIlimitado } from '@/lib/utils/status'

export async function BannerTrialExpirado() {
  const session = await getSessionData()
  const org = session?.org
  if (!org?.trial_ends_at) return null

  // Plano admin = acesso ilimitado, sem prazo → nunca mostra aviso de trial.
  if (planoEhIlimitado(org.plan)) return null

  // Org já em plano pago não vê aviso de trial.
  if (org.plan_status === 'active') return null

  // Paywall Fase 2: quando o trial já foi CORTADO ('expired'), quem fala é o
  // BannerPagamento (read-only). Este banner cobre só o PRÉ-corte — trial venceu
  // mas a org ainda está 'trialing' com acesso. Evita banner duplicado.
  if (org.plan_status === 'expired') return null

  const diasRestantes = Math.ceil(
    (new Date(org.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )

  // Só renderiza quando o período já expirou. Enquanto há dias restantes, o
  // aviso vive apenas no modal "Conta e plano".
  if (diasRestantes > 0) return null

  return (
    <div className="w-full bg-destructive/10 border-b border-destructive/30 px-4 py-2.5 flex items-center gap-3 text-[13px] text-destructive">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        <strong className="font-semibold">Seu período gratuito expirou.</strong>{' '}
        Você ainda pode usar o sistema normalmente — fale com a gente para
        continuar.
      </span>
      <ReportProblemButton
        variant="inline"
        label="Falar com a gente"
        className="text-destructive shrink-0"
      />
    </div>
  )
}

export default BannerTrialExpirado
