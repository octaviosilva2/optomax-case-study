'use server'

// Server actions de gestão da clínica (tab Gestão do /admin/orgs/[id]).
// Todas: revalidam o cookie admin (defesa em profundidade), validam com Zod,
// escrevem via service_role e registram no admin_audit_log.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { PLANS } from '@/lib/utils/status'

const orgIdSchema = z.string().uuid({ message: 'org_id inválido' })

// Garante sessão admin. Retorna a mensagem de erro ou null.
async function guard(): Promise<string | null> {
  return (await isAdminAuthenticated()) ? null : 'Sessão admin expirada'
}

function revalidarOrg(orgId: string) {
  revalidatePath(`/admin/orgs/${orgId}/gestao`)
  revalidatePath('/admin')
  revalidatePath('/admin/usuarios')
}

/**
 * Define a data exata de término do trial (input 'YYYY-MM-DD' → fim do dia BR).
 * Passar null limpa a data (org sem prazo definido).
 */
export async function definirTrial(
  orgId: string,
  data: string | null,
): Promise<{ error: string | null }> {
  const err = await guard()
  if (err) return { error: err }
  if (!orgIdSchema.safeParse(orgId).success) return { error: 'org_id inválido' }

  let novoIso: string | null = null
  if (data) {
    // Fim do dia em horário de Brasília — conta o dia inteiro escolhido.
    const d = new Date(`${data}T23:59:59.999-03:00`)
    if (isNaN(d.getTime())) return { error: 'Data inválida' }
    novoIso = d.toISOString()
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('organizations')
    .update({ trial_ends_at: novoIso, updated_at: new Date().toISOString() })
    .eq('id', orgId)
  if (error) return { error: error.message }

  await logAdminAction('update_org_trial', {
    targetOrgId: orgId,
    extra: { mode: 'set_date', value: novoIso },
  })
  revalidarOrg(orgId)
  return { error: null }
}

/**
 * Estende o trial por N dias a partir do maior entre "agora" e a data atual
 * (não encurta acidentalmente um trial que ainda está no futuro).
 */
export async function estenderTrial(
  orgId: string,
  dias: number,
): Promise<{ error: string | null }> {
  const err = await guard()
  if (err) return { error: err }
  if (!orgIdSchema.safeParse(orgId).success) return { error: 'org_id inválido' }
  if (!Number.isInteger(dias) || dias <= 0 || dias > 3650) {
    return { error: 'Número de dias inválido' }
  }

  const supabase = createAdminClient()
  const { data: org, error: readErr } = await supabase
    .from('organizations')
    .select('trial_ends_at')
    .eq('id', orgId)
    .maybeSingle()
  if (readErr || !org) return { error: readErr?.message ?? 'Clínica não encontrada' }

  const agora = Date.now()
  const atual = org.trial_ends_at ? new Date(org.trial_ends_at).getTime() : 0
  const base = Math.max(agora, atual)
  const nova = new Date(base + dias * 24 * 60 * 60 * 1000)

  const { error } = await supabase
    .from('organizations')
    .update({ trial_ends_at: nova.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', orgId)
  if (error) return { error: error.message }

  await logAdminAction('update_org_trial', {
    targetOrgId: orgId,
    extra: { mode: 'extend', dias },
  })
  revalidarOrg(orgId)
  return { error: null }
}

/** Encerra o trial agora (trial_ends_at = now). Não bloqueia acesso por si só. */
export async function encerrarTrial(orgId: string): Promise<{ error: string | null }> {
  const err = await guard()
  if (err) return { error: err }
  if (!orgIdSchema.safeParse(orgId).success) return { error: 'org_id inválido' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('organizations')
    .update({ trial_ends_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', orgId)
  if (error) return { error: error.message }

  await logAdminAction('update_org_trial', { targetOrgId: orgId, extra: { mode: 'end_now' } })
  revalidarOrg(orgId)
  return { error: null }
}

/**
 * Concede acesso CORTESIA (free, sem cobrar) em um de dois modos:
 *   - 'permanente' → trial_ends_at = NULL, plan_status = 'active' (nunca expira).
 *   - 'prazo'      → trial_ends_at = fim do dia da data dada, plan_status =
 *                    'trialing' (o cron do paywall corta quando vencer → exige pagar).
 * Sempre seta plan = 'free'. Não cria nenhuma cobrança no ASAAS.
 */
export async function concederCortesia(
  orgId: string,
  modo: 'permanente' | 'prazo',
  ateData?: string | null,
): Promise<{ error: string | null }> {
  const err = await guard()
  if (err) return { error: err }
  if (!orgIdSchema.safeParse(orgId).success) return { error: 'org_id inválido' }

  let trialEndsAt: string | null = null
  let planStatus = 'active'
  if (modo === 'prazo') {
    if (!ateData) return { error: 'Informe a data limite da cortesia' }
    const d = new Date(`${ateData}T23:59:59.999-03:00`)
    if (isNaN(d.getTime())) return { error: 'Data inválida' }
    trialEndsAt = d.toISOString()
    planStatus = 'trialing'
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('organizations')
    .update({
      plan: 'free',
      plan_status: planStatus,
      trial_ends_at: trialEndsAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)
  if (error) return { error: error.message }

  await logAdminAction('grant_courtesy', { targetOrgId: orgId, extra: { modo, ateData: ateData ?? null } })
  revalidarOrg(orgId)
  return { error: null }
}

/**
 * Remove a cortesia: mantém plan = 'free' mas marca plan_status = 'expired'
 * (paywall) — a org passa a precisar pagar para voltar a usar.
 */
export async function removerCortesia(orgId: string): Promise<{ error: string | null }> {
  const err = await guard()
  if (err) return { error: err }
  if (!orgIdSchema.safeParse(orgId).success) return { error: 'org_id inválido' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('organizations')
    .update({ plan: 'free', plan_status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', orgId)
  if (error) return { error: error.message }

  await logAdminAction('revoke_courtesy', { targetOrgId: orgId })
  revalidarOrg(orgId)
  return { error: null }
}

/**
 * Gera um magic link de acesso ao APP como o titular da clínica ("entrar como").
 * Ação sensível (acesso a dados de paciente) — registra em auditoria. O link
 * abre uma sessão real do cliente em app.* (domínio separado do cookie /admin).
 */
export async function impersonarUsuario(
  orgId: string,
): Promise<{ error: string | null; link?: string }> {
  const err = await guard()
  if (err) return { error: err }
  if (!orgIdSchema.safeParse(orgId).success) return { error: 'org_id inválido' }

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!profile) return { error: 'Nenhum usuário nesta clínica' }

  const { data: userData } = await supabase.auth.admin.getUserById(profile.id)
  const email = userData?.user?.email
  if (!email) return { error: 'E-mail do titular não encontrado' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${appUrl}/dashboard` },
  })
  if (error) return { error: error.message }

  await logAdminAction('impersonate_user', { targetOrgId: orgId, targetUserId: profile.id })
  return { error: null, link: data.properties?.action_link }
}

/** Define o plano da org ('admin' | 'free' | 'pago'). */
export async function definirPlano(
  orgId: string,
  plan: string,
): Promise<{ error: string | null }> {
  const err = await guard()
  if (err) return { error: err }
  if (!orgIdSchema.safeParse(orgId).success) return { error: 'org_id inválido' }
  if (!(PLANS as readonly string[]).includes(plan)) return { error: 'Plano inválido' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('organizations')
    .update({ plan, updated_at: new Date().toISOString() })
    .eq('id', orgId)
  if (error) return { error: error.message }

  await logAdminAction('update_org_plan', { targetOrgId: orgId, extra: { plan } })
  revalidarOrg(orgId)
  return { error: null }
}

const dadosSchema = z.object({
  nome_clinica: z.string().trim().min(1, 'Nome obrigatório').max(120),
  telefone: z.string().trim().max(40).optional().or(z.literal('')),
  endereco: z.string().trim().max(200).optional().or(z.literal('')),
})

/** Atualiza dados cadastrais da clínica (nome, telefone, endereço). */
export async function atualizarDadosOrg(
  orgId: string,
  dados: { nome_clinica: string; telefone: string; endereco: string },
): Promise<{ error: string | null }> {
  const err = await guard()
  if (err) return { error: err }
  if (!orgIdSchema.safeParse(orgId).success) return { error: 'org_id inválido' }
  const parsed = dadosSchema.safeParse(dados)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('organizations')
    .update({
      nome_clinica: parsed.data.nome_clinica,
      telefone: parsed.data.telefone || null,
      endereco: parsed.data.endereco || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)
  if (error) return { error: error.message }

  await logAdminAction('update_org_data', { targetOrgId: orgId })
  revalidarOrg(orgId)
  return { error: null }
}

/**
 * Gera um link de redefinição de senha (recovery) para o titular da clínica.
 * Não depende de SMTP — o admin copia o link e envia manualmente. Resolve o
 * e-mail pelo profile mais antigo da org.
 */
export async function gerarLinkRecuperacao(
  orgId: string,
): Promise<{ error: string | null; link?: string }> {
  const err = await guard()
  if (err) return { error: err }
  if (!orgIdSchema.safeParse(orgId).success) return { error: 'org_id inválido' }

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!profile) return { error: 'Nenhum usuário nesta clínica' }

  const { data: userData } = await supabase.auth.admin.getUserById(profile.id)
  const email = userData?.user?.email
  if (!email) return { error: 'E-mail do titular não encontrado' }

  const { data, error } = await supabase.auth.admin.generateLink({ type: 'recovery', email })
  if (error) return { error: error.message }

  await logAdminAction('generate_recovery_link', { targetOrgId: orgId, targetUserId: profile.id })
  return { error: null, link: data.properties?.action_link }
}
