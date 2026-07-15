// Tab "Gestão" do detalhe da clínica — controles administrativos:
// acesso, trial, plano, dados cadastrais e link de redefinição de senha.
// Lê tudo via service_role; os mutadores vivem em ./actions.ts.

import { notFound, redirect } from 'next/navigation'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePlan } from '@/lib/utils/status'
import { GestaoForms } from './GestaoForms'

export const dynamic = 'force-dynamic'

export default async function AdminOrgGestaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const { id } = await params
  const supabase = createAdminClient()

  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, nome_clinica, telefone, endereco, plan, plan_status, trial_ends_at, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error || !org) notFound()

  // E-mail do titular (profile mais antigo da org) — para o card de senha.
  let emailTitular: string | null = null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (profile) {
    const { data: userData } = await supabase.auth.admin.getUserById(profile.id)
    emailTitular = userData?.user?.email ?? null
  }

  return (
    <GestaoForms
      orgId={org.id}
      nomeClinica={org.nome_clinica}
      telefone={org.telefone ?? ''}
      endereco={org.endereco ?? ''}
      plan={normalizePlan(org.plan)}
      planStatus={org.plan_status}
      trialEndsAt={org.trial_ends_at}
      emailTitular={emailTitular}
    />
  )
}
