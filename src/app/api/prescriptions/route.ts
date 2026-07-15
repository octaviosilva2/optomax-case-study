import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertActiveOrg } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  // Auth + profile + org ativa
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return new NextResponse(ctx.message, { status: ctx.status })

  // Buscar receitas da org atual
  const { data, error } = await supabase
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
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    // Defesa server-side: org com volume alto não derruba o cliente.
    // Limite folgado pra UI normal; quando bater, paginar.
    .limit(1000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
