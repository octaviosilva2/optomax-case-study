'use client'

/**
 * BannerOnboarding — guia compacto de progresso no topo do painel.
 *
 * Aparece enquanto os 3 primeiros passos (paciente → atendimento → receita)
 * não estão completos. Diferente do PainelVazio (tela cheia, só no 0-absoluto),
 * este acompanha o usuário no painel normal e some sozinho ao chegar em 3/3.
 *
 * O passo "Fazer atendimento" abre o Encaixe Rápido (selecionar paciente
 * cadastrado → atender agora), não o fluxo de agendar pra depois.
 *
 * Plano Dashboard V2 — correção do onboarding (banner persistente).
 */

import Link from 'next/link'
import { useState } from 'react'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import ModalEncaixeRapido from '@/components/atendimento/ModalEncaixeRapido'

type Props = {
  passos: {
    temPaciente: boolean
    temAgendamento: boolean
    temReceita: boolean
  }
}

type Item = {
  key: string
  label: string
  done: boolean
  /** Navega para a rota */
  href?: string
  /** Abre o modal de Encaixe Rápido (atender agora) em vez de navegar */
  abreEncaixe?: boolean
}

export function BannerOnboarding({ passos }: Props) {
  const [encaixeOpen, setEncaixeOpen] = useState(false)

  const items: Item[] = [
    { key: 'paciente', label: 'Cadastrar paciente', done: passos.temPaciente, href: '/pacientes?novo=1' },
    { key: 'atendimento', label: 'Fazer atendimento', done: passos.temAgendamento, abreEncaixe: true },
    { key: 'receita', label: 'Gerar receita', done: passos.temReceita, href: '/receitas?nova=1' },
  ]
  const completos = items.filter((i) => i.done).length

  // Some sozinho quando os 3 passos estão completos.
  if (completos >= 3) return null

  const proximo = items.find((i) => !i.done)!
  const ctaClasses =
    'inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0'

  return (
    <>
      <div className="rounded-2xl border border-primary/20 bg-primary-subtle p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-eyebrow text-primary">Comece por aqui · {completos}/3</span>
            <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap">
              {items.map((i) => (
                <span
                  key={i.key}
                  className={cn(
                    'inline-flex items-center gap-1.5 text-[13px]',
                    i.done ? 'text-muted-foreground line-through' : 'text-foreground font-medium',
                  )}
                >
                  {i.done ? (
                    <CheckCircle2 className="w-4 h-4 text-status-ok shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border-2 border-primary/40 shrink-0 inline-block" />
                  )}
                  {i.label}
                </span>
              ))}
            </div>
          </div>

          {proximo.abreEncaixe ? (
            <button type="button" onClick={() => setEncaixeOpen(true)} className={ctaClasses}>
              {proximo.label}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <Link href={proximo.href!} className={ctaClasses}>
              {proximo.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      <ModalEncaixeRapido open={encaixeOpen} onOpenChange={setEncaixeOpen} />
    </>
  )
}
