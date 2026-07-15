/**
 * Cabecalho de secao editorial com numero de secao e titulo em serifa.
 * Uso: dividir paginas longas (ficha do paciente, configuracoes, relatorios).
 *
 * Formato visual:
 * § 01
 * Titulo da Secao
 * Subtitulo opcional
 */

import { cn } from '@/lib/utils'

type SectionHeaderProps = {
  /** Numero da secao (ex: "01", "02") */
  number: string
  /** Titulo principal da secao */
  title: string
  /** Subtitulo opcional */
  subtitle?: string
  /** Classes adicionais para extensao */
  className?: string
}

/**
 * Renderiza cabecalho de secao com § numerado em mono + titulo em serifa.
 * @example <SectionHeader number="01" title="Dados Pessoais" />
 */
export function SectionHeader({
  number,
  title,
  subtitle,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {/* Indicador de secao em mono */}
      <span className="block text-eyebrow font-mono tracking-widest mb-1">
        § {number}
      </span>

      {/* Titulo em serifa */}
      <h2 className="font-serif text-xl tracking-tight">{title}</h2>

      {/* Subtitulo opcional */}
      {subtitle && (
        <p className="text-meta mt-1">{subtitle}</p>
      )}
    </div>
  )
}
