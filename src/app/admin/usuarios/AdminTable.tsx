'use client'

// Tabela de usuários/clínicas do painel admin (aba Usuários).
// O header e a navegação ficam no AdminShell; aqui ficam os filtros + tabela.
// Acréscimos sobre a versão anterior: colunas "Plano" (beta/admin) e "Trial"
// (dias restantes do período de teste).

import { useState, useTransition } from 'react'
import { Power, PowerOff, Eye, LogIn, Gift, CalendarPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { toggleOrgStatus } from '../actions'
import {
  definirPlano,
  estenderTrial,
  concederCortesia,
  impersonarUsuario,
} from '../orgs/[id]/gestao/actions'
import { formatarDataRelativa } from '@/lib/utils/data'
import {
  orgPodeAcessar,
  diasRestantesTrial,
  planoEhIlimitado,
  planoEhPago,
  normalizePlan,
  PLANS,
  type Plan,
} from '@/lib/utils/status'
import type { AdminMetricRow } from '@/lib/admin/metrics'
import type { StatusFilter } from './page'

// Janela em ms para considerar o usuário "Online agora" (badge verde).
const ONLINE_WINDOW_MS = 2 * 60 * 1000

const STATUS_BADGE: Record<AdminMetricRow['status'], { label: string; className: string }> = {
  engajado: { label: '🟢 Engajado', className: 'bg-status-ok-bg text-status-ok border-status-ok/30' },
  baixo_uso: { label: '🟡 Baixo uso', className: 'bg-status-warning-bg text-status-warning border-status-warning/30' },
  sem_uso: { label: '🔴 Sem uso', className: 'bg-destructive-bg text-destructive border-destructive/30' },
}

// Formata "dias desde" como "N d" (truncado pra baixo). Null → caller exibe "—".
function diasDesde(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 0
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

// Rótulo curto + cor por plano canônico (admin/free/pago).
const PLAN_BADGE: Record<Plan, { label: string; className: string }> = {
  admin: { label: 'Admin', className: 'bg-accent/15 text-accent-foreground border-accent/30' },
  free: { label: 'Free', className: 'bg-muted text-muted-foreground border-border' },
  pago: { label: 'Pago', className: 'bg-status-ok-bg text-status-ok border-status-ok/30' },
}

function PlanoBadge({ plan }: { plan: string }) {
  const b = PLAN_BADGE[normalizePlan(plan)]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${b.className}`}>
      {b.label}
    </span>
  )
}

// Badge de situação de cobrança, derivado de plano + plan_status + trial.
function BillingBadge({ row }: { row: AdminMetricRow }) {
  const plan = normalizePlan(row.plan)
  const s = row.orgStatus
  let label = '—'
  let cls = 'bg-muted text-muted-foreground border-border'

  if (plan === 'admin') {
    label = 'Interno'
  } else if (plan === 'pago') {
    if (s === 'active') { label = 'Em dia'; cls = 'bg-status-ok-bg text-status-ok border-status-ok/30' }
    else if (s === 'past_due') { label = 'Atrasado'; cls = 'bg-destructive-bg text-destructive border-destructive/30' }
    else label = 'Pago (inativo)'
  } else {
    // free
    if (s === 'expired') { label = 'Expirado'; cls = 'bg-destructive-bg text-destructive border-destructive/30' }
    else if (!row.trialEndsAt && s === 'active') { label = 'Cortesia'; cls = 'bg-accent/15 text-accent-foreground border-accent/30' }
    else if (s === 'trialing') { label = 'Trial'; cls = 'bg-status-warning-bg text-status-warning border-status-warning/30' }
    else if (!orgPodeAcessar(s)) label = 'Inativo'
    else label = 'Grátis'
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${cls}`}>
      {label}
    </span>
  )
}

const FILTROS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Ativos' },
  { key: 'suspended', label: 'Desativados' },
]

type Totais = { all: number; active: number; suspended: number }

