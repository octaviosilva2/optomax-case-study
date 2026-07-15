// Jobs agendados (Vercel Cron) → GET /api/cron/[job]
//
// O Vercel Cron invoca a rota via GET e, quando a env CRON_SECRET está
// configurada, injeta automaticamente o header `Authorization: Bearer <CRON_SECRET>`.
// Validamos esse header (falha fechada → 401). Sem sessão: usa admin client
// (service_role). O middleware (proxy.ts) tem bypass para /api/cron/*.
//
// Jobs disponíveis:
//   - transicionar-trials → paywall Fase 2: orgs com trial vencido viram 'expired'.
//
// ⚠️ GATE DE ATIVAÇÃO (D1): o corte do paywall só roda quando PAYWALL_ENABLED==='true'.
// Sem a env (default), o job é NO-OP e apenas loga — deployar a rota NÃO corta
// ninguém. Ligar o corte na data combinada = setar PAYWALL_ENABLED=true na Vercel.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Confere o segredo do cron (header Authorization: Bearer <CRON_SECRET>).
// Sem env configurada → rejeita tudo (nunca rodar job sem segredo).
function cronAutorizado(req: Request): boolean {
  const esperado = process.env.CRON_SECRET
  if (!esperado) return false
  return req.headers.get('authorization') === `Bearer ${esperado}`
}

// ── Job: transicionar trials vencidos para 'expired' (paywall) ────────────────
// Elegíveis: plan_status='trialing' AND trial_ends_at < now() AND plan <> 'admin'.
// 'admin' (acesso ilimitado) nunca é cortado. Idempotente: rodar 2x não muda nada
// além do 1º corte (na 2ª passada não há mais 'trialing' vencido entre os já cortados).
async function transicionarTrials(): Promise<{ status: number; body: object }> {
  // Gate de ativação (D1). Enquanto desligado, NÃO toca em nenhuma org.
  if (process.env.PAYWALL_ENABLED !== 'true') {
    console.info('[cron transicionar-trials] paywall desativado (PAYWALL_ENABLED!=true) — no-op')
    return { status: 200, body: { ok: true, enabled: false, transitioned: 0 } }
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const { data, error } = await admin
    .from('organizations')
    .update({ plan_status: 'expired' })
    .eq('plan_status', 'trialing')
    .lt('trial_ends_at', nowIso)
    .neq('plan', 'admin')
    .select('id')

  if (error) {
    console.error('[cron transicionar-trials] erro no UPDATE:', error.message)
    return { status: 500, body: { ok: false, error: 'update_failed' } }
  }

  const transitioned = data?.length ?? 0
  console.info(`[cron transicionar-trials] orgs cortadas para expired: ${transitioned}`)
  return { status: 200, body: { ok: true, enabled: true, transitioned } }
}

const JOBS: Record<string, () => Promise<{ status: number; body: object }>> = {
  'transicionar-trials': transicionarTrials,
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ job: string }> },
) {
  if (!cronAutorizado(req)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { job } = await params
  const handler = JOBS[job]
  if (!handler) {
    return NextResponse.json({ ok: false, error: 'unknown_job' }, { status: 404 })
  }

  const { status, body } = await handler()
  return NextResponse.json(body, { status })
}
