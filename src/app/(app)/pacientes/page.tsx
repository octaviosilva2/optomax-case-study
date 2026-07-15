import { createClient } from '@/lib/supabase/server'
import PacientesView from './PacientesView'
import type { PacienteSimples } from '@/hooks/usePacientes'
import { ultimaConsultaDe } from '@/lib/utils/data'
import { requireSession } from '@/lib/auth/session'

export const metadata = {
  title: 'Pacientes | OptoMax',
  description: 'Lista de pacientes cadastrados na clínica',
}

export default async function PacientesPage() {
  const { profile } = await requireSession()
  const supabase = await createClient()

  // Fetch inicial: primeira página (50) ordenada por nome.
  // Embedded clinical_records p/ derivar a última consulta (mesma forma do hook).
  const { data: pacientes } = await supabase
    .from('patients')
    .select('id, nome, cpf, whatsapp, data_nascimento, created_at, clinical_records(finalizado_em)')
    .eq('org_id', profile.org_id)
    .is('deleted_at', null)
    .order('nome', { ascending: true })
    .limit(50)

  const initialData: PacienteSimples[] = (pacientes ?? []).map((p) => {
    const { clinical_records, ...rest } = p as typeof p & {
      clinical_records: { finalizado_em: string | null }[] | null
    }
    return { ...rest, ultima_consulta: ultimaConsultaDe(clinical_records) }
  })

  return (
    <PacientesView initialData={initialData} orgId={profile.org_id} />
  )
}
