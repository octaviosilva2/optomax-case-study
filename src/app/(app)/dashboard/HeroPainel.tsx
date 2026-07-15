'use client'

/**
 * HeroPainel — Herói adaptativo do dashboard.
 *
 * Decide entre:
 * - Card "Próximo paciente" (se há agendamento próximo hoje)
 * - Card "Iniciar atendimento" + busca rápida (se não há)
 *
 * Plano Dashboard V2 — Fase D
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  CalendarClock,
  Stethoscope,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatarHoraBR } from '@/lib/utils/data'
import { avatarColor, iniciais } from '@/lib/utils/avatar'
import FluxoEscolhaAtendimento from '@/components/atendimento/FluxoEscolhaAtendimento'

export type ProximoPaciente = {
  appointmentId: string
  patientId: string
  patientNome: string
  dataHora: string
  resumoClinicio: string | null
}

type Props = {
  /** Próximo paciente agendado hoje (null se não houver) */
  proximoPaciente: ProximoPaciente | null
}

/**
 * Renderiza herói adaptativo do dashboard.
 */
export function HeroPainel({ proximoPaciente }: Props) {
  // Reorganização "Novo Atendimento" (SPEC §5, porta B): "Iniciar atendimento"
  // abre direto o fluxo comum (CA5 + modal Ficha × Receita) — paciente e
  // horário já vêm do agendamento.
  const [escolhaAberta, setEscolhaAberta] = useState(false)

  // Se há próximo paciente hoje → exibe card com info do paciente
  if (proximoPaciente) {
    return (
      <div className="rounded-2xl bg-primary-subtle border border-primary/15 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            {/* Avatar com iniciais (mesma identidade da agenda) */}
            <div
              className={`shrink-0 w-12 h-12 rounded-full grid place-items-center text-white text-[15px] font-semibold select-none ${avatarColor(proximoPaciente.patientNome)}`}
            >
              {iniciais(proximoPaciente.patientNome)}
            </div>

            {/* Info do paciente */}
            <div className="min-w-0">
              <p className="text-eyebrow text-primary flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" />
                Próximo paciente · {formatarHoraBR(proximoPaciente.dataHora)}
              </p>
              <h2 className="text-page-title text-foreground truncate mt-0.5">
                {proximoPaciente.patientNome}
              </h2>
              {proximoPaciente.resumoClinicio && (
                <p className="text-meta text-muted-foreground truncate mt-0.5">
                  {proximoPaciente.resumoClinicio}
                </p>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/pacientes/${proximoPaciente.patientId}`}
              className="inline-flex items-center h-9 px-3.5 rounded-lg text-[13px] font-medium border border-border bg-card hover:bg-muted transition-colors"
            >
              Ver ficha
            </Link>
            <Button
              onClick={() => setEscolhaAberta(true)}
              className="h-9 px-4"
            >
              <Stethoscope className="w-4 h-4" />
              <span className="ml-1.5">Iniciar atendimento</span>
            </Button>
          </div>
        </div>

        <FluxoEscolhaAtendimento
          open={escolhaAberta}
          onOpenChange={setEscolhaAberta}
          appointmentId={proximoPaciente.appointmentId}
          paciente={{ id: proximoPaciente.patientId, nome: proximoPaciente.patientNome }}
        />
      </div>
    )
  }

  // Sem próximo paciente hoje → não renderiza nada (Octavio pediu remover
  // o card genérico "Pronto para atender").
  return null
}
