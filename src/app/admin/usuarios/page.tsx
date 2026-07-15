// Aba "Usuários" do painel admin (/admin/usuarios).
// A listagem que antes era a home do /admin agora vive aqui; a home virou o
// Dashboard. Carrega métricas via loadAdminMetrics() (compartilhado), aplica o
// filtro de status e ordena (ativos primeiro, depois última atividade).

import { redirect } from 'next/navigation'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { orgPodeAcessar } from '@/lib/utils/status'
import { loadAdminMetrics } from '@/lib/admin/metrics'
import { AdminShell } from '@/components/admin/AdminShell'
import { AdminTable } from './AdminTable'

export const dynamic = 'force-dynamic'

// Filtro válido de status — qualquer outro valor cai em 'all'.
export type StatusFilter = 'all' | 'active' | 'suspended'

function normalizarFiltro(raw: string | undefined): StatusFilter {
  if (raw === 'active' || raw === 'suspended') return raw
  return 'all'
}

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const { status: statusRaw } = await searchParams
  const filtroStatus = normalizarFiltro(statusRaw)

  await logAdminAction('view_admin_list', { extra: { filtro: filtroStatus } })

  let todasLinhas
  try {
    todasLinhas = await loadAdminMetrics()
  } catch (err) {
    console.error('[/admin/usuarios] erro ao carregar métricas:', err)
    return (
      <AdminShell>
        <div className="text-destructive">Erro ao carregar usuários.</div>
      </AdminShell>
    )
  }

  // Filtro de status: 'active' = org com acesso; 'suspended' = sem acesso.
  const linhas =
    filtroStatus === 'all'
      ? todasLinhas
      : todasLinhas.filter((r) =>
          filtroStatus === 'active' ? orgPodeAcessar(r.orgStatus) : !orgPodeAcessar(r.orgStatus),
        )

  // Ordena: ativos primeiro, depois por última atividade mais recente.
  linhas.sort((a, b) => {
    const aAtivo = orgPodeAcessar(a.orgStatus)
    const bAtivo = orgPodeAcessar(b.orgStatus)
    if (aAtivo !== bAtivo) return aAtivo ? -1 : 1
    const ta = a.ultimaAtividade ? new Date(a.ultimaAtividade).getTime() : 0
    const tb = b.ultimaAtividade ? new Date(b.ultimaAtividade).getTime() : 0
    return tb - ta
  })

  const totalAll = todasLinhas.length
  const totalActive = todasLinhas.filter((r) => orgPodeAcessar(r.orgStatus)).length
  const totalSuspended = totalAll - totalActive

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="text-page-title">Usuários</h1>
        <p className="text-meta-xs">Todas as clínicas cadastradas e suas métricas de uso</p>
      </div>
      <AdminTable
        linhas={linhas}
        filtroAtivo={filtroStatus}
        totais={{ all: totalAll, active: totalActive, suspended: totalSuspended }}
      />
    </AdminShell>
  )
}
