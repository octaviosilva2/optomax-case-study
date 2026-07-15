'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Andaime em volta de cada módulo clínico. Responsável por:
// - o id/scroll-mt (alvo do índice e do scroll-spy);
// - o slot de ferramentas de velocidade (canto superior direito, só desktop);
// - o acordeão no mobile (<md): header sintético + recolher.
// NÃO altera nada dentro do módulo (children) — REGRA DE OURO.

type Props = {
  /** id do wrapper — deve casar com o registry (secoesFicha) */
  id: string
  /** Rótulo exibido no header do acordeão mobile */
  label: string
  /** Ferramentas de velocidade (BotaoCopiarOD / BotaoTudoNormal) */
  acao?: React.ReactNode
  /** Esconde as ações (ex.: ficha em readonly) */
  escondeAcao?: boolean
  /** Seção já preenchida — pinta a bolinha e recolhe por padrão no mobile */
  preenchida?: boolean
  /** Força o estado inicial aberto no mobile (sobrepõe o recolher-se-preenchida) */
  defaultAberto?: boolean
  children: React.ReactNode
}

export function SecaoWrapper({
  id,
  label,
  acao,
  escondeAcao,
  preenchida = false,
  defaultAberto,
  children,
}: Props) {
  // Mobile: começa recolhido se a seção já está preenchida (spec: "recolhe as preenchidas").
  const [aberto, setAberto] = useState(defaultAberto ?? !preenchida)

  return (
    <div id={id} className="relative scroll-mt-20">
      {/* Header do acordeão — só mobile (<md) */}
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="mb-2 flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left md:hidden"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              preenchida ? 'bg-status-ok' : 'bg-border',
            )}
          />
          {label}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            aberto && 'rotate-180',
          )}
        />
      </button>

      {/* Ferramentas de velocidade — canto superior direito, só desktop */}
      {acao && !escondeAcao && (
        <div className="absolute right-4 top-4 z-10 hidden items-center gap-1.5 md:flex">
          {acao}
        </div>
      )}

      {/* Corpo: sempre renderizado (1 só vez). No mobile recolhe via `hidden`;
          no desktop fica sempre visível (md:block sobrepõe o hidden). */}
      <div className={cn(!aberto && 'hidden md:block')}>{children}</div>
    </div>
  )
}
