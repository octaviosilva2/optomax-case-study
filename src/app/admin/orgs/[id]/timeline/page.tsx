// Tab "Timeline" — eventos da org em ordem reversa (events).
// Cada evento humanizado com ícone + label + payload formatado + tempo relativo.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { formatarDataRelativa, formatarDataHora } from '@/lib/utils/data'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

// Mapa event_name → ícone + label humanizada. Mantém a lista do banco-schema.md.
// Eventos não mapeados caem em fallback ('⚙️ Evento', com o event_name cru).
const EVENT_LABELS: Record<string, { icon: string; label: string }> = {
  user_first_login: { icon: '🚪', label: 'Primeiro login' },
  session_started: { icon: '🚪', label: 'Sessão iniciada' },
  session_ended: { icon: '🚪', label: 'Sessão encerrada' },
  patient_created: { icon: '👤', label: 'Paciente cadastrado' },
  appointment_created: { icon: '📅', label: 'Agendamento criado' },
  clinical_record_opened: { icon: '📋', label: 'Ficha aberta' },
  clinical_record_completed: { icon: '✅', label: 'Ficha finalizada' },
  grade_evolution_viewed: { icon: '📈', label: 'Evolução visualizada' },
  prescription_pdf_generated: { icon: '📄', label: 'PDF de receita gerado' },
  prescription_pdf_downloaded: { icon: '⬇️', label: 'PDF de receita baixado' },
  clinical_record_pdf_generated: { icon: '📄', label: 'PDF da ficha gerado' },
  clinical_record_pdf_downloaded: { icon: '⬇️', label: 'PDF da ficha baixado' },
  clinical_record_pdf_public_downloaded: { icon: '⬇️', label: 'PDF da ficha (link público) baixado' },
  account_deletion_requested: { icon: '🗑️', label: 'Exclusão solicitada' },
}

type EventoRow = {
  id: string
  event_name: string
  payload: unknown
  created_at: string
}

export default async function AdminOrgTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ offset?: string }>
}) {
  // Defesa em profundidade: a page lê dados via service_role (bypassa RLS),
  // então revalida o cookie admin aqui — não confia só no layout pai.
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const { id } = await params
  const { offset: offsetRaw } = await searchParams
  const offset = Math.max(0, Number.parseInt(offsetRaw ?? '0', 10) || 0)

  await logAdminAction('view_org_timeline', { targetOrgId: id, extra: { offset } })

  const supabase = createAdminClient()
  const { data: eventos, count } = await supabase
    .from('events')
    .select('id, event_name, payload, created_at', { count: 'exact' })
    .eq('org_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const total = count ?? 0
  const proximoOffset = offset + PAGE_SIZE
  const temMais = proximoOffset < total

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm font-medium">Nenhum evento registrado</p>
        <p className="text-xs text-muted-foreground mt-1">
          Esta org ainda nao gerou eventos comportamentais.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl tracking-tight">
          Timeline <span className="text-muted-foreground font-mono tabular-nums text-sm font-normal">({total})</span>
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums font-mono">
          {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {(eventos as EventoRow[] | null ?? []).map((e) => {
          const cfg = EVENT_LABELS[e.event_name] ?? {
            icon: '⚙️',
            label: e.event_name,
          }
          return (
            <div key={e.id} className="px-4 py-3 flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5 shrink-0" aria-hidden>
                {cfg.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <p className="text-sm font-medium text-foreground">
                    {cfg.label}
                    <span className="text-muted-foreground font-normal">{renderExtra(e.event_name, e.payload)}</span>
                  </p>
                  <time
                    className="text-xs text-muted-foreground tabular-nums font-mono shrink-0"
                    title={formatarDataHora(e.created_at)}
                  >
                    {formatarDataRelativa(e.created_at)}
                  </time>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-2 text-[13px]">
        {offset > 0 ? (
          <Link
            href={`/admin/orgs/${id}/timeline?offset=${Math.max(0, offset - PAGE_SIZE)}`}
            className="h-8 px-3 rounded-md border border-border bg-card hover:bg-muted"
          >
            ← Mais recentes
          </Link>
        ) : (
          <span />
        )}
        {temMais ? (
          <Link
            href={`/admin/orgs/${id}/timeline?offset=${proximoOffset}`}
            className="h-8 px-3 rounded-md border border-border bg-card hover:bg-muted"
          >
            Mais antigos →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  )
}

// Renderiza informação extra do payload em texto curto, quando faz sentido.
function renderExtra(eventName: string, payloadRaw: unknown): string {
  if (!payloadRaw || typeof payloadRaw !== 'object') return ''
  const payload = payloadRaw as Record<string, unknown>

  if (eventName === 'session_ended' && typeof payload.duration_seconds === 'number') {
    const segs = payload.duration_seconds
    if (segs < 60) return ` · ${segs}s`
    const mins = Math.floor(segs / 60)
    if (mins < 60) return ` · ${mins}min`
    const horas = Math.floor(mins / 60)
    return ` · ${horas}h ${mins % 60}min`
  }
  if (eventName === 'clinical_record_opened' && typeof payload.record_type === 'string') {
    return ` · ${payload.record_type}`
  }
  if (eventName === 'clinical_record_completed' && typeof payload.record_type === 'string') {
    return ` · ${payload.record_type}`
  }
  if (eventName === 'account_deletion_requested' && typeof payload.reason === 'string') {
    const r = payload.reason
    return r ? ` · "${r.length > 40 ? r.slice(0, 40) + '…' : r}"` : ''
  }
  return ''
}
