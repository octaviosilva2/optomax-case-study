import { createClient } from '@/lib/supabase/server'
import ReceitasView from './ReceitasView'
import type { ReceitaListaItem } from './ReceitasView'
import { requireSession } from '@/lib/auth/session'

export const metadata = {
  title: 'Receitas | OptoMax',
  description: 'Hub central de todas as receitas geradas',
}

export default async function ReceitasPage() {
  const { profile } = await requireSession()
  const supabase = await createClient()

  // Fetch inicial das receitas recentes
  const { data: receitas } = await supabase
    .from('prescriptions')
    .select(`
      id,
      tipo,
      prescription_type,
      created_at,
      patient_id,
      dados_prescricao,
      clinical_record_id,
      status,
      patients ( id, nome, whatsapp )
    `)
    .eq('org_id', profile.org_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  // Cast: o typegen do Supabase trata `dados_prescricao` (jsonb) como Json
  // genérico e às vezes não consegue resolver a relação `patients` por FK
  // implícita. Em runtime o shape está correto — fazemos cast no boundary
  // server→client com tipo explícito definido no componente.
  return (
    <ReceitasView initialData={(receitas ?? []) as unknown as ReceitaListaItem[]} />
  )
}
