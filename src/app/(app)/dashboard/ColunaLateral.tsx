'use client'

/**
 * ColunaLateral — Cards de ação rápida para o dashboard.
 *
 * Inclui:
 * - Pendências: fichas em aberto, assinatura faltando, receitas sem PDF
 *
 * Plano Dashboard V2 — Fase E
 */

import Link from 'next/link'
import {
  ArrowRight,
  Calendar,
  Check,
  FileWarning,
  PenTool,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════════════════ */

export type Pendencia =
  | { tipo: 'ficha_aberta'; clinicalRecordId: string; patientNome: string }
  | { tipo: 'sem_assinatura' }
  | { tipo: 'receita_sem_pdf'; prescriptionId: string; patientNome: string }

type Props = {
  pendencias: Pendencia[]
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

export function ColunaLateral({ pendencias }: Props) {
  return (
    <div className="flex flex-col gap-5">
      {/* Pendências */}
      <CardPendencias items={pendencias} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CARD: PENDÊNCIAS
   ═══════════════════════════════════════════════════════════════════════════ */

function CardPendencias({ items }: { items: Pendencia[] }) {
  return (
    <section className="rounded-2xl bg-card border border-border shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileWarning className="w-4 h-4 text-muted-foreground" />
        <span className="text-eyebrow font-semibold">Pendências</span>
        {items.length > 0 && (
          <span className="ml-auto text-meta-xs text-status-warning">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState texto="Tudo em dia!" icone="check" />
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 5).map((item, i) => (
            <LinhaPendencia key={i} item={item} />
          ))}
          {items.length > 5 && (
            <li className="text-meta-xs text-muted-foreground text-center pt-1">
              + {items.length - 5} mais
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

function LinhaPendencia({ item }: { item: Pendencia }) {
  // Cada tipo de pendência aponta para onde resolvê-la.
  let href = '/configuracoes'
  let Icone = PenTool
  let texto = 'Assinatura não cadastrada'

  if (item.tipo === 'ficha_aberta') {
    href = `/ficha/${item.clinicalRecordId}`
    Icone = Calendar
    texto = `Ficha em aberto: ${item.patientNome}`
  } else if (item.tipo === 'receita_sem_pdf') {
    href = '/receitas'
    Icone = FileWarning
    texto = `Receita sem PDF: ${item.patientNome}`
  }

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2 p-2 rounded-lg bg-status-warning-bg hover:bg-status-warning-bg/80 transition-colors group"
      >
        <Icone className="w-4 h-4 text-status-warning shrink-0" />
        <span className="text-[13px] font-medium text-foreground truncate flex-1">
          {texto}
        </span>
        <ArrowRight className="w-4 h-4 text-status-warning/70 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════════════════════ */

function EmptyState({ texto, icone }: { texto: string; icone?: 'check' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4 text-meta-xs text-muted-foreground">
      {icone === 'check' && <Check className="w-4 h-4 text-status-ok" />}
      {texto}
    </div>
  )
}
