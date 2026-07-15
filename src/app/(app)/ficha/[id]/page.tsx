import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AtendimentoView } from './AtendimentoView'
import { logEventServer } from '@/lib/events'
import type { FichaClinica } from '@/types/clinical'
import { requireSession } from '@/lib/auth/session'

type Props = {
  params: Promise<{ id: string }>
}

export default async function AtendimentoPage({ params }: Props) {
  const { id } = await params
  const { user, profile } = await requireSession()
  const supabase = await createClient()

  // Camada 3: o record pertence a org do usuario.
  // F2-M01: inclui `patients.deleted_at` — ficha de paciente soft-deleted
  // nao deve ser acessivel nem internamente (LGPD §12.4 + comportamento
  // defensivo: paciente excluido nao tem motivo de ter ficha viva).
  // REFATORADO: busca duracao em vez de tipos_consulta (removido)
  const { data: record } = await supabase
    .from('clinical_records')
    .select(`
      id, org_id, patient_id, appointment_id, modelo, clinical_data,
      status, finalizado_em, editado, editado_em,
      patients ( id, nome, data_nascimento, cpf, sexo_biologico, whatsapp, deleted_at ),
      appointments ( id, data_hora, duracao, titulo )
    `)
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()

  if (!record) redirect('/agenda')

  // O Supabase tipa relações 1:1 como array — extrai o objeto único.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paciente = record.patients as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appt = record.appointments as any

  // F2-M01: redirect se o paciente foi soft-deleted. Mesmo destino que
  // o redirect existente quando o record não é encontrado, mantendo UX
  // consistente. Sem toast pra evitar mexer em mecanismo de flash messages.
  if (!paciente || paciente.deleted_at !== null) {
    redirect('/agenda')
  }

  // ID da prescrição associada (se já foi gerada via finalização).
  // Usado para mostrar botões de PDF na UI. Query separada para manter
  // o select acima legível e porque nem todo record tem prescription.
  const { data: prescricao } = await supabase
    .from('prescriptions')
    .select('id')
    .eq('clinical_record_id', record.id)
    .eq('org_id', profile.org_id)
    .eq('tipo', 'oculos')
    .maybeSingle()

  // Evento: ficha aberta (não-bloqueante — usado pelo painel /admin)
  await logEventServer(supabase, {
    userId: user.id,
    orgId: profile.org_id,
    eventName: 'clinical_record_opened',
    payload: {
      record_id: record.id,
      record_type: record.modelo,
    },
  })

  const fichaInicial = (record.clinical_data ?? {}) as FichaClinica

  // Monta o record inicial (snapshot SSR) que o hook usa como initialData
  const recordInicial = {
    id: record.id,
    org_id: record.org_id,
    patient_id: record.patient_id,
    appointment_id: record.appointment_id,
    modelo: record.modelo as 'resumido' | 'completo',
    clinical_data: fichaInicial,
    status: record.status as 'em_andamento' | 'finalizado',
    finalizado_em: record.finalizado_em,
    editado: !!record.editado,
    editado_em: record.editado_em,
  }

  return (
    <AtendimentoView
      recordId={record.id}
      recordInicial={recordInicial}
      paciente={{
        // patient_id vem do record (mesmo valor de patients.id). Sempre presente.
        id: record.patient_id,
        nome: paciente?.nome ?? '—',
        data_nascimento: paciente?.data_nascimento ?? null,
        cpf: paciente?.cpf ?? null,
        sexo_biologico: paciente?.sexo_biologico ?? null,
        whatsapp: paciente?.whatsapp ?? null,
      }}
      agendamento={
        appt
          ? {
              id: appt.id ?? null,
              data_hora: appt.data_hora ?? null,
              duracao: appt.duracao ?? null,
              titulo: appt.titulo ?? null,
            }
          : null
      }
      prescricaoId={prescricao?.id ?? null}
    />
  )
}
