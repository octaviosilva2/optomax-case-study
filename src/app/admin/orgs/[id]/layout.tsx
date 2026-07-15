// Layout da página de detalhes do tester — header + tabs + child da tab ativa.
//
// Decisão arquitetural (Fase 6): NÃO faz impersonate de sessão. Em vez disso,
// lê todos os dados do tester via SERVICE_ROLE e mantém o admin com seu contexto
// próprio o tempo todo. Política de Privacidade §11 cobre esse acesso.
//
// Cada child (profile, pacientes, etc.) é uma sub-rota server-side independente
// que loga sua própria action no admin_audit_log.

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAdminAction } from '@/lib/admin-audit'
import { statusBadgeClass, statusLabel } from './_layout-helpers'
import { OrgTabsNav } from './OrgTabsNav'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function AdminOrgDetalheLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  // Guard: sem cookie admin → /admin/login. O cookie tem path='/admin' então
  // é enviado também em /admin/orgs/[id]/*.
  const ok = await isAdminAuthenticated()
  if (!ok) redirect('/admin/login')

  const { id } = await params

  // Busca metadados da org (nome + status + flag de exclusão) via service role.
  const supabase = createAdminClient()
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, nome_clinica, plan, plan_status, deletion_requested_at')
    .eq('id', id)
    .maybeSingle()

  if (error || !org) {
    notFound()
  }

  // Audit log: registra visualização da página de detalhes.
  // Fire-and-forget, não bloqueia o render.
  await logAdminAction('view_org_details', { targetOrgId: org.id })

  const badgeClass = statusBadgeClass(org.plan_status, !!org.deletion_requested_at)
  const badge = statusLabel(org.plan_status, !!org.deletion_requested_at)

  return (
    <div className="min-h-screen bg-muted">
      {/* Header com voltar + nome da clinica + status */}
      <header className="bg-card border-b border-border px-6 py-4">
        {/* Breadcrumb editorial */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-eyebrow font-mono mb-3"
        >
          <Link href="/admin" className="hover:text-foreground transition-colors">
            Admin
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span>Orgs</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate max-w-[200px]">{org.nome_clinica}</span>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="h-8 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-page-title truncate">
                {org.nome_clinica}
              </h1>
              <Badge variant="accent">ADMIN</Badge>
            </div>
            <p className="text-meta-xs">
              Plano: <span className="font-medium">{org.plan}</span> · ID: <span className="font-mono tabular-nums">{org.id.slice(0, 8)}...</span>
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${badgeClass}`}
          >
            {badge}
          </span>
        </div>

        <OrgTabsNav orgId={org.id} />
      </header>

      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  )
}
