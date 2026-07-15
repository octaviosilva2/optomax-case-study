// Aba "Billing" do painel admin (/admin/billing).
//
// Visão financeira do produto: MRR, assinantes, receita, atraso + tabela de
// pagamentos recentes e lista de assinantes. Dados via loadBillingMetrics()
// (service_role). Empty states cuidados — hoje a loja está fechada (sem
// pagamentos), mas a tela já popula sozinha quando os dados chegarem.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Gift, Users } from 'lucide-react'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { AdminShell } from '@/components/admin/AdminShell'
import {
  loadBillingMetrics,
  formatBRL,
  statusPagamentoLabel,
  billingTypeLabel,
  type BillingMetrics,
} from '@/lib/admin/billing'
import { formatarDataCurta } from '@/lib/utils/data'

export const dynamic = 'force-dynamic'

export default async function AdminBillingPage() {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  await logAdminAction('view_admin_billing')

  let m: BillingMetrics
  try {
    m = await loadBillingMetrics()
  } catch (err) {
    console.error('[/admin/billing] erro ao carregar billing:', err)
    return (
      <AdminShell>
        <div className="text-destructive">Erro ao carregar billing.</div>
      </AdminShell>
    )
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-page-title">Billing</h1>
        <p className="text-meta-xs">Receita, assinaturas e pagamentos do OptoMax</p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <StatCard
          titulo="MRR"
          valor={formatBRL(m.mrrCents)}
          sub={`${m.assinantesAtivos} × ${formatBRL(m.precoMensalCents)}`}
          tom="ok"
        />
        <StatCard titulo="Assinantes ativos" valor={String(m.assinantesAtivos)} sub="plano pago" />
        <StatCard
          titulo="Receita recebida"
          valor={formatBRL(m.receitaRecebidaCents)}
          sub="total confirmado"
        />
        <StatCard
          titulo="Em atraso"
          valor={String(m.emAtraso)}
          sub="pagantes past_due"
          tom={m.emAtraso > 0 ? 'destructive' : undefined}
        />
      </div>

      {/* Cards secundários */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard titulo="🎁 Cortesias" valor={String(m.cortesias)} sub="free sem prazo" />
        <StatCard titulo="Em teste grátis" valor={String(m.emTrial)} sub="trial vigente" />
        <StatCard
          titulo="Canceladas / expiradas"
          valor={String(m.canceladasOuExpiradas)}
          sub="churn (simplificado)"
          tom={m.canceladasOuExpiradas > 0 ? 'warning' : undefined}
        />
        <StatCard titulo="Preço mensal" valor={formatBRL(m.precoMensalCents)} sub="plano pago" />
      </div>

      {/* Pagamentos recentes */}
      <div className="mb-8">
        <h2 className="text-eyebrow mb-3">Pagamentos recentes</h2>
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left text-eyebrow">
                <th className="px-4 py-3 font-medium">Clínica</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
                <th className="px-4 py-3 font-medium">Forma</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Vencimento</th>
                <th className="px-4 py-3 font-medium">Pago em</th>
              </tr>
            </thead>
            <tbody>
              {m.pagamentosRecentes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum pagamento ainda. A tabela popula automaticamente quando a loja reabrir.
                  </td>
                </tr>
              )}
              {m.pagamentosRecentes.map((p) => {
                const st = statusPagamentoLabel(p.status)
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{p.orgNome}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono">
                      {formatBRL(p.amountCents)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{billingTypeLabel(p.billingType)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${TOM_BADGE[st.tom]}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatarDataCurta(p.dueDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatarDataCurta(p.paidAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assinantes pagos */}
      <div>
        <h2 className="text-eyebrow mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Assinantes (plano pago)
        </h2>
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {m.assinantes.length === 0 ? (
            <div className="px-4 py-10 text-center text-muted-foreground text-[13px] flex flex-col items-center gap-2">
              <Gift className="h-5 w-5" />
              Nenhuma assinatura paga ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {m.assinantes.map((a) => (
                <li key={a.orgId}>
                  <Link
                    href={`/admin/orgs/${a.orgId}/gestao`}
                    className="flex items-center justify-between gap-2 px-4 py-3 group hover:bg-muted/30"
                  >
                    <span className="text-[13px] font-medium truncate">{a.orgNome}</span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-[11px] font-medium ${
                          a.planStatus === 'past_due' ? 'text-destructive' : 'text-status-ok'
                        }`}
                      >
                        {a.planStatus === 'past_due' ? 'Em atraso' : 'Em dia'}
                      </span>
                      {a.proximoVencimento && (
                        <span className="text-[11px] text-muted-foreground">
                          venc. {formatarDataCurta(a.proximoVencimento)}
                        </span>
                      )}
                      <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminShell>
  )
}

// ── Apresentação ────────────────────────────────────────────────────────────

const TOM_CLASS: Record<string, string> = {
  ok: 'text-status-ok',
  warning: 'text-status-warning',
  destructive: 'text-destructive',
}

const TOM_BADGE: Record<string, string> = {
  ok: 'bg-status-ok-bg text-status-ok border-status-ok/30',
  warning: 'bg-status-warning-bg text-status-warning border-status-warning/30',
  destructive: 'bg-destructive-bg text-destructive border-destructive/30',
  muted: 'bg-muted text-muted-foreground border-border',
}

function StatCard({
  titulo,
  valor,
  sub,
  tom,
}: {
  titulo: string
  valor: string
  sub?: string
  tom?: 'ok' | 'warning' | 'destructive'
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tom ? TOM_CLASS[tom] : 'text-foreground'}`}>
        {valor}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}
