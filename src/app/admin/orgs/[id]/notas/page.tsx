// Tab "Notas" — notas internas do admin sobre a org. Imutáveis (sem edit/delete).
// Form no topo, lista cronológica reversa abaixo.

import { createAdminClient } from '@/lib/supabase/admin'
import { logAdminAction } from '@/lib/admin-audit'
import { formatarDataHora } from '@/lib/utils/data'
import { StickyNote } from 'lucide-react'
import { NotaForm } from './NotaForm'

export const dynamic = 'force-dynamic'

export default async function AdminOrgNotasPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  await logAdminAction('view_org_notes', { targetOrgId: id })

  const supabase = createAdminClient()
  const { data: notas } = await supabase
    .from('organization_notes')
    .select('id, author_admin, content, created_at')
    .eq('org_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-xl tracking-tight mb-3">Nova nota</h2>
        <NotaForm orgId={id} />
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl tracking-tight">
          Historico <span className="text-muted-foreground font-mono tabular-nums text-sm font-normal">({notas?.length ?? 0})</span>
        </h2>

        {(!notas || notas.length === 0) ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm font-medium">Nenhuma nota ainda</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use o formulario acima para registrar observacoes sobre esta org.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notas.map((n) => (
              <article
                key={n.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <header className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-7 w-7 rounded-full bg-status-warning-bg text-status-warning flex items-center justify-center shrink-0">
                      <StickyNote className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-medium">{n.author_admin}</span>
                  </div>
                  <time className="text-xs text-muted-foreground tabular-nums font-mono">
                    {formatarDataHora(n.created_at)}
                  </time>
                </header>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {n.content}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
