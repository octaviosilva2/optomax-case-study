import { createClient } from '@/lib/supabase/server'
import { ConfiguracoesTabs } from './ConfiguracoesTabs'
import { requireSession } from '@/lib/auth/session'
import { PageHeader } from '@/components/layout/PageHeader'

// REFATORADO: nao carrega mais tipos_consulta (removido do produto)
export default async function ConfiguracoesPage() {
  const { profile, org } = await requireSession()
  const supabase = await createClient()

  // Origens de paciente + signed URL da assinatura em paralelo (eram sequenciais
  // — sem dependência entre si, então roda junto pra cortar o waterfall).
  const [{ data: origens }, signed] = await Promise.all([
    supabase
      .from('origens_paciente')
      .select('id, nome, ativo')
      .eq('org_id', profile.org_id)
      .order('nome'),
    // Signed URL temporaria pra preview da assinatura (RLS ja garante que so
    // o dono le). 1h e confortavel e curto o suficiente caso vaze.
    profile.signature_url
      ? supabase.storage.from('signatures').createSignedUrl(profile.signature_url, 3600)
      : Promise.resolve(null),
  ])

  const signaturePreviewUrl = signed?.data?.signedUrl ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie os dados da sua clínica"
        className="mb-6"
      />
      <ConfiguracoesTabs
        org={{
          nome_clinica: org?.nome_clinica ?? '',
          endereco: org?.endereco ?? null,
          telefone: org?.telefone ?? null,
        }}
        profile={{
          nome_completo: profile.nome_completo ?? '',
          cro_cboo: profile.cro_cboo ?? null,
          formacoes: profile.formacoes ?? [],
          hasSignature: !!profile.signature_url,
          signaturePreviewUrl,
        }}
        origens={(origens ?? []).map(o => ({ ...o, ativo: o.ativo ?? true }))}
      />
    </div>
  )
}
