/**
 * Wordmark canonico OptoMax. Sempre com ponto final em --accent (dourado).
 * Forma escrita pela mao da marca.
 *
 * Uso: logo textual em header, login, splash, rodape.
 * Nao usar em densidade alta (tabelas, forms).
 */

import { cn } from '@/lib/utils'

type WordmarkProps = {
  /** Tamanho do wordmark */
  size?: 'sm' | 'md' | 'lg' | 'display'
  /** Classes adicionais para extensao */
  className?: string
}

const SIZE = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
  // text-display nao existe no Tailwind v4 — usar classe arbitraria
  display: 'text-[44px] leading-[48px]',
} as const

/**
 * Renderiza o wordmark "OptoMax." com ponto final dourado.
 * @example <Wordmark size="lg" />
 */
export function Wordmark({ size = 'md', className }: WordmarkProps) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-serif tracking-tight leading-none',
        SIZE[size],
        className,
      )}
      aria-label="OptoMax"
    >
      <span>OptoMax</span>
      <span className="text-accent" aria-hidden>.</span>
    </span>
  )
}
