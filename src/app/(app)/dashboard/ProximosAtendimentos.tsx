'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarX } from 'lucide-react'
import { useAgendaDia } from '@/hooks/useAgenda'
import { getStatusConfig } from '@/lib/utils/status'
import { formatarHoraBR } from '@/lib/utils/data'

function formatarHora(iso: string) {
  return formatarHoraBR(iso)
}

/* Compartilha o mesmo queryKey da AgendaHoje — sem fetch duplicado */
export function ProximosAtendimentos() {
  const [hoje, setHoje] = useState<Date>(() => new Date())

  useEffect(() => {
    const id = setInterval(() => {
      const agora = new Date()
      setHoje(atual => atual.toDateString() === agora.toDateString() ? atual : agora)
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const { data: agendamentos, isLoading } = useAgendaDia(hoje, true)

  const agora = new Date()
  const proximos = (agendamentos ?? [])
    .filter(a =>
      new Date(a.data_hora) >= agora &&
      (a.status === 'agendado' || a.status === 'confirmado')
    )
    .slice(0, 5)

  if (isLoading) {
    return (
      <div className="px-4 py-5 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-12 rounded bg-muted animate-pulse" />
            <div className="flex-1 h-4 rounded bg-muted animate-pulse" />
            <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (proximos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-center">
        <CalendarX className="h-6 w-6 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Sem próximos agendamentos</p>
      </div>
    )
  }

  return (
    <div className="px-2 pb-2 space-y-0.5">
      {proximos.map(ag => {
        const cfg = getStatusConfig(ag.status)
        return (
          <Link
            key={ag.id}
            href={`/pacientes/${ag.patient_id}`}
            className="flex items-center gap-3 px-2 py-2.5 rounded-md hover:bg-muted transition-colors"
          >
            {/* Hora */}
            <span className="w-[50px] shrink-0 text-[13px] font-semibold text-foreground tabular-nums tracking-[-0.01em]">
              {formatarHora(ag.data_hora)}
            </span>

            {/* Nome + duracao (tipo de consulta removido) */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-foreground truncate leading-tight">
                {ag.patients?.nome ?? '—'}
              </p>
              <p className="text-[12px] text-muted-foreground truncate">{ag.duracao} min</p>
            </div>

            {/* Status badge */}
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.badgeClass}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} />
              {cfg.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
