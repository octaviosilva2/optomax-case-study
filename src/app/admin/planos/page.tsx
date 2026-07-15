// Aba "Planos" do painel admin (/admin/planos — Fase 5C).
// Edita o plano pago (nome, preço, ativo) e a duração do teste grátis.
// Leitura via loadPlanosConfig (service_role); mutações em ./actions.ts.

import { redirect } from 'next/navigation'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { AdminShell } from '@/components/admin/AdminShell'
import { loadPlanosConfig } from '@/lib/admin/planos'
import { PlanosForms } from './PlanosForms'

export const dynamic = 'force-dynamic'

export default async function AdminPlanosPage() {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  await logAdminAction('view_admin_planos')

  const config = await loadPlanosConfig()

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-page-title">Planos</h1>
        <p className="text-meta-xs">Preço do plano pago e duração do teste grátis</p>
      </div>
      <PlanosForms config={config} />
    </AdminShell>
  )
}
