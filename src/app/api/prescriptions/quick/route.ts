import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { receitaRapidaSchema } from '@/lib/validations/receitas'
import { assertActiveOrg } from '@/lib/auth-guards'
import type { Json } from '@/types/database'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // Auth + profile + org ativa em 1 chamada
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return new NextResponse(ctx.message, { status: ctx.status })

  // 3. Validação do Body
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = receitaRapidaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Erro de validação', details: parsed.error.format() }, { status: 400 })
  }

  const data = parsed.data

  // Defesa em profundidade: confirma que o paciente pertence à org antes do INSERT.
  // RLS bloqueia leitura cross-tenant, mas sem essa checagem o INSERT falharia
  // com erro genérico 500 ao invés de 400. Mensagem amigável e auditável.
  const { data: pacienteOk } = await supabase
    .from('patients')
    .select('id')
    .eq('id', data.patient_id)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!pacienteOk) {
    return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
  }

  // Reorganização "Novo Atendimento" (§3.3): quando a receita nasce de um
  // agendamento, valida o vínculo e reaproveita a receita ativa existente
  // daquele appointment_id em vez de duplicar (idempotência por Q2 — sem
  // constraint unique nova, decisão anti-over-engineering da spec).
  if (data.appointmentId) {
    const { data: appointmentOk } = await supabase
      .from('appointments')
      .select('id')
      .eq('id', data.appointmentId)
      .eq('org_id', ctx.orgId)
      .maybeSingle()
    if (!appointmentOk) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    }

    const { data: existente } = await supabase
      .from('prescriptions')
      .select('id')
      .eq('appointment_id', data.appointmentId)
      .eq('org_id', ctx.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (existente) {
      // Reaproveita a receita já emitida para este agendamento: atualiza os
      // dados, mas NÃO mexe no status do agendamento (só a 1ª emissão flipa).
      const { data: atualizada, error: errUpd } = await supabase
        .from('prescriptions')
        .update({
          tipo: data.tipo,
          dados_prescricao: data.dados_prescricao as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existente.id)
        .eq('org_id', ctx.orgId)
        .select()
        .single()

      if (errUpd) {
        console.error('[POST /api/prescriptions/quick] update (reaproveitamento) falhou:', errUpd.code, errUpd.message)
        return NextResponse.json({ error: 'Falha ao salvar receita' }, { status: 500 })
      }
      return NextResponse.json(atualizada, { status: 200 })
    }
  }

  // 4. Inserir no banco (1ª emissão desta receita)
  const { data: prescriptionRow, error } = await supabase
    .from('prescriptions')
    .insert({
      org_id: ctx.orgId,
      patient_id: data.patient_id,
      tipo: data.tipo,
      prescription_type: 'quick',
      dados_prescricao: data.dados_prescricao as Json,
      appointment_id: data.appointmentId ?? null,
    })
    .select()
    .single()

  if (error) {
    // Loga apenas código/mensagem — sem o objeto completo, evita PII residual.
    console.error('[POST /api/prescriptions/quick] insert falhou:', error.code, error.message)
    return NextResponse.json({ error: 'Falha ao salvar receita' }, { status: 500 })
  }

  // Flip de status SÓ na 1ª emissão (espelha finalizarAtendimento): agendamento
  // vai a concluído sem criar ficha. `.in(...)` protege terminais (cancelado/faltou).
  if (data.appointmentId) {
    await supabase
      .from('appointments')
      .update({ status: 'concluido', updated_at: new Date().toISOString() })
      .eq('id', data.appointmentId)
      .eq('org_id', ctx.orgId)
      .in('status', ['agendado', 'confirmado', 'em_andamento'])
    revalidatePath('/agenda')
    revalidatePath('/ficha')
  }

  return NextResponse.json(prescriptionRow, { status: 201 })
}
