'use server'

// Server action de criação de notas administrativas. Imutável (sem UPDATE/DELETE).
// Auditada via admin_audit_log com action='create_org_note'.

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'

const notaSchema = z.object({
  orgId: z.string().uuid({ message: 'org_id inválido' }),
  content: z
    .string()
    .trim()
    .min(1, { message: 'A nota não pode ser vazia.' })
    .max(5000, { message: 'A nota deve ter no máximo 5000 caracteres.' }),
})

export async function criarNotaOrg(
  formData: FormData,
): Promise<{ error: string | null }> {
  // Defesa em profundidade: revalida cookie admin antes de qualquer escrita.
  const autenticado = await isAdminAuthenticated()
  if (!autenticado) {
    return { error: 'Sessão admin expirada' }
  }

  const parsed = notaSchema.safeParse({
    orgId: formData.get('orgId'),
    content: formData.get('content'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const { orgId, content } = parsed.data
  const supabase = createAdminClient()

  const { error } = await supabase.from('organization_notes').insert({
    org_id: orgId,
    author_admin: 'admin',
    content,
  })

  if (error) {
    return { error: error.message }
  }

  // Audit log: registra criação de nota.
  await logAdminAction('create_org_note', {
    targetOrgId: orgId,
    extra: { content_length: content.length },
  })

  revalidatePath(`/admin/orgs/${orgId}/notas`)
  return { error: null }
}
