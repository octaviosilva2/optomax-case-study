// Aba "Auditoria" do painel admin (/admin/auditoria).
// Lista as ações administrativas registradas em admin_audit_log (acesso e
// mutações feitas pela equipe OptoMax). Política de Privacidade §11 cobre.
// Read-only, via service_role. Limitado às 200 entradas mais recentes.

import { redirect } from 'next/navigation'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAdminAction, type AdminAction } from '@/lib/admin-audit'
import { formatarDataHora } from '@/lib/utils/data'
import { AdminShell } from '@/components/admin/AdminShell'

export const dynamic = 'force-dynamic'

// Rótulos amigáveis por ação. Fallback: o próprio código da ação.
const ACTION_LABEL: Record<AdminAction, string> = {
  view_admin_list: 'Listou usuários',
  view_admin_dashboard: 'Abriu o dashboard',
  view_admin_audit: 'Abriu a auditoria',
  view_admin_billing: 'Abriu o billing',
  view_admin_planos: 'Abriu os planos',
  view_org_details: 'Viu detalhes da clínica',
  view_org_patients: 'Viu pacientes',
  view_org_records: 'Viu fichas',
  view_org_prescriptions: 'Viu receitas',
  view_org_timeline: 'Viu timeline',
  view_org_notes: 'Viu notas',
  create_org_note: 'Criou nota',
  toggle_org_status: 'Alterou status de acesso',
  update_org_trial: 'Editou o trial',
  update_org_plan: 'Alterou o plano',
  update_org_data: 'Editou dados da clínica',
  generate_recovery_link: 'Gerou link de senha',
  grant_courtesy: 'Concedeu acesso cortesia',
  revoke_courtesy: 'Removeu acesso cortesia',
  impersonate_user: 'Entrou como o usuário',
  update_plan_pricing: 'Editou preço do plano',
  update_trial_config: 'Editou o teste grátis',
}

export default async function AdminAuditoriaPage() {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  await logAdminAction('view_admin_audit')

  const supabase = createAdminClient()
  const { data: logs, error } = await supabase
    .from('admin_audit_log')
    .select('id, action, target_org_id, admin_identifier, ip, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  // Resolve nome da clínica alvo (consulta única, mapeada por id).
  const orgIds = [...new Set((logs ?? []).map((l) => l.target_org_id).filter(Boolean))] as string[]
  const nomeByOrg = new Map<string, string>()
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, nome_clinica')
      .in('id', orgIds)
    for (const o of orgs ?? []) nomeByOrg.set(o.id, o.nome_clinica)
  }

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="text-page-title">Auditoria</h1>
        <p className="text-meta-xs">Últimas 200 ações administrativas no painel</p>
      </div>

      {error ? (
        <div className="text-destructive">Erro ao carregar a auditoria.</div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left text-eyebrow">
                <th className="px-4 py-3 font-medium">Quando</th>
                <th className="px-4 py-3 font-medium">Ação</th>
                <th className="px-4 py-3 font-medium">Clínica</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {(logs ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhuma ação registrada ainda.
                  </td>
                </tr>
              )}
              {(logs ?? []).map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap tabular-nums">
                    {formatarDataHora(log.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {ACTION_LABEL[log.action as AdminAction] ?? log.action}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {log.target_org_id ? nomeByOrg.get(log.target_org_id) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{log.admin_identifier}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                    {log.ip ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  )
}