// Renderiza a célula de Trial: ilimitado (admin), dias restantes ou expirado.
function CelulaTrial({ row }: { row: AdminMetricRow }) {
  if (planoEhIlimitado(row.plan)) {
    return <span className="text-[11px] font-medium text-muted-foreground">Ilimitado</span>
  }
  const dias = diasRestantesTrial(row.trialEndsAt, row.plan)
  if (dias === null) return <span className="text-muted-foreground">—</span>
  if (dias <= 0) {
    return <span className="text-[11px] font-medium text-destructive">Expirado</span>
  }
  // Vence em ≤3 dias → destaca em amarelo.
  const cls = dias <= 3 ? 'text-status-warning' : 'text-foreground'
  return (
    <span className={`text-[11px] font-medium tabular-nums ${cls}`}>
      {dias} {dias === 1 ? 'dia' : 'dias'}
    </span>
  )
}

export function AdminTable({
  linhas,
  filtroAtivo,
  totais,
}: {
  linhas: AdminMetricRow[]
  filtroAtivo: StatusFilter
  totais: Totais
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null)

  function handleToggle(row: AdminMetricRow) {
    // Org com acesso (trialing/active/past_due) → desativa; senão reativa.
    const novo = orgPodeAcessar(row.orgStatus) ? 'inactive' : 'active'
    setBusyOrgId(row.orgId)
    startTransition(async () => {
      await toggleOrgStatus(row.orgId, novo)
      setBusyOrgId(null)
      router.refresh()
    })
  }

  // Wrapper genérico das ações inline (action → toast → refresh).
  function runRow(orgId: string, fn: () => Promise<{ error: string | null }>, sucesso: string) {
    setBusyOrgId(orgId)
    startTransition(async () => {
      const res = await fn()
      setBusyOrgId(null)
      if (res.error) toast.error(res.error)
      else {
        toast.success(sucesso)
        router.refresh()
      }
    })
  }

  function handlePlano(row: AdminMetricRow, plan: string) {
    if (plan === normalizePlan(row.plan)) return
    runRow(row.orgId, () => definirPlano(row.orgId, plan), 'Plano atualizado')
  }

  function handleCortesia(row: AdminMetricRow) {
    if (!confirm(`Conceder cortesia permanente (grátis, sem cobrar) para "${row.orgNome}"?`)) return
    runRow(row.orgId, () => concederCortesia(row.orgId, 'permanente'), 'Cortesia concedida')
  }

  function handleEstender(row: AdminMetricRow) {
    runRow(row.orgId, () => estenderTrial(row.orgId, 7), 'Trial estendido +7 dias')
  }

  function handleImpersonar(row: AdminMetricRow) {
    if (
      !confirm(
        `Entrar como "${row.orgNome}"? Você abrirá uma sessão real do cliente (acesso a dados de paciente). A ação fica registrada na auditoria.`,
      )
    )
      return
    setBusyOrgId(row.orgId)
    startTransition(async () => {
      const res = await impersonarUsuario(row.orgId)
      setBusyOrgId(null)
      if (res.error || !res.link) toast.error(res.error ?? 'Não foi possível gerar o acesso')
      else window.open(res.link, '_blank', 'noopener')
    })
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {FILTROS.map((f) => {
            const ativo = filtroAtivo === f.key
            const count = totais[f.key]
            const href = f.key === 'all' ? '/admin/usuarios' : `/admin/usuarios?status=${f.key}`
            return (
              <Link
                key={f.key}
                href={href}
                className={`h-8 px-3 rounded-md border text-[13px] font-medium flex items-center gap-1.5 ${
                  ativo
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                {f.label}
                <span
                  className={`text-[11px] tabular-nums ${
                    ativo ? 'opacity-80' : 'text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
        <p className="text-meta-xs">
          {linhas.length} {linhas.length === 1 ? 'usuário' : 'usuários'}
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-left text-eyebrow">
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Clínica</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Billing</th>
              <th className="px-4 py-3 font-medium">Trial</th>
              <th className="px-4 py-3 font-medium">Última atividade</th>
              <th className="px-4 py-3 font-medium" title="Dias desde a criação da conta">
                Cadastro
              </th>
              <th className="px-4 py-3 font-medium text-right">Pacientes</th>
              <th className="px-4 py-3 font-medium text-right">Fichas</th>
              <th className="px-4 py-3 font-medium text-right">PDFs</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
            {linhas.map((row) => {
              const ativo = orgPodeAcessar(row.orgStatus)
              const badge = STATUS_BADGE[row.status]
              const online =
                !!row.ultimaAtividade &&
                Date.now() - new Date(row.ultimaAtividade).getTime() < ONLINE_WINDOW_MS
              const diasCadastro = diasDesde(row.authCreatedAt)
              return (
                <tr
                  key={row.userId}
                  className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${!ativo ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3 font-medium">{row.nomeCompleto}</td>
                  <td className="px-4 py-3">{row.orgNome}</td>
                  <td className="px-4 py-3">
                    <PlanoBadge plan={row.plan} />
                  </td>
                  <td className="px-4 py-3">
                    <BillingBadge row={row} />
                  </td>
                  <td className="px-4 py-3">
                    <CelulaTrial row={row} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {online && (
                      <span className="inline-flex items-center gap-1 mr-2 text-[11px] font-medium text-status-ok">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-ok animate-pulse" />
                        Online agora
                      </span>
                    )}
                    {formatarDataRelativa(row.ultimaAtividade)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {diasCadastro === null ? '—' : `${diasCadastro} d`}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono">{row.pacientes}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono">{row.fichasCompletas}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono">{row.pdfsGerados}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const busy = busyOrgId === row.orgId
                      const ehAdmin = planoEhIlimitado(row.plan)
                      return (
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {/* Trocar plano inline */}
                          <select
                            value={normalizePlan(row.plan)}
                            onChange={(e) => handlePlano(row, e.target.value)}
                            disabled={busy}
                            title="Trocar plano"
                            className="h-7 px-1.5 rounded border border-border bg-card text-[11px] font-medium hover:bg-muted disabled:opacity-50"
                          >
                            {PLANS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>

                          {/* Cortesia rápida (permanente) — esconde p/ admin e pagante */}
                          {!ehAdmin && !planoEhPago(row.plan) && (
                            <button
                              onClick={() => handleCortesia(row)}
                              disabled={busy}
                              title="Conceder cortesia permanente (grátis)"
                              className="h-7 px-2 rounded border border-accent/30 text-accent-foreground bg-accent/10 text-[11px] font-medium hover:bg-accent/20 inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              <Gift className="h-3 w-3" />
                              Cortesia
                            </button>
                          )}

                          {/* Estender trial +7d — só p/ free com prazo */}
                          {!ehAdmin && (
                            <button
                              onClick={() => handleEstender(row)}
                              disabled={busy}
                              title="Estender trial +7 dias"
                              className="h-7 px-2 rounded border border-border bg-card text-[11px] font-medium hover:bg-muted inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              <CalendarPlus className="h-3 w-3" />
                              +7d
                            </button>
                          )}

                          {/* Entrar como (magic link auditado) */}
                          <button
                            onClick={() => handleImpersonar(row)}
                            disabled={busy}
                            title="Entrar como este usuário (auditado)"
                            className="h-7 px-2 rounded border border-border bg-card text-[11px] font-medium hover:bg-muted inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <LogIn className="h-3 w-3" />
                            Entrar
                          </button>

                          <Link
                            href={`/admin/orgs/${row.orgId}/gestao`}
                            title="Abrir gestão da clínica"
                            className="h-7 px-2 rounded border border-border bg-card text-[11px] font-medium hover:bg-muted inline-flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                          </Link>

                          <button
                            onClick={() => handleToggle(row)}
                            disabled={busy}
                            title={ativo ? 'Desativar acesso' : 'Reativar acesso'}
                            className={`h-7 px-2 rounded border text-[11px] font-medium inline-flex items-center gap-1 ${
                              ativo
                                ? 'border-destructive/30 text-destructive hover:bg-destructive-bg'
                                : 'border-status-ok/30 text-status-ok hover:bg-status-ok-bg'
                            } disabled:opacity-50`}
                          >
                            {ativo ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                          </button>
                        </div>
                      )
                    })()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
