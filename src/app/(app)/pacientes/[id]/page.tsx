import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PacienteProfile from './PacienteProfile'
import type { PacienteDetalhe } from '@/hooks/usePacientes'
import { requireSession } from '@/lib/auth/session'
import { montarResumoClinicio } from '@/lib/utils/resumo-clinico'

// Normaliza o esférico vindo do JSONB (texto livre: "-2.50", "PL", "neutro") para
// string exibível ou null. Mantém valores clínicos não-numéricos ("PL", "neutro").
function normalizarEsf(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

export const metadata = {
  title: 'Perfil do Paciente | OptoMax',
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function PacienteProfilePage({ params }: Props) {
  const { id } = await params
  const { profile } = await requireSession()
  const supabase = await createClient()

  // Busca paciente — verifica que pertence à org e não está deletado
  const { data: paciente } = await supabase
    .from('patients')
    .select('id, org_id, nome, cpf, whatsapp, data_nascimento, email, endereco, sexo_biologico, responsavel_legal, observacoes, origem_id, created_at, updated_at')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  // Paciente não encontrado ou não pertence à org → redireciona
  if (!paciente) redirect('/pacientes')

  // Busca nome da origem (se houver)
  let nomeOrigem: string | null = null
  if (paciente.origem_id) {
    const { data: origem } = await supabase
      .from('origens_paciente')
      .select('nome')
      .eq('id', paciente.origem_id)
      .maybeSingle()
    nomeOrigem = origem?.nome ?? null
  }

  // Último atendimento finalizado — fonte do grau atual + "última consulta"
  const { data: ultimoRecord } = await supabase
    .from('clinical_records')
    .select('finalizado_em, clinical_data')
    .eq('patient_id', id)
    .eq('org_id', profile.org_id)
    .eq('status', 'finalizado')
    .order('finalizado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Última prescrição — enriquece o resumo clínico e serve de fonte do grau
  // quando não houve atendimento finalizado (ex.: receita rápida não cria record).
  const { data: ultimaPrescricao } = await supabase
    .from('prescriptions')
    .select('dados_prescricao, created_at')
    .eq('patient_id', id)
    .eq('org_id', profile.org_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // "Última consulta" = data da última RECEITA gerada (não do atendimento) —
  // a consulta efetiva é marcada pela emissão da receita.
  const ultimaConsultaEm = ultimaPrescricao?.created_at ?? null

  const resumoClinico = montarResumoClinicio({
    ultimaConsultaEm,
    clinicalData: ultimoRecord?.clinical_data ?? null,
    dadosPrescricao: ultimaPrescricao?.dados_prescricao ?? null,
  })

  // Grau atual = esférico (OD/OE) da fonte mais recente entre o último atendimento
  // finalizado (clinical_data.nova_prescricao) e a última prescrição emitida
  // (dados_prescricao). Cobre o caso da receita rápida, que não gera clinical_record.
  const grauDe = (dados: { od?: { esf?: unknown }; oe?: { esf?: unknown } } | null | undefined) => ({
    od: normalizarEsf(dados?.od?.esf),
    oe: normalizarEsf(dados?.oe?.esf),
  })
  const candidatosGrau = [
    ultimoRecord?.finalizado_em
      ? {
          em: ultimoRecord.finalizado_em,
          grau: grauDe(
            (ultimoRecord.clinical_data as { nova_prescricao?: { od?: { esf?: unknown }; oe?: { esf?: unknown } } } | null)
              ?.nova_prescricao,
          ),
        }
      : null,
    ultimaPrescricao?.created_at
      ? {
          em: ultimaPrescricao.created_at,
          grau: grauDe(ultimaPrescricao.dados_prescricao as { od?: { esf?: unknown }; oe?: { esf?: unknown } } | null),
        }
      : null,
  ]
    .filter((c): c is { em: string; grau: { od: string | null; oe: string | null } } => c !== null)
    .sort((a, b) => b.em.localeCompare(a.em))
  const grauAtual = candidatosGrau.find((c) => c.grau.od || c.grau.oe)?.grau ?? { od: null, oe: null }

  return (
    <PacienteProfile
      paciente={paciente as PacienteDetalhe}
      nomeOrigem={nomeOrigem}
      resumoClinico={resumoClinico}
      grauAtual={grauAtual}
      ultimaConsultaEm={ultimaConsultaEm}
    />
  )
}
