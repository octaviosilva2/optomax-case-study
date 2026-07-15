'use client'

import { memo, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { FichaClinica } from '@/types/clinical'
import {
  FASES_ORDEM,
  secaoPreenchida,
  secoesDoModo,
  type Modelo,
} from '@/lib/clinical/secoesFicha'

/**
 * Scroll-spy: observa os <div id="sec-*"> e devolve o id da seção ativa
 * (a primeira visível na ordem do índice). Funciona com scroll de window/main —
 * não depende de container interno. Reassina quando o conjunto de ids muda
 * (troca de modelo Resumido ↔ Completo).
 */
function useScrollSpy(ids: string[]): string | null {
  const [ativo, setAtivo] = useState<string | null>(null)
  const chave = ids.join('|')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const lista = chave ? chave.split('|') : []
    if (lista.length === 0) return

    const visiveis = new Set<string>()
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visiveis.add(e.target.id)
          else visiveis.delete(e.target.id)
        }
        // Seção ativa = primeira da ordem do índice que está visível.
        const primeiro = lista.find((id) => visiveis.has(id))
        if (primeiro) setAtivo(primeiro)
      },
      // Faixa estreita no topo: a seção "ativa" é a que chega perto do topo.
      { rootMargin: '-15% 0px -75% 0px', threshold: 0 },
    )

    const els = lista
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null)
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [chave])

  return ativo
}

type Props = {
  modo: Modelo
  ficha: FichaClinica
  /** Chamado após navegar — usado para fechar o drawer no mobile. */
  onNavegar?: () => void
  className?: string
}

/**
 * Índice da ficha: contador X/N + barra de progresso no topo, seções agrupadas
 * por fase com bolinha de preenchida e scroll-spy. Usado tanto na sidebar fixa
 * (desktop) quanto dentro do Sheet (mobile).
 */
function IndiceFichaBase({ modo, ficha, onNavegar, className }: Props) {
  const secoes = secoesDoModo(modo)
  const ids = secoes.map((s) => s.id)
  const ativo = useScrollSpy(ids)

  // Progresso conta só seções "preenchíveis" (chaves.length > 0).
  const comProgresso = secoes.filter((s) => s.chaves.length > 0)
  const preenchidasCount = comProgresso.filter((s) =>
    secaoPreenchida(ficha, s.chaves),
  ).length
  const total = comProgresso.length
  const pct = total ? Math.round((preenchidasCount / total) * 100) : 0

  function irPara(id: string) {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    onNavegar?.()
  }

  return (
    <nav className={cn('text-sm', className)} aria-label="Índice da ficha">
      {/* Contador X/N + barra de progresso */}
      <div className="flex items-center gap-2 px-2 pb-1 text-xs text-muted-foreground">
        <span className="tabular-nums font-mono">
          {preenchidasCount}/{total}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {FASES_ORDEM.map((fase) => {
        const itens = secoes.filter((s) => s.fase === fase)
        if (itens.length === 0) return null
        return (
          <div key={fase} className="mb-0.5">
            <p className="px-2 pt-3 pb-1 text-eyebrow font-mono text-muted-foreground">
              {fase}
            </p>
            {itens.map((s) => {
              const temProgresso = s.chaves.length > 0
              const cheia = temProgresso && secaoPreenchida(ficha, s.chaves)
              const isAtivo = ativo === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => irPara(s.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                    isAtivo
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      cheia ? 'bg-status-ok' : 'bg-border',
                    )}
                  />
                  <span className="truncate">{s.label}</span>
                </button>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}

// Assinatura do estado de preenchimento (uma string '1'/'0' por seção, na ordem
// do modo). Igual ⇒ índice não precisa re-renderizar. É o que permite digitar
// na ficha sem re-renderizar o índice a cada tecla (só quando uma seção muda de
// vazia↔preenchida).
function assinaturaPreenchidas(ficha: FichaClinica, modo: Modelo): string {
  return secoesDoModo(modo)
    .map((s) => (s.chaves.length > 0 && secaoPreenchida(ficha, s.chaves) ? '1' : '0'))
    .join('')
}

export const IndiceFicha = memo(IndiceFichaBase, (prev, next) => {
  return (
    prev.modo === next.modo &&
    prev.onNavegar === next.onNavegar &&
    prev.className === next.className &&
    assinaturaPreenchidas(prev.ficha, prev.modo) ===
      assinaturaPreenchidas(next.ficha, next.modo)
  )
})
