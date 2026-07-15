'use client'

/**
 * Cabecalho padrao canonico de pagina (DESIGN.md secao 4).
 * Uso: toda pagina de listagem ou detalhe no OptoClinic.
 *
 * Estrutura:
 * [breadcrumb mono uppercase xs] / [trilha] / [final]
 * [H1 Instrument Serif text-2xl tracking-tight]      [acoes alinhadas a direita]
 * [subtitulo Inter text-sm muted]                    [outline secundario + primary CTA]
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Fragment } from 'react'

type BreadcrumbItem = {
  /** Texto do item de breadcrumb */
  label: string
  /** Link opcional — se omitido, renderiza span */
  href?: string
}

type PageHeaderProps = {
  /** Trilha de navegacao (breadcrumb) */
  breadcrumb?: BreadcrumbItem[]
  /** Titulo principal da pagina (H1) */
  title: string
  /** Subtitulo opcional (1-2 linhas) — pode ser string ou elemento React */
  subtitle?: React.ReactNode
  /** Slot para botoes de acao (alinhados a direita) */
  actions?: React.ReactNode
  /** Modo hero — aumenta tamanho do titulo para text-3xl */
  hero?: boolean
  /** Classes adicionais para extensao */
  className?: string
}

/**
 * Renderiza cabecalho de pagina com breadcrumb, titulo em serifa e acoes.
 * @example
 * <PageHeader
 *   breadcrumb={[{ label: 'Pacientes', href: '/pacientes' }, { label: 'Joao Silva' }]}
 *   title="Ficha do Paciente"
 *   subtitle="Ultima atualizacao: 22/05/2026"
 *   actions={<Button>Novo Atendimento</Button>}
 * />
 */
export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  actions,
  hero = false,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-2 mb-8', className)}>
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center flex-wrap gap-x-0 text-eyebrow font-mono"
        >
          {breadcrumb.map((item, index) => (
            <Fragment key={index}>
              {index > 0 && (
                <span className="mx-2 text-muted-foreground/50">/</span>
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
      )}

      {/* Titulo + Acoes */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-1">
          <h1
            className={cn(
              hero ? 'text-page-hero' : 'text-page-title',
            )}
          >
            {title}
          </h1>

          {/* <div> (não <p>): subtitle é React.ReactNode e pode conter
              elementos de bloco (ex.: a ficha de atendimento passa <input>/<div>).
              <p> não pode ter <div> como filho → erro de hydration. */}
          {subtitle && (
            <div className="text-meta max-w-prose">
              {subtitle}
            </div>
          )}
        </div>

        {/* Acoes — stack vertical em mobile, flex horizontal em md+ */}
        {actions && (
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
