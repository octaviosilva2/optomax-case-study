import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth/session'
import { ReceitaEditorView } from './ReceitaEditorView'
import type { NovaPrescricao } from '@/types/clinical'

export const metadata = {
  title: 'Editar receita | OptoMax',
}

type Props = {
  params: Promise<{ id: string }>
}

/**
 * Página de preenchimento do rascunho de receita avulsa (CA20, CA23). Só
 * atende rascunho AVULSO: vinculada a ficha nasce finalizada (CA24) e nunca
 * passa por aqui — se o dado não bater com isso, é 404/redirect, não um
 * estado de UI a tratar.
 */
export default async function ReceitaEditarPage({ params }: Props) {
  const { id } = await params
  const { profile } = await requireSession()
  const supabase = await createClient()

  const { data: prescricao } = await supabase
    .from('prescriptions')
    .select(`
      id, patient_id, clinical_record_id, dados_prescricao, status,
      patients ( id, nome, whatsapp )
    `)
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!prescricao) notFound()
  // Vinculada a ficha nunca tem rascunho próprio (CA24) — estado anômalo.
  if (prescricao.clinical_record_id) notFound()
  // Já finalizada: "editar" o grau emitido é o fluxo do B2 (CardReceita/
  // ReceitaView), não esta página de rascunho.
  if (prescricao.status !== 'rascunho') redirect(`/receitas/${id}`)

  const paciente = Array.isArray(prescricao.patients)
    ? prescricao.patients[0]
    : prescricao.patients

  return (
    <ReceitaEditorView
      prescricaoId={prescricao.id}
      paciente={{
        id: prescricao.patient_id,
        nome: paciente?.nome ?? '—',
      }}
      dadosPrescricao={prescricao.dados_prescricao as unknown as Partial<NovaPrescricao>}
    />
  )
}
