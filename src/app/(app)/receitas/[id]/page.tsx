import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth/session'
import { ReceitaView } from './ReceitaView'
import type { ReceitaRapidaInput } from '@/lib/validations/receitas'

export const metadata = {
  title: 'Receita | OptoMax',
}

type Props = {
  params: Promise<{ id: string }>
}

/**
 * Tela de Receita dedicada (CA8–CA10). Mostra só o card da receita — diferente
 * de /ficha/[id], que mostra os 2 cards (ficha + receita). O org_id vem sempre
 * da sessão autenticada; a RLS de `prescriptions` garante o isolamento.
 */
export default async function ReceitaPage({ params }: Props) {
  const { id } = await params
  const { profile } = await requireSession()
  const supabase = await createClient()

  const { data: prescricao } = await supabase
    .from('prescriptions')
    .select(`
      id, patient_id, clinical_record_id, dados_prescricao, tipo, prescription_type, created_at, status,
      patients ( id, nome, whatsapp )
    `)
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  // 404 explícito (SPEC §B1.3): receita inexistente/arquivada/de outra org não
  // vira redirect — é um not-found real.
  if (!prescricao) notFound()

  // Guard de rascunho (B3, SPEC §B1.3): esta tela é a de RESULTADO (PDF/
  // WhatsApp/ótica) — rascunho ainda não tem nada disso. Redireciona pra
  // página de preenchimento em vez de mostrar a tela de resultado quebrada.
  if (prescricao.status === 'rascunho') redirect(`/receitas/${id}/editar`)

  // O Supabase tipa relações 1:1 como array — extrai o objeto único.
  const paciente = Array.isArray(prescricao.patients)
    ? prescricao.patients[0]
    : prescricao.patients

  return (
    <ReceitaView
      prescricaoId={prescricao.id}
      paciente={{
        // patient_id vem da própria prescription (sempre presente).
        id: prescricao.patient_id,
        nome: paciente?.nome ?? '—',
        whatsapp: paciente?.whatsapp ?? null,
      }}
      clinicalRecordId={prescricao.clinical_record_id}
      // Cast no boundary server→client: o typegen trata `dados_prescricao`
      // (jsonb) como Json genérico; em runtime o shape casa com o schema.
      dadosPrescricao={
        prescricao.dados_prescricao as unknown as ReceitaRapidaInput['dados_prescricao']
      }
    />
  )
}
