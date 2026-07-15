// Tab "Receitas" — lista de prescriptions da org com paciente vinculado.
// Inclui receitas vindas de ficha (from_record) e receitas rápidas (quick).

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { formatarDataHora } from '@/lib/utils/data'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function AdminOrgReceitasPage({
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

  await logAdminAction('view_org_prescriptions', { targetOrgId: id, extra: { page } })

  const supabase = createAdminClient()
  const { data: receitas, count } = await supabase
    .from('prescriptions')
    .select(
      'id, tipo, prescription_type, created_at, patients(nome)',
      { count: 'exact' },
    )
    .eq('org_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm font-medium">Nenhuma receita emitida</p>
        <p className="text-xs text-muted-foreground mt-1">
          Esta org ainda nao emitiu nenhuma prescricao.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl tracking-tight">
          {total} {total === 1 ? 'receita' : 'receitas'}
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
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 font-medium text-center">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {(receitas ?? []).map((p) => {
              const patRaw = p.patients as { nome: string } | { nome: string }[] | null
              const pacienteNome = Array.isArray(patRaw)
                ? patRaw[0]?.nome
                : patRaw?.nome
              const origemLabel =
                p.prescription_type === 'quick' ? 'Receita rápida' : 'Da ficha'
              return (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">{formatarDataHora(p.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{pacienteNome ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{origemLabel}</td>
                  <td className="px-4 py-3 text-center">
                    <a
                      href={`/api/prescricao/${p.id}?download=0`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-[12px] font-medium"
                    >
                      Ver PDF
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        baseHref={`/admin/orgs/${id}/receitas`}
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
