/**
 * Card de KPI canonico (DESIGN.md secao 4).
 * Uso: dashboard, hero de listagem, relatorios.
 *
 * 2 modos:
 * - editorial (default): Instrument Serif text-3xl — quando KPI e protagonista
 * - dense: JetBrains Mono text-2xl — quando ha grid 4+ KPIs lado a lado
 */

import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown } from 'lucide-react'

type KpiCardProps = {
  /** Label do KPI (ex: "ATENDIDOS HOJE") */
  label: string
  /** Valor principal (ex: "0", "1.847") */
  value: string | number
  /** Delta opcional com direcao e texto comparativo */
  delta?: {
    direction: 'up' | 'down'
    /** Texto descritivo (ex: "+12% vs ontem") */
    text: string
    /** Tom explicito — se omitido, deriva de direction (up=ok, down=critical) */
    tone?: 'ok' | 'critical'
  }
  /** Meta-info alternativa ao delta (ex: "— 4 salas ativas") */
  meta?: string
  /** Variante visual */
  variant?: 'editorial' | 'dense'
  /** Classes adicionais para extensao */
  className?: string
}

/**
 * Renderiza card de KPI com label, valor grande e delta/meta.
 * @example
 * <KpiCard
 *   label="ATENDIDOS HOJE"
 *   value={12}
 *   delta={{ direction: 'up', text: '+3 vs ontem' }}
 * />
 */
export function KpiCard({
  label,
  value,
  delta,
  meta,
  variant = 'editorial',
  className,
}: KpiCardProps) {
  // Deriva tom do delta se nao especificado
  const deltaTone = delta?.tone ?? (delta?.direction === 'up' ? 'ok' : 'critical')
  const DeltaIcon = delta?.direction === 'up' ? ArrowUp : ArrowDown

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-4 shadow-xs',
        className,
      )}
    >
      {/* Label */}
      <span className="block text-eyebrow mb-1">
        {label}
      </span>

      {/* Valor */}
      <span
        className={cn(
          'block',
          variant === 'editorial'
            ? 'font-serif text-3xl'
            : 'font-mono text-2xl font-medium tabular-nums',
        )}
      >
        {value}
      </span>

      {/* Delta ou Meta */}
      {delta && (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium mt-1',
            deltaTone === 'ok' && 'text-status-ok',
            deltaTone === 'critical' && 'text-status-critical',
          )}
        >
          <DeltaIcon className="size-3" />
          {delta.text}
        </span>
      )}

      {!delta && meta && (
        <span className="block text-meta-xs mt-1">
          {meta}
        </span>
      )}
    </div>
  )
}
