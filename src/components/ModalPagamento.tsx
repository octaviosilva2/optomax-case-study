'use client'

// Modal de pagamento recorrente (paywall Fase 2 — modo read-only do trial
// expirado). Decisão de produto pós-gate-visual (23/06): em vez de "read-only +
// banner fixo", o app fica bloqueado para uso e este modal REAPARECE a cada 20s
// depois de fechado no X. CTA "Assinar" leva ao checkout (/assinar).
//
// Só é montado pelo layout (app) quando a org está em read-only (plan_status
// 'expired'). Ver layout.tsx + status.ts (orgEhReadOnly).

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Lock, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Intervalo de reabertura após fechar (decisão de produto: 20s).
const REABRIR_APOS_MS = 20_000

export function ModalPagamento() {
  const [open, setOpen] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Agenda a reabertura 20s após o fechamento. Limpa qualquer timer pendente
  // antes (evita acúmulo se o usuário abrir/fechar várias vezes).
  function agendarReabertura() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(true), REABRIR_APOS_MS)
  }

  function fechar() {
    setOpen(false)
    agendarReabertura()
  }

  // Limpa o timer ao desmontar (ex.: org volta a ficar ativa e o layout
  // deixa de montar o modal).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && fechar()}>
      <DialogContent
        className="sm:max-w-[400px] p-0 overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-end px-4 pt-4">
          <DialogTitle className="sr-only">Seu período acabou</DialogTitle>
          <button
            onClick={fechar}
            className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </DialogHeader>

        <div className="px-6 pb-7 pt-1 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-destructive-bg text-destructive border border-destructive/30">
            <Lock className="size-6" />
          </div>
          <h2 className="text-[17px] font-semibold tracking-tight">Seu período acabou</h2>
          <p className="mx-auto mt-2 max-w-[300px] text-[13px] leading-relaxed text-muted-foreground">
            Assine o OptoMax para continuar atendendo. Seus dados continuam aqui —
            você ainda pode consultá-los e exportá-los.
          </p>

          <Link href="/assinar" className={cn(buttonVariants(), 'mt-5 w-full')}>
            Assinar agora
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ModalPagamento
