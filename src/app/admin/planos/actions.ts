'use server'

// Server actions da config de planos (/admin/planos — Fase 5C).
// Revalidam o cookie admin, validam com Zod, escrevem via service_role e
// registram no admin_audit_log.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'

async function guard(): Promise<string | null> {
  return (await isAdminAuthenticated()) ? null : 'Sessão admin expirada'
}

const planoSchema = z.object({
  id: z.string().uuid({ message: 'plano inválido' }),
  name: z.string().trim().min(1, 'Nome obrigatório').max(80),
  // Preço em reais (string do input) → centavos. Aceita vírgula ou ponto.
  amountReais: z
    .string()
    .trim()
    .min(1, 'Preço obrigatório')
    .refine((s) => /^\d+([.,]\d{1,2})?$/.test(s), 'Preço inválido'),
  isActive: z.boolean(),
})

/** Atualiza nome, preço e status ativo do plano. */
export async function atualizarPlano(input: {
  id: string
  name: string
  amountReais: string
  isActive: boolean
}): Promise<{ error: string | null }> {
  const err = await guard()
  if (err) return { error: err }

  const parsed = planoSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const amountCents = Math.round(parseFloat(parsed.data.amountReais.replace(',', '.')) * 100)
  if (!Number.isFinite(amountCents) || amountCents <= 0) return { error: 'Preço inválido' }

  const supabase = createAdminClient()
  const { error: updErr } = await supabase
    .from('plans')
    .update({
      name: parsed.data.name,
      amount_cents: amountCents,
      is_active: parsed.data.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
  if (updErr) return { error: updErr.message }

  await logAdminAction('update_plan_pricing', {
    extra: { planId: parsed.data.id, amountCents, isActive: parsed.data.isActive },
  })
  revalidatePath('/admin/planos')
  revalidatePath('/admin/billing')
  return { error: null }
}

/**
 * Atualiza a duração do teste grátis (app_settings.trial_days). Requer a
 * migration 20260626_app_settings_trial.sql aplicada — se a tabela não existir,
 * devolve erro orientando aplicar a migration.
 */
export async function atualizarTrialDias(dias: number): Promise<{ error: string | null }> {
  const err = await guard()
  if (err) return { error: err }
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
    return { error: 'Dias inválidos (1 a 365)' }
  }

  const supabase = createAdminClient()
  const { error: upErr } = await supabase
    .from('app_settings')
    .upsert({ key: 'trial_days', value: String(dias), updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (upErr) {
    return {
      error: 'Não foi possível salvar a duração do teste grátis. Tente novamente.',
    }
  }

  await logAdminAction('update_trial_config', { extra: { trialDays: dias } })
  revalidatePath('/admin/planos')
  return { error: null }
}
