// Tab "Atendimentos" — lista de clinical_records da org com paciente vinculado.
// Link "Ver PDF" só aparece em fichas finalizadas (status = 'finalizado').

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { formatarDataHora } from '@/lib/utils/data'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function AdminOrgAtendimentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  // Defesa em profundidade: a page lê dados via service_role (bypassa RLS),
  // então revalida o cookie admin aqui — não confia só no layout pai.
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const { id } = await params
  const { page: pageRaw } = await searchParams
  const page = Math.max(1, Number.parseInt(pageRaw ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  await logAdminAction('view_org_records', { targetOrgId: id, extra: { page } })

  const supabase = createAdminClient()
  const { data: registros, count } = await supabase
    .from('clinical_records')
    .select(
      'id, status, modelo, created_at, finalizado_em, patients(nome)',
      { count: 'exact' },
    )
    .eq('org_id', id)
    // Não lista fichas arquivadas (soft-delete) — coerência com o resto da UI.
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm font-medium">Nenhum atendimento cadastrado</p>
        <p className="text-xs text-muted-foreground mt-1">
          Esta org ainda nao abriu nenhuma ficha clinica.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl tracking-tight">
          {total} {total === 1 ? 'atendimento' : 'atendimentos'}
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums font-mono">
          Pagina {page} de {totalPages}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            {/* Cabecalho editorial: uppercase tracking-wide xs */}
            <tr className="text-left text-eyebrow">
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Modelo</th>
              <th className="px-4 py-3 font-medium">Finalizado em</th>
              <th className="px-4 py-3 font-medium text-center">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {(registros ?? []).map((r) => {
              // patients vem como objeto OU array dependendo da relação
              const patRaw = r.patients as { nome: string } | { nome: string }[] | null
              const pacienteNome = Array.isArray(patRaw)
                ? patRaw[0]?.nome
                : patRaw?.nome
              const finalizado = r.status === 'finalizado'
              return (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">{formatarDataHora(r.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{pacienteNome ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                        finalizado
                          ? 'bg-status-ok-bg text-status-ok border-status-ok/30'
                          : 'bg-status-warning-bg text-status-warning border-status-warning/30'
                      }`}
                    >
                      {finalizado ? 'Finalizado' : 'Em andamento'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.modelo}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.finalizado_em ? formatarDataHora(r.finalizado_em) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {finalizado ? (
                      <a
                        href={`/api/ficha/${r.id}?download=0`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-[12px] font-medium"
                      >
                        Ver PDF
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-[12px]">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        baseHref={`/admin/orgs/${id}/atendimentos`}
        page={page}
        totalPages={totalPages}
      />
    </div>
  )
}

function Pagination({
  baseHref,
  page,
  totalPages,
}: {
  baseHref: string
  page: number
  totalPages: number
}) {
  if (totalPages <= 1) return null
  const anterior = page > 1 ? page - 1 : null
  const proxima = page < totalPages ? page + 1 : null
  return (
    <div className="flex items-center justify-end gap-2 text-[13px]">
      {anterior ? (
        <Link
          href={`${baseHref}?page=${anterior}`}
          className="h-8 px-3 rounded-md border border-border bg-card hover:bg-muted"
        >
          ← Anterior
        </Link>
      ) : (
        <span className="h-8 px-3 rounded-md border border-border bg-muted/30 text-muted-foreground opacity-50">
          ← Anterior
        </span>
      )}
      {proxima ? (
        <Link
          href={`${baseHref}?page=${proxima}`}
          className="h-8 px-3 rounded-md border border-border bg-card hover:bg-muted"
        >
          Próxima →
        </Link>
      ) : (
        <span className="h-8 px-3 rounded-md border border-border bg-muted/30 text-muted-foreground opacity-50">
          Próxima →
        </span>
      )}
    </div>
  )
}
