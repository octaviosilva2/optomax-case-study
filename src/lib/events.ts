// Helper para log de eventos comportamentais usados pelo painel /admin.
//
// Princípios:
//   - Fire-and-forget: falha de log NUNCA quebra a operação principal.
//   - Sempre vincula a user_id + org_id do profile autenticado (RLS valida).
//   - Server e Client têm assinaturas separadas para evitar usar o cliente errado.
//
// Lista canônica de eventos vivos no produto está em:
//   optomax-os/domains/tecnologia/dev/knowledge/stack/banco-schema.md

import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

export type EventName =
  | 'user_first_login'
  | 'session_started'
  | 'session_ended'
  | 'patient_created'
  | 'appointment_created'
  | 'clinical_record_opened'
  | 'clinical_record_completed'
  | 'grade_evolution_viewed'
  | 'prescription_pdf_generated'
  | 'prescription_pdf_downloaded'
  // Etapa 11 (2026-05-12) — eventos do PDF da ficha clínica:
  | 'clinical_record_pdf_generated'
  | 'clinical_record_pdf_downloaded'
  | 'clinical_record_pdf_public_downloaded'
  // Fase 8 (2026-05-18) — LGPD: solicitação de exclusão de conta (direito de eliminação)
  | 'account_deletion_requested'

type EventPayload = Record<string, Json>

/**
 * Loga um evento a partir do client (browser).
 * - Lê user e org_id do profile via Supabase Auth atual.
 * - Fire-and-forget: erro é apenas logado no console, nunca propagado.
 */
export async function logEventClient(
  eventName: EventName,
  payload: EventPayload = {},
): Promise<void> {
  try {
    const supabase = createBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()
    if (!profile) return

    await supabase.from('events').insert({
      org_id: profile.org_id,
      user_id: user.id,
      event_name: eventName,
      payload,
    })
  } catch (err) {
    console.warn('[logEventClient] falhou:', eventName, err)
  }
}

/**
 * Loga um evento server-side dado um cliente Supabase já criado e
 * o user_id + org_id resolvidos no contexto da request.
 *
 * Usar em server actions e route handlers que já fizeram a verificação
 * de auth + profile. Não tenta resolver auth de novo por performance.
 */
export async function logEventServer(
  supabase: SupabaseClient<Database>,
  params: {
    userId: string
    orgId: string
    eventName: EventName
    payload?: EventPayload
  },
): Promise<void> {
  try {
    await supabase.from('events').insert({
      org_id: params.orgId,
      user_id: params.userId,
      event_name: params.eventName,
      payload: params.payload ?? {},
    })
  } catch (err) {
    console.warn('[logEventServer] falhou:', params.eventName, err)
  }
}
