'use client'

import { Check, CircleAlert, Loader2 } from 'lucide-react'
import { formatarHoraBR } from '@/lib/utils/data'

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type Props = {
  status: AutoSaveStatus
  ultimaSalvaEm?: Date | null
}

export function AutoSaveIndicator({ status, ultimaSalvaEm }: Props) {
  if (status === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Salvando…
      </div>
    )
  }

  if (status === 'saved') {
    const horario = ultimaSalvaEm ? formatarHoraBR(ultimaSalvaEm) : ''
    return (
      <div className="flex items-center gap-1.5 text-xs text-status-ok">
        <Check className="h-3.5 w-3.5" />
        Salvo {horario && `às ${horario}`}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive">
        <CircleAlert className="h-3.5 w-3.5" />
        Erro ao salvar
      </div>
    )
  }

  return null // idle: não renderiza nada
}
