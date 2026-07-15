// Tab "Profile" — dados da clínica + profissional(is) + status legal.
// Lê tudo via SERVICE_ROLE (createAdminClient) — admin não precisa de sessão do tester.

import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { formatarDataHora, formatarDataCurta } from '@/lib/utils/data'

export const dynamic = 'force-dynamic'

export default async function AdminOrgProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Defesa em profundidade: a page lê dados via service_role (bypassa RLS),
  // então revalida o cookie admin aqui — não confia só no layout pai.
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const { id } = await params
  const supabase = createAdminClient()

  // Org completa
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select(
      'id, nome_clinica, slug, telefone, endereco, plan, plan_status, trial_ends_at, accepted_terms_at, accepted_terms_version, accepted_terms_ip, deletion_requested_at, deletion_scheduled_for, deletion_reason, created_at',
    )
    .eq('id', id)
    .maybeSingle()

  if (orgErr || !org) {
    notFound()
  }

  // Profiles da org — geralmente 1 user só, mas suporta múltiplos
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nome_completo, cro_cboo, formacoes, signature_url, onboarded, last_seen_at, created_at')
    .eq('org_id', id)
    .order('created_at', { ascending: true })

  // Email de cada profile vem do auth.users (service role obrigatório).
  // listUsers é paginado — perPage 200 cobre 10 testers tranquilamente.
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 200 })
  const emailById = new Map<string, string>()
  for (const u of authData?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email)
  }

  return (
    <div className="space-y-6">
      {/* Aviso vermelho se org tem pedido de exclusao pendente */}
      {org.deletion_requested_at && (
        <div className="rounded-xl border border-destructive/40 bg-destructive-bg p-5">
          <h2 className="font-semibold text-sm text-destructive mb-1">
            Pedido de exclusao pendente
          </h2>
          <p className="text-sm text-destructive">
            Solicitado em {formatarDataHora(org.deletion_requested_at)} ·
            Exclusao programada para {formatarDataCurta(org.deletion_scheduled_for)}
          </p>
          {org.deletion_reason && (
            <p className="text-sm text-destructive mt-2">
              <span className="font-medium">Motivo:</span> {org.deletion_reason}
            </p>
          )}
        </div>
      )}

      {/* Dados da clinica */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-xl tracking-tight mb-4">Dados da clinica</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
          <Campo label="Nome" valor={org.nome_clinica} />
          <Campo label="Slug" valor={org.slug ?? '—'} />
          <Campo label="Telefone" valor={org.telefone ?? '—'} />
          <Campo label="Endereço" valor={org.endereco ?? '—'} />
          <Campo label="Plano" valor={org.plan} />
          <Campo label="Status" valor={org.plan_status} />
          <Campo
            label="Trial termina em"
            valor={org.trial_ends_at ? formatarDataCurta(org.trial_ends_at) : '—'}
          />
          <Campo label="Criada em" valor={formatarDataHora(org.created_at)} />
        </dl>
      </section>

      {/* Profissionais */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-xl tracking-tight mb-4">
          {profiles && profiles.length > 1 ? 'Profissionais' : 'Profissional'}
        </h2>
        {(!profiles || profiles.length === 0) ? (
          <p className="text-[13px] text-muted-foreground">Sem profissionais cadastrados.</p>
        ) : (
          <div className="space-y-4">
            {profiles.map((p, idx) => (
              <div
                key={p.id}
                className={idx > 0 ? 'pt-4 border-t border-border' : ''}
              >
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                  <Campo label="Nome completo" valor={p.nome_completo ?? '—'} />
                  <Campo label="Email" valor={emailById.get(p.id) ?? '—'} />
                  <Campo label="CRO/CBOO" valor={p.cro_cboo ?? '—'} />
                  <Campo
                    label="Onboarding"
                    valor={p.onboarded ? 'Concluído' : 'Pendente'}
                  />
                  <Campo
                    label="Formações"
                    valor={
                      p.formacoes && p.formacoes.length > 0
                        ? p.formacoes.join(', ')
                        : '—'
                    }
                  />
                  <Campo
                    label="Assinatura digital"
                    valor={p.signature_url ? 'Cadastrada' : '—'}
                  />
                  <Campo
                    label="Última atividade"
                    valor={p.last_seen_at ? formatarDataHora(p.last_seen_at) : '—'}
                  />
                  <Campo label="Criado em" valor={formatarDataHora(p.created_at)} />
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Status legal: aceite de termos */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-xl tracking-tight mb-4">Status legal</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
          <Campo
            label="Aceitou termos"
            valor={
              org.accepted_terms_at
                ? `${org.accepted_terms_version ?? 'sem versão'} em ${formatarDataHora(org.accepted_terms_at)}`
                : 'Não consta'
            }
          />
          <Campo
            label="IP no aceite"
            valor={org.accepted_terms_ip ?? '—'}
          />
        </dl>
      </section>
    </div>
  )
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </dt>
      <dd className="text-foreground break-words">{valor}</dd>
    </div>
  )
}
