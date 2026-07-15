// Tab "Pacientes" — lista paginada SSR dos pacientes ativos da org.
// Soft-deleted (deleted_at IS NOT NULL) é ocultado.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { formatarDataCurta } from '@/lib/utils/data'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function AdminOrgPacientesPage({
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

  await logAdminAction('view_org_patients', { targetOrgId: id, extra: { page } })

  const supabase = createAdminClient()
  const { data: pacientes, count } = await supabase
    .from('patients')
    .select(
      'id, nome, cpf, whatsapp, data_nascimento, created_at, origens_paciente(nome)',
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
      <EmptyState titulo="Nenhum paciente cadastrado" />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl tracking-tight">
          {total} {total === 1 ? 'paciente' : 'pacientes'}
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
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">CPF</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Nascimento</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 font-medium">Cadastrado em</th>
            </tr>
          </thead>
          <tbody>
            {(pacientes ?? []).map((p) => {
              const inicial = (p.nome ?? '?').trim().charAt(0).toUpperCase()
              // origens_paciente vem como objeto OU array dependendo da relação; tratamos defensivamente
              const origemRaw = p.origens_paciente as
                | { nome: string }
                | { nome: string }[]
                | null
              const origemNome = Array.isArray(origemRaw)
                ? origemRaw[0]?.nome
                : origemRaw?.nome
              return (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-full bg-primary/10 text-primary text-[12px] font-semibold flex items-center justify-center shrink-0">
                        {inicial}
                      </span>
                      <span className="font-medium">{p.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono tabular-nums">{p.cpf ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono tabular-nums">{p.whatsapp ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.data_nascimento
                      ? new Date(p.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{origemNome ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatarDataCurta(p.created_at)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        baseHref={`/admin/orgs/${id}/pacientes`}
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

function EmptyState({ titulo }: { titulo: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      <p className="text-xs text-muted-foreground mt-1">
        Esta org ainda nao cadastrou nada nesta secao.
      </p>
    </div>
  )
}

