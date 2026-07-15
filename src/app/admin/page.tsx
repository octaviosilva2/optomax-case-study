// Dashboard do painel administrativo (/admin).
//
// Visão geral agregada de todas as clínicas: cards de contagem (total, acesso,
// plano, trials, engajamento, cadastros recentes), somatórios de uso e duas
// listas de atenção (trials vencendo/expirados e clínicas sem uso).
//
// A listagem detalhada (tabela) vive em /admin/usuarios. Dados via
// loadAdminMetrics() — o mesmo helper compartilhado.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { orgPodeAcessar, planoEhIlimitado, diasRestantesTrial } from '@/lib/utils/status'
import { loadAdminMetrics, type AdminMetricRow } from '@/lib/admin/metrics'
import { AdminShell } from '@/components/admin/AdminShell'

export const dynamic = 'force-dynamic'

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  await logAdminAction('view_admin_dashboard')

  let linhas: AdminMetricRow[]
  try {
    linhas = await loadAdminMetrics()
  } catch (err) {
    console.error('[/admin] erro ao carregar dashboard:', err)
    return (
      <AdminShell>
        <div className="text-destructive">Erro ao carregar dashboard.</div>
      </AdminShell>
    )
  }

  // Dedup por org — a RPC retorna 1 linha por profile; métricas de org-level
  // devem contar cada clínica uma vez. Usa a 1ª linha como representante.
  const orgsMap = new Map<string, AdminMetricRow>()
  for (const r of linhas) {
    if (!orgsMap.has(r.orgId)) orgsMap.set(r.orgId, r)
  }
  const orgs = [...orgsMap.values()]

  // ---- Contagens de acesso e plano ----
  const totalClinicas = orgs.length
  const ativas = orgs.filter((o) => orgPodeAcessar(o.orgStatus)).length
  const desativadas = totalClinicas - ativas
  const admins = orgs.filter((o) => planoEhIlimitado(o.plan)).length
  const betas = totalClinicas - admins

  // ---- Trials (só plano beta) ----
  const betaOrgs = orgs.filter((o) => !planoEhIlimitado(o.plan))
  let emTrial = 0
  let trialExpirando = 0 // vence em 1..3 dias
  let trialExpirado = 0
  const trialsAtencao: { row: AdminMetricRow; dias: number }[] = []
  for (const o of betaOrgs) {
    const dias = diasRestantesTrial(o.trialEndsAt, o.plan)
    if (dias === null) continue
    if (dias > 0) emTrial++
    if (dias <= 0) trialExpirado++
    else if (dias <= 3) trialExpirando++
    if (dias <= 3) trialsAtencao.push({ row: o, dias })
  }
  trialsAtencao.sort((a, b) => a.dias - b.dias)

  // ---- Engajamento (por org representante) ----
  const engajadas = orgs.filter((o) => o.status === 'engajado').length
  const baixoUso = orgs.filter((o) => o.status === 'baixo_uso').length
  const semUso = orgs.filter((o) => o.status === 'sem_uso').length

  // ---- Cadastros nos últimos 7 dias (por conta de usuário) ----
  const novos7d = linhas.filter(
    (r) => r.authCreatedAt && Date.now() - new Date(r.authCreatedAt).getTime() <= SETE_DIAS_MS,
  ).length

  // ---- Somatórios de uso (sobre orgs únicas) ----
  const totPacientes = orgs.reduce((s, o) => s + o.pacientes, 0)
  const totFichas = orgs.reduce((s, o) => s + o.fichasCompletas, 0)
  const totPdfs = orgs.reduce((s, o) => s + o.pdfsGerados, 0)
  const totAbandonadas = orgs.reduce((s, o) => s + o.fichasAbandonadas, 0)

  // Clínicas ativas mas sem uso — candidatas a follow-up.
  const semUsoAtencao = orgs
    .filter((o) => o.status === 'sem_uso' && orgPodeAcessar(o.orgStatus))
    .slice(0, 8)

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-page-title">Visão geral</h1>
        <p className="text-meta-xs">Resumo de todas as clínicas e do uso do sistema</p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <StatCard titulo="Clínicas" valor={totalClinicas} sub={`${admins} admin · ${betas} beta`} />
        <StatCard titulo="Com acesso" valor={ativas} sub={`${desativadas} desativadas`} tom="ok" />
        <StatCard
          titulo="Em trial"
          valor={emTrial}
          sub={`${trialExpirando} vencendo ≤3d`}
          tom={trialExpirando > 0 ? 'warning' : undefined}
        />
        <StatCard
          titulo="Trials expirados"
          valor={trialExpirado}
          sub="ainda com acesso"
          tom={trialExpirado > 0 ? 'destructive' : undefined}
        />
      </div>

      {/* Cards secundários */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard titulo="🟢 Engajadas" valor={engajadas} />
        <StatCard titulo="🟡 Baixo uso" valor={baixoUso} />
        <StatCard titulo="🔴 Sem uso" valor={semUso} />
        <StatCard titulo="Novos (7 dias)" valor={novos7d} sub="cadastros recentes" />
      </div>

      {/* Somatórios de uso */}
      <div className="mb-8">
        <h2 className="text-eyebrow mb-3">Uso acumulado</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard titulo="Pacientes" valor={totPacientes} />
          <StatCard titulo="Fichas finalizadas" valor={totFichas} />
          <StatCard titulo="PDFs gerados" valor={totPdfs} />
          <StatCard
            titulo="Fichas abandonadas"
            valor={totAbandonadas}
            tom={totAbandonadas > 0 ? 'warning' : undefined}
          />
        </div>
      </div>

      {/* Listas de atenção */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ListaAtencao
          titulo="Trials vencendo / expirados"
          icone={<Clock className="h-4 w-4 text-status-warning" />}
          vazio="Nenhum trial próximo do fim."
        >
          {trialsAtencao.map(({ row, dias }) => (
            <LinhaAtencao
              key={row.orgId}
              orgId={row.orgId}
              nome={row.orgNome}
              detalhe={dias <= 0 ? 'Expirado' : `Faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
              tom={dias <= 0 ? 'destructive' : 'warning'}
            />
          ))}
        </ListaAtencao>

        <ListaAtencao
          titulo="Clínicas ativas sem uso"
          icone={<AlertTriangle className="h-4 w-4 text-destructive" />}
          vazio="Todas as clínicas ativas estão usando o sistema."
        >
          {semUsoAtencao.map((o) => (
            <LinhaAtencao
              key={o.orgId}
              orgId={o.orgId}
              nome={o.orgNome}
              detalhe={`${o.pacientes} pacientes`}
              tom="destructive"
            />
          ))}
        </ListaAtencao>
      </div>
    </AdminShell>
  )
}

// ── Componentes de apresentação ─────────────────────────────────────────────

const TOM_CLASS: Record<string, string> = {
  ok: 'text-status-ok',
  warning: 'text-status-warning',
  destructive: 'text-destructive',
}

function StatCard({
  titulo,
  valor,
  sub,
  tom,
}: {
  titulo: string
  valor: number
  sub?: string
  tom?: 'ok' | 'warning' | 'destructive'
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {titulo}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tom ? TOM_CLASS[tom] : 'text-foreground'}`}>
        {valor}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

function ListaAtencao({
  titulo,
  icone,
  vazio,
  children,
}: {
  titulo: string
  icone: React.ReactNode
  vazio: string
  children: React.ReactNode
}) {
  const items = Array.isArray(children) ? children : [children]
  const temItem = items.some(Boolean) && items.length > 0 && items[0] !== undefined
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
        {icone}
        {titulo}
      </h3>
      {temItem ? (
        <ul className="divide-y divide-border">{children}</ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">{vazio}</p>
      )}
    </div>
  )
}

function LinhaAtencao({
  orgId,
  nome,
  detalhe,
  tom,
}: {
  orgId: string
  nome: string
  detalhe: string
  tom: 'warning' | 'destructive'
}) {
  return (
    <li>
      <Link
        href={`/admin/orgs/${orgId}/gestao`}
        className="flex items-center justify-between gap-2 py-2 group"
      >
        <span className="text-[13px] font-medium truncate group-hover:text-foreground">{nome}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[11px] font-medium ${
              tom === 'destructive' ? 'text-destructive' : 'text-status-warning'
            }`}
          >
            {detalhe}
          </span>
          <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </span>
      </Link>
    </li>
  )
}
