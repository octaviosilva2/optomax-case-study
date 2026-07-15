'use client'

import { ArrowRight, CheckCheck, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Ferramentas de velocidade exibidas no canto superior direito de uma seção
// (via SecaoWrapper). São atalhos por cima dos campos — não alteram a estrutura
// nem os campos do módulo clínico.

type BotaoProps = {
  onClick: () => void
  icon: LucideIcon
  children: React.ReactNode
  title?: string
  /** "ok" pinta em verde (ação de normalidade) */
  tom?: 'neutro' | 'ok'
}

function BotaoAcaoRapida({ onClick, icon: Icon, children, title, tom = 'neutro' }: BotaoProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
        tom === 'ok'
          ? 'border-border bg-card text-status-ok hover:bg-status-ok-bg'
          : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  )
}

/** Copia os valores do olho direito (OD) para o esquerdo (OE). */
export function BotaoCopiarOD({ onClick }: { onClick: () => void }) {
  return (
    <BotaoAcaoRapida onClick={onClick} icon={ArrowRight} title="Copiar valores de OD para OE">
      Copiar OD→OE
    </BotaoAcaoRapida>
  )
}

/** Preenche a seção com valores normais para o profissional só editar o que destoa. */
export function BotaoTudoNormal({ onClick }: { onClick: () => void }) {
  return (
    <BotaoAcaoRapida
      onClick={onClick}
      icon={CheckCheck}
      tom="ok"
      title="Preencher como normal (sem alterações)"
    >
      Sem alterações
    </BotaoAcaoRapida>
  )
}
