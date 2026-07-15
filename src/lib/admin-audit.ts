// Auditoria do painel /admin — registra acesso administrativo a dados de testers.
// Política de Privacidade §11 cobre esse acesso ("Logs de auditoria para acessos
// administrativos da equipe OptoMax aos dados de Clientes em modo suporte").
//
// Princípios:
//   - Fire-and-forget: falha de log NUNCA quebra a navegação no /admin.
//   - SERVICE_ROLE direto: bypass de RLS (a tabela tem RLS ON sem policies).
//   - Identificador do admin: por enquanto string fixa "admin" (apenas 1 fundador
//     opera o painel). Caminho de upgrade: extrair sub do cookie HMAC.

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

export type AdminAction =
  | 'view_admin_list'
  | 'view_admin_dashboard'
  | 'view_admin_audit'
  | 'view_admin_billing'
  | 'view_admin_planos'
  | 'view_org_details'
  | 'view_org_patients'
  | 'view_org_records'
  | 'view_org_prescriptions'
  | 'view_org_timeline'
  | 'view_org_notes'
  | 'create_org_note'
  | 'toggle_org_status'
  | 'update_org_trial'
  | 'update_org_plan'
  | 'update_org_data'
  | 'generate_recovery_link'
  | 'grant_courtesy'
  | 'revoke_courtesy'
  | 'impersonate_user'
  | 'update_plan_pricing'
  | 'update_trial_config'

/**
 * Registra ação administrativa no admin_audit_log.
 * Falha silenciosamente — nunca trava o /admin se o INSERT falhar.
 *
 * @param action Nome canônico da ação (enum AdminAction).
 * @param payload Contexto opcional (target org/user + extra livre).
 */
export async function logAdminAction(
  action: AdminAction,
  payload: {
    targetOrgId?: string | null
    targetUserId?: string | null
    extra?: Record<string, Json>
  } = {},
): Promise<void> {
  try {
    const h = await headers()
    // Captura IP via cadeia de proxies (Vercel injeta x-forwarded-for).
    const ip = h.get('x-forwarded-for')?.split(',')[0].trim() ?? h.get('x-real-ip') ?? null
    const ua = h.get('user-agent')
    // Identificador fixo por enquanto — apenas 1 fundador opera o /admin.
    const adminIdentifier = h.get('x-admin-identifier') ?? 'admin'

    const supabase = createAdminClient()
    await supabase.from('admin_audit_log').insert({
      action,
      target_org_id: payload.targetOrgId ?? null,
      target_user_id: payload.targetUserId ?? null,
      admin_identifier: adminIdentifier,
      ip,
      user_agent: ua,
      payload: payload.extra ?? {},
    })
  } catch (err) {
    // Não-fatal — apenas log no console do servidor.
    console.error('[admin-audit] falhou:', err)
  }
}
