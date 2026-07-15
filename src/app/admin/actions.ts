'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminAuthenticated, logoutAdmin } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { PLAN_STATUSES, type PlanStatus } from '@/lib/utils/status'

// F6-A04: schema aceita TODO o superset canonico de plan_status (matching
// CHECK organizations_plan_status_check). UX padrão do toggle continua sendo
// 'active' <-> 'inactive', mas a action grava qualquer estado válido caso
// outro caminho (billing futuro, suporte manual) precise atualizar.
const novoStatusSchema = z.enum(PLAN_STATUSES)

/**
 * Alterna o status da organização (plan_status). Aceita qualquer valor do
 * superset canonico em PLAN_STATUSES — UX do botão default é binária mas a
 * action está pronta para qualquer transição.
 * Usa supabaseAdmin (bypass RLS) — defesa em profundidade: além do middleware/guard
 * do layout /admin, recheca o cookie HMAC aqui antes de mutar dados.
 */
export async function toggleOrgStatus(
  orgId: string,
  novoStatus: PlanStatus,
): Promise<{ error: string | null }> {
  // Defesa em profundidade: revalida sessão admin antes de qualquer escrita
  const autenticado = await isAdminAuthenticated()
  if (!autenticado) {
    return { error: 'Sessão admin expirada' }
  }
  const parsed = novoStatusSchema.safeParse(novoStatus)
  if (!parsed.success) {
    return { error: 'Status inválido' }
  }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('organizations')
    .update({ plan_status: parsed.data, updated_at: new Date().toISOString() })
    .eq('id', orgId)
  if (error) return { error: error.message }

  // Audit log: registra a alteração de status.
  await logAdminAction('toggle_org_status', {
    targetOrgId: orgId,
    extra: { new_status: parsed.data },
  })

  revalidatePath('/admin')
  return { error: null }
}

export async function logoutAdminAction(): Promise<void> {
  await logoutAdmin()
  redirect('/admin/login')
}
