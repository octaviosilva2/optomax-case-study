// Banner persistente do paywall (Fase 2). Aparece quando a org está em
// read-only por trial expirado (plan_status='expired') — ao lado do ModalPagamento
// recorrente. Reforça que os dados continuam acessíveis (leitura/export) e que
// a edição volta ao assinar.
//
// Server component: lê plan_status de getSessionData (cache hit no layout).
// Distinto do BannerTrialExpirado, que cobre o PRÉ-corte (trial venceu mas a org
// ainda está 'trialing' com acesso). Aqui o corte já aconteceu ('expired').

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { getSessionData } from '@/lib/auth/session'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { orgEhReadOnly } from '@/lib/utils/status'

export async function BannerPagamento() {
  const session = await getSessionData()
  const org = session?.org
  if (!org || !orgEhReadOnly(org.plan_status)) return null

  return (
    <div className="flex w-full items-center gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        <strong className="font-semibold">Seu plano expirou.</strong>{' '}
        Assine para voltar a editar — seus dados continuam aqui, e você ainda pode
        consultá-los e exportá-los.
      </span>
      <Link
        href="/assinar"
        className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}
      >
        Assinar
      </Link>
    </div>
  )
}

export default BannerPagamento
