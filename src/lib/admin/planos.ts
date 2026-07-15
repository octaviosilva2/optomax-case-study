// Carregamento da config de planos do /admin/planos (Fase 5C).
//
// Lê o plano pago (tabela `plans`) + a duração do teste grátis (app_settings.
// trial_days). A tabela app_settings pode ainda não existir em prod (migration
// 20260626_app_settings_trial.sql sob gate) — por isso a leitura é tolerante:
// se a tabela faltar, devolve o fallback de 7 dias e marca settingsDisponivel=false.

import { createAdminClient } from '@/lib/supabase/admin'

export const TRIAL_DAYS_FALLBACK = 7

export type PlanoConfig = {
  id: string
  slug: string
  name: string
  amountCents: number
  isActive: boolean
}

export type PlanosConfig = {
  plano: PlanoConfig | null
  trialDays: number
  // false quando a tabela app_settings ainda não existe (migration não aplicada).
  settingsDisponivel: boolean
}

/** Lê o valor de uma chave de app_settings; null se a linha não existir.
 * tabelaExiste fica false só em erro inesperado (defesa em profundidade —
 * a tabela já existe em prod desde a migration 20260626_app_settings_trial). */
async function lerSetting(key: string): Promise<{ value: string | null; tabelaExiste: boolean }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error) return { value: null, tabelaExiste: false }
  return { value: data?.value ?? null, tabelaExiste: true }
}

export async function loadPlanosConfig(): Promise<PlanosConfig> {
  const supabase = createAdminClient()

  const { data: planos } = await supabase
    .from('plans')
    .select('id, slug, name, amount_cents, is_active, sort_order')
    .order('sort_order', { ascending: true })

  const p = planos?.[0]
  const plano: PlanoConfig | null = p
    ? {
        id: p.id,
        slug: p.slug,
        name: p.name,
        amountCents: p.amount_cents ?? 0,
        isActive: p.is_active ?? false,
      }
    : null

  const { value, tabelaExiste } = await lerSetting('trial_days')
  const parsed = value ? parseInt(value, 10) : NaN
  const trialDays = Number.isFinite(parsed) && parsed > 0 ? parsed : TRIAL_DAYS_FALLBACK

  return { plano, trialDays, settingsDisponivel: tabelaExiste }
}
