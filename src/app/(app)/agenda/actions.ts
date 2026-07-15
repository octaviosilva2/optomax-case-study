'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { agendamentoSchema, type AgendamentoFormData } from '@/lib/validations/agendamento'
import { APPOINTMENT_STATUSES, podeTransicionarAppointment, type StatusAgendamento } from '@/lib/utils/status'
import { assertActiveOrg } from '@/lib/auth-guards'
import { ZodError, z } from 'zod'
import { pacienteSchema } from '@/lib/validations/paciente'
import { mensagemErroAmigavel } from '@/lib/utils/erro'

// Whitelist de status aceitos pela action (Fase 11.2).
// Source of truth: APPOINTMENT_STATUSES em lib/utils/status.ts, alinhada com
// o CHECK constraint `appointments_status_check`. 'atendido' foi removido
// (legacy normalizado para 'concluido' pela migration 5.10).
const STATUS_VALIDOS: readonly StatusAgendamento[] = APPOINTMENT_STATUSES

// Schema do walk-in SEM tipo de consulta (removido na refatoracao).
// Duracao agora e obrigatoria no lugar de tipoConsultaId.
const walkinSchema = z.object({
  patientId: z.string().uuid(),
  duracao: z.number().int().min(5).max(480),
  observacao: z.string().trim().max(500).nullable().optional(),
  // Nome/rótulo opcional do atendimento (ex.: "Consulta de rotina").
  titulo: z.string().trim().max(120).nullable().optional(),
})

/**
 * Cria um novo agendamento SEM tipo de consulta (removido na refatoracao).
 * - Valida input com Zod (sanitiza tipos e rejeita campos desconhecidos).
 * - org_id sempre lido do profile autenticado, NUNCA do client.
 * - Valida que o paciente pertence a org.
 * - Duracao vem diretamente do input (informada pelo usuario).
 */
export async function criarAgendamento(
  input: AgendamentoFormData & { walkin?: boolean },
): Promise<{ error: string | null; agendamentoId: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message, agendamentoId: null }

  // Validacao Zod
  let parsed: AgendamentoFormData
  try {
    parsed = agendamentoSchema.parse(input)
  } catch (err) {
    if (err instanceof ZodError) return { error: 'VALIDACAO_FALHOU', agendamentoId: null }
    return { error: 'VALIDACAO_FALHOU', agendamentoId: null }
  }

  // Paciente precisa pertencer a org (defesa cross-tenant)
  const { data: paciente } = await supabase
    .from('patients')
    .select('id')
    .eq('id', parsed.patient_id)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!paciente) return { error: 'Paciente não encontrado', agendamentoId: null }

  // INSERT sem tipo_consulta_id (coluna agora e nullable)
  const { data: novo, error } = await supabase
    .from('appointments')
    .insert({
      org_id: ctx.orgId,
      patient_id: parsed.patient_id,
      // tipo_consulta_id: null — nao enviamos mais
      data_hora: parsed.data_hora,
      duracao: parsed.duracao,
      observacao: parsed.observacao ?? null,
      walkin: input.walkin ?? false,
      status: 'agendado',
    })
    .select('id')
    .single()

  if (error) return { error: mensagemErroAmigavel(error), agendamentoId: null }

  revalidatePath('/agenda')
  revalidatePath('/ficha')
  return { error: null, agendamentoId: novo.id }
}

/**
 * Edita um agendamento existente (data/hora, duração, observação).
 * - Não altera o paciente (trocar paciente = cancelar/reagendar).
 * - Bloqueia edição de agendamentos terminais (concluído/cancelado).
 * - org_id sempre do contexto autenticado (defesa cross-tenant).
 */
export async function atualizarAgendamento(
  appointmentId: string,
  input: { data_hora: string; duracao: number; observacao?: string | null },
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  const parsed = z
    .object({
      data_hora: z.string().min(1),
      duracao: z.number().int().min(5).max(480),
      observacao: z.string().trim().max(500).nullable().optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { error: 'VALIDACAO_FALHOU' }

  // Não edita o horário de um agendamento já encerrado.
  const { data: current } = await supabase
    .from('appointments')
    .select('status')
    .eq('id', appointmentId)
    .eq('org_id', ctx.orgId)
    .single()
  if (!current) return { error: 'Agendamento não encontrado' }
  if (['concluido', 'cancelado'].includes(current.status)) {
    return { error: 'Agendamento encerrado não pode ser editado.' }
  }

  const { error } = await supabase
    .from('appointments')
    .update({
      data_hora: parsed.data.data_hora,
      duracao: parsed.data.duracao,
      observacao: parsed.data.observacao ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .eq('org_id', ctx.orgId)

  if (error) return { error: mensagemErroAmigavel(error) }
  revalidatePath('/agenda')
  return { error: null }
}

/**
 * Atualiza o status de um agendamento (validado server-side).
 * - Valida que o status está na whitelist canônica (APPOINTMENT_STATUSES).
 * - F5-A01: valida a TRANSIÇÃO (não apenas o destino). Bloqueia
 *   cancelado→agendado, concluido→cancelado, faltou→concluido etc.
 * - Valida que o agendamento pertence à org do usuário.
 */
export async function atualizarStatusAgendamento(
  appointmentId: string,
  novoStatus: StatusAgendamento,
): Promise<{ error: string | null }> {
  if (!STATUS_VALIDOS.includes(novoStatus)) {
    return { error: 'Status inválido' }
  }

  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // F5-A01: lê o status atual para validar transição
  const { data: current } = await supabase
    .from('appointments')
    .select('status')
    .eq('id', appointmentId)
    .eq('org_id', ctx.orgId)
    .single()

  if (!current) return { error: 'Agendamento não encontrado' }

  const statusAtual = current.status as StatusAgendamento
  if (!podeTransicionarAppointment(statusAtual, novoStatus)) {
    return { error: `Transição inválida: ${statusAtual} → ${novoStatus}` }
  }

  const { error } = await supabase
    .from('appointments')
    .update({ status: novoStatus, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('org_id', ctx.orgId)

  if (error) return { error: mensagemErroAmigavel(error) }

  revalidatePath('/agenda')
  revalidatePath('/ficha')
  return { error: null }
}

/**
 * Reorganização "Novo Atendimento" (CA5): verifica se já existe uma ficha
 * `em_andamento` a retomar, para o modal "Escolha como continuar" pular
 * direto pra ela em vez de perguntar Ficha × Receita de novo.
 *
 * Escopo Q1 (decidido pelo Octavio, 2026-07-09): só considera "em andamento"
 * a ficha atrelada AO MESMO agendamento — walk-in/perfil (sem appointmentId)
 * sempre começam algo novo, mesmo que o paciente tenha outra ficha aberta.
 */
export async function verificarFichaEmAndamento(
  args: { appointmentId?: string; patientId?: string },
): Promise<{ recordId: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { recordId: null }

  if (!args.appointmentId) return { recordId: null }

  const { data } = await supabase
    .from('clinical_records')
    .select('id')
    .eq('appointment_id', args.appointmentId)
    .eq('org_id', ctx.orgId)
    .eq('status', 'em_andamento')
    .is('deleted_at', null)
    .maybeSingle()

  return { recordId: data?.id ?? null }
}

/**
 * Reorganização "Novo Atendimento" (ramificação Receita a partir de um
 * agendamento — Adiantar/Hero/Agenda de hoje/grade): marca o agendamento
 * como `em_andamento` (mesmo padrão de `iniciarAtendimento`, não mexe em
 * terminais) e devolve o paciente para abrir o formulário de receita.
 * NÃO cria clinical_record — a ficha só nasce se o usuário escolher Ficha.
 */
export async function iniciarReceitaDeAgendamento(
  appointmentId: string,
): Promise<{ error: string | null; patient: { id: string; nome: string } | null; appointmentId: string }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message, patient: null, appointmentId }

  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, patients ( id, nome )')
    .eq('id', appointmentId)
    .eq('org_id', ctx.orgId)
    .single()
  if (!appointment) return { error: 'Agendamento não encontrado', patient: null, appointmentId }

  await supabase
    .from('appointments')
    .update({ status: 'em_andamento', updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('org_id', ctx.orgId)
    .in('status', ['agendado', 'confirmado'])

  const pacienteRel = Array.isArray(appointment.patients) ? appointment.patients[0] : appointment.patients
  if (!pacienteRel) return { error: 'Paciente não encontrado', patient: null, appointmentId }

  revalidatePath('/agenda')
  return { error: null, patient: { id: pacienteRel.id, nome: pacienteRel.nome }, appointmentId }
}

/**
 * Inicia um atendimento a partir de um agendamento existente.
 * - Verifica que o appointment pertence à org do usuário autenticado.
 * - Reutiliza clinical_record existente se já houver um para este appointment.
 * - Cria um novo clinical_record caso contrário.
 *
 * Segurança: org_id sempre lido de profiles server-side.
 */
export async function iniciarAtendimento(
  appointmentId: string,
  // Nome/rótulo do atendimento (opcional). Quando fornecido pelo modal de
  // início, persiste em appointments.titulo. `undefined` = não mexe no título
  // existente; `null`/'' = limpa.
  titulo?: string | null,
): Promise<{ error: string | null; recordId: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message, recordId: null }

  // Confirma que o agendamento pertence à org antes de qualquer operação
  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, patient_id')
    .eq('id', appointmentId)
    .eq('org_id', ctx.orgId)
    .single()
  if (!appointment) return { error: 'Agendamento não encontrado', recordId: null }

  // Grava o nome do atendimento quando o modal de início o forneceu.
  if (titulo !== undefined) {
    await supabase
      .from('appointments')
      // Trunca em 120 no servidor — defesa contra título gigante vindo de
      // chamada manipulada (o schema de walk-in já limita o seu caminho).
      .update({ titulo: titulo?.trim().slice(0, 120) || null, updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .eq('org_id', ctx.orgId)
  }

  // Marca o agendamento como "em andamento" para refletir na grade da agenda.
  // Só a partir de agendado/confirmado (o `.in` evita mexer em terminais).
  await supabase
    .from('appointments')
    .update({ status: 'em_andamento', updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('org_id', ctx.orgId)
    .in('status', ['agendado', 'confirmado'])

  // Reutiliza a ficha ATIVA existente para evitar duplicatas (ignora arquivadas
  // — um atendimento arquivado e reiniciado ganha uma ficha nova).
  const { data: existing } = await supabase
    .from('clinical_records')
    .select('id')
    .eq('appointment_id', appointmentId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    revalidatePath('/agenda')
    return { error: null, recordId: existing.id }
  }

  // Cria a nova ficha. O índice único parcial (clinical_records_appointment_active_unique)
  // garante atomicidade real: numa corrida (duas abas / clique duplo), o segundo
  // INSERT viola o unique (código 23505) e nós re-buscamos a ficha que o primeiro
  // criou — a operação fica idempotente em vez de criar duplicata.
  const { data: record, error } = await supabase
    .from('clinical_records')
    .insert({
      appointment_id: appointmentId,
      patient_id: appointment.patient_id,
      org_id: ctx.orgId,
      modelo: 'resumido',
      status: 'em_andamento',
    })
    .select('id')
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const { data: jaCriado } = await supabase
        .from('clinical_records')
        .select('id')
        .eq('appointment_id', appointmentId)
        .eq('org_id', ctx.orgId)
        .is('deleted_at', null)
        .maybeSingle()
      if (jaCriado) {
        revalidatePath('/agenda')
        return { error: null, recordId: jaCriado.id }
      }
    }
    return { error: mensagemErroAmigavel(error), recordId: null }
  }
  revalidatePath('/agenda')
  return { error: null, recordId: record.id }
}

/**
 * Walk-in: cria appointment (walkin=true) + clinical_record vinculado em
 * uma sequencia atomica do ponto de vista do usuario, e retorna o recordId
 * para redirecionar direto a ficha de atendimento.
 *
 * REFATORADO: nao usa mais tipo_consulta. Duracao vem direto do input.
 */
export async function iniciarAtendimentoWalkin(input: {
  patientId: string
  duracao: number
  observacao?: string | null
  titulo?: string | null
}): Promise<{ error: string | null; recordId: string | null }> {
  // Valida input com Zod antes de tocar no banco.
  const parsed = walkinSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Dados inválidos', recordId: null }
  }
  const { patientId, duracao, observacao, titulo } = parsed.data

  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message, recordId: null }

  // Confirma que o paciente pertence a org (camada 3)
  const { data: paciente } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (!paciente) return { error: 'Paciente não encontrado', recordId: null }

  // Cria appointment com walkin=true e horario atual (SEM tipo_consulta_id)
  const agora = new Date().toISOString()
  const { data: appointment, error: errAppt } = await supabase
    .from('appointments')
    .insert({
      org_id: ctx.orgId,
      patient_id: patientId,
      // tipo_consulta_id: null — nao enviamos mais
      data_hora: agora,
      duracao: duracao,
      // Walk-in já entra em atendimento (a ficha é criada na sequência).
      status: 'em_andamento',
      walkin: true,
      observacao: observacao ?? null,
      titulo: titulo ?? null,
    })
    .select('id')
    .single()
  if (errAppt) return { error: mensagemErroAmigavel(errAppt), recordId: null }

  // Cria clinical_record vinculado ja em andamento
  const { data: record, error: errRec } = await supabase
    .from('clinical_records')
    .insert({
      appointment_id: appointment.id,
      patient_id: patientId,
      org_id: ctx.orgId,
      modelo: 'resumido',
      status: 'em_andamento',
    })
    .select('id')
    .single()
  if (errRec) {
    // Compensa appointment criado para nao deixar lixo
    await supabase.from('appointments').delete().eq('id', appointment.id)
    return { error: mensagemErroAmigavel(errRec), recordId: null }
  }

  revalidatePath('/agenda')
  return { error: null, recordId: record.id }
}

/**
 * Remove permanentemente um agendamento (hard delete).
 *
 * Regras de proteção:
 * - Bloqueia exclusão se houver `clinical_record` com status='finalizado' vinculado:
 *   ficha finalizada gera prescrição (documento legal). Excluir aqui apagaria
 *   dados clínicos. Para "ocultar" use cancelarAgendamento.
 * - Em cascata exclui `clinical_record` em_andamento vinculado (precisa por FK).
 *
 * Retorna error: 'AGENDAMENTO_FINALIZADO' quando bloqueado por ficha finalizada.
 */
export async function excluirAgendamento(
  appointmentId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // Bloqueia exclusão se houver ficha finalizada (proteção legal/clínica)
  const { data: recordFinalizado } = await supabase
    .from('clinical_records')
    .select('id')
    .eq('appointment_id', appointmentId)
    .eq('org_id', ctx.orgId)
    .eq('status', 'finalizado')
    .maybeSingle()

  if (recordFinalizado) {
    return { error: 'AGENDAMENTO_FINALIZADO' }
  }

  // Remove clinical_record em_andamento vinculado antes de deletar o appointment (FK)
  await supabase
    .from('clinical_records')
    .delete()
    .eq('appointment_id', appointmentId)
    .eq('org_id', ctx.orgId)

  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', appointmentId)
    .eq('org_id', ctx.orgId)

  if (error) return { error: mensagemErroAmigavel(error) }
  revalidatePath('/ficha')
  revalidatePath('/agenda')
  return { error: null }
}

/**
 * Exclui um atendimento POR COMPLETO a partir da Central de Atendimento.
 *
 * Diferente de `excluirAtendimentoAtivo` (que protege fichas finalizadas), esta
 * action também remove atendimentos FINALIZADOS — apagando em cascata a ficha
 * clínica (clinical_record) e a receita (prescription) vinculada.
 *
 * Decisão de produto (Octavio, 29/05/2026): a Central permite limpeza total do
 * atendimento, incluindo prontuário/prescrição. A trava legal/CBOO foi removida
 * conscientemente neste fluxo — os demais call sites continuam usando a action
 * protegida `excluirAtendimentoAtivo`.
 *
 * Ordem dos deletes respeita as FKs: prescriptions → clinical_records → appointments.
 *
 * Comportamento do agendamento:
 *   - em_andamento: reverte o appointment para 'agendado' (volta pra fila).
 *   - finalizado:   remove o appointment vinculado (limpeza total).
 */
export async function excluirAtendimentoCompleto(
  recordId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // Confirma que a ficha pertence à org (defesa cross-tenant)
  const { data: record } = await supabase
    .from('clinical_records')
    .select('id, appointment_id, status')
    .eq('id', recordId)
    .eq('org_id', ctx.orgId)
    .single()
  if (!record) return { error: 'Atendimento não encontrado' }

  // 1. Apaga a receita (prescription) vinculada — hard delete.
  //    Precisa vir ANTES do clinical_record por causa da FK
  //    prescriptions_clinical_record_id_fkey.
  const { error: errPresc } = await supabase
    .from('prescriptions')
    .delete()
    .eq('clinical_record_id', recordId)
    .eq('org_id', ctx.orgId)
  if (errPresc) return { error: mensagemErroAmigavel(errPresc) }

  // 2. Apaga a ficha clínica (clinical_record).
  const { error: errRec } = await supabase
    .from('clinical_records')
    .delete()
    .eq('id', recordId)
    .eq('org_id', ctx.orgId)
  if (errRec) return { error: mensagemErroAmigavel(errRec) }

  // 3. Trata o agendamento conforme o estado do atendimento.
  if (record.appointment_id) {
    if (record.status === 'finalizado') {
      // Atendimento concluído sendo apagado por completo: remove o slot da agenda.
      // Seguro: nenhuma outra tabela referencia appointments por FK além da ficha
      // (já deletada acima).
      await supabase
        .from('appointments')
        .delete()
        .eq('id', record.appointment_id)
        .eq('org_id', ctx.orgId)
    } else {
      // Em andamento: agendamento volta pra fila (mantém comportamento legado).
      await supabase
        .from('appointments')
        .update({ status: 'agendado' })
        .eq('id', record.appointment_id)
        .eq('org_id', ctx.orgId)
        .eq('status', 'em_andamento')
    }
  }

  revalidatePath('/ficha')
  revalidatePath('/agenda')
  return { error: null }
}

/**
 * Arquiva um atendimento (soft delete) a partir da Central de Atendimento.
 *
 * Arquiva EM CONJUNTO a ficha clínica (clinical_records.deleted_at) e a receita
 * vinculada (prescriptions.deleted_at). A receita some da aba /receitas
 * automaticamente (a listagem já filtra deleted_at IS NULL). Reversível via
 * `restaurarAtendimento`; limpeza definitiva via `excluirAtendimentoCompleto`.
 *
 * Não mexe no appointment: o agendamento mantém seu estado histórico (concluído),
 * o que torna o arquivar/restaurar simétrico e sem efeito colateral na Agenda.
 */
export async function arquivarAtendimento(
  recordId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  const now = new Date().toISOString()

  // Arquiva a ficha. O .is('deleted_at', null) evita re-arquivar e confirma
  // que pertence à org (defesa cross-tenant via org_id).
  const { data: rec, error: errRec } = await supabase
    .from('clinical_records')
    .update({ deleted_at: now })
    .eq('id', recordId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()
  if (errRec) return { error: mensagemErroAmigavel(errRec) }
  if (!rec) return { error: 'Atendimento não encontrado' }

  // Arquiva a receita gerada por esta ficha (some de /receitas).
  await supabase
    .from('prescriptions')
    .update({ deleted_at: now })
    .eq('clinical_record_id', recordId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)

  revalidatePath('/ficha')
  revalidatePath('/receitas')
  revalidatePath('/agenda')
  return { error: null }
}

/**
 * Restaura um atendimento arquivado — traz a ficha e a receita de volta às
 * listagens ativas (limpa o deleted_at de ambas).
 */
export async function restaurarAtendimento(
  recordId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  const { data: rec, error: errRec } = await supabase
    .from('clinical_records')
    .update({ deleted_at: null })
    .eq('id', recordId)
    .eq('org_id', ctx.orgId)
    // Só restaura o que estava de fato arquivado — evita no-op silencioso e dá
    // feedback ("não encontrado") se a ficha já estava ativa.
    .not('deleted_at', 'is', null)
    .select('id')
    .maybeSingle()
  if (errRec) return { error: mensagemErroAmigavel(errRec) }
  if (!rec) return { error: 'Atendimento não encontrado' }

  // Restaura a receita vinculada junto.
  await supabase
    .from('prescriptions')
    .update({ deleted_at: null })
    .eq('clinical_record_id', recordId)
    .eq('org_id', ctx.orgId)

  revalidatePath('/ficha')
  revalidatePath('/receitas')
  revalidatePath('/agenda')
  return { error: null }
}

/**
 * Restaura vários atendimentos arquivados de uma vez (ficha + receita vinculada).
 */
export async function restaurarAtendimentosEmMassa(
  recordIds: string[],
): Promise<{ error: string | null; total: number }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message, total: 0 }
  if (recordIds.length === 0) return { error: null, total: 0 }

  const { error } = await supabase
    .from('clinical_records')
    .update({ deleted_at: null })
    .in('id', recordIds)
    .eq('org_id', ctx.orgId)
  if (error) return { error: mensagemErroAmigavel(error), total: 0 }

  await supabase
    .from('prescriptions')
    .update({ deleted_at: null })
    .in('clinical_record_id', recordIds)
    .eq('org_id', ctx.orgId)

  revalidatePath('/ficha')
  revalidatePath('/receitas')
  revalidatePath('/agenda')
  return { error: null, total: recordIds.length }
}

/**
 * Exclusão DEFINITIVA (hard delete) de vários atendimentos arquivados de uma vez.
 * Apaga em cascata manual (FKs NO ACTION): prescriptions → clinical_records →
 * appointments. Usada na limpeza da visão "Arquivados".
 */
export async function excluirAtendimentosEmMassa(
  recordIds: string[],
): Promise<{ error: string | null; total: number }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message, total: 0 }
  if (recordIds.length === 0) return { error: null, total: 0 }

  // Confirma org + coleta os appointment_ids vinculados.
  const { data: records } = await supabase
    .from('clinical_records')
    .select('id, appointment_id')
    .in('id', recordIds)
    .eq('org_id', ctx.orgId)

  const ids = (records ?? []).map((r) => r.id)
  if (ids.length === 0) return { error: null, total: 0 }
  const apptIds = (records ?? [])
    .map((r) => r.appointment_id)
    .filter((v): v is string => !!v)

  await supabase.from('prescriptions').delete().in('clinical_record_id', ids).eq('org_id', ctx.orgId)
  const { error } = await supabase.from('clinical_records').delete().in('id', ids).eq('org_id', ctx.orgId)
  if (error) return { error: mensagemErroAmigavel(error), total: 0 }
  if (apptIds.length > 0) {
    await supabase.from('appointments').delete().in('id', apptIds).eq('org_id', ctx.orgId)
  }

  revalidatePath('/ficha')
  revalidatePath('/receitas')
  revalidatePath('/agenda')
  return { error: null, total: ids.length }
}

export async function cancelarAgendamento(
  appointmentId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // F5-A04: bloqueia cancelamento se houver ficha finalizada vinculada.
  // Estado inconsistente (record finalizado + appointment cancelado) destruiria
  // o vínculo do prontuário legal CBOO. Espelha a proteção já presente em
  // excluirAgendamento, mas aqui retornamos uma mensagem mais explícita pra
  // UI exibir como toast (não código de erro abstrato).
  const { data: recordVinculado } = await supabase
    .from('clinical_records')
    .select('id, status')
    .eq('appointment_id', appointmentId)
    .eq('org_id', ctx.orgId)
    .maybeSingle()

  if (recordVinculado?.status === 'finalizado') {
    return { error: 'Não é possível cancelar: ficha clínica já foi finalizada' }
  }

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelado' })
    .eq('id', appointmentId)
    .eq('org_id', ctx.orgId)

  if (error) return { error: mensagemErroAmigavel(error) }
  revalidatePath('/ficha')
  revalidatePath('/agenda')
  return { error: null }
}

/**
 * Encaixe rapido com paciente NOVO (Etapa 9 #28):
 * cria patient + appointment walk-in + clinical_record em sequencia.
 *
 * REFATORADO: nao usa mais tipo_consulta. Duracao vem direto do input.
 */
export async function iniciarAtendimentoComNovoPaciente(input: {
  paciente: {
    nome: string
    whatsapp: string
    cpf?: string | null
    data_nascimento?: string | null
    responsavel_legal?: string | null
    email?: string | null
    endereco?: string | null
    sexo_biologico?: 'M' | 'F' | null
    observacoes?: string | null
  }
  duracao: number
  observacao?: string | null
}): Promise<{ error: string | null; recordId: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message, recordId: null }

  // Valida payload do paciente com Zod antes do INSERT em PII.
  const parsedPaciente = pacienteSchema.safeParse(input.paciente)
  if (!parsedPaciente.success) {
    return { error: 'Dados do paciente inválidos', recordId: null }
  }

  // Valida duracao e observacao
  const parsedRest = z
    .object({
      duracao: z.number().int().min(5).max(480),
      observacao: z.string().trim().max(500).nullable().optional(),
    })
    .safeParse({
      duracao: input.duracao,
      observacao: input.observacao,
    })
  if (!parsedRest.success) {
    return { error: 'Duração ou observação inválidos', recordId: null }
  }

  // Cria o paciente — org_id sempre do contexto autenticado.
  // Trata violacao do UNIQUE `patients_org_cpf_active_unique`
  // (CPF ja cadastrado nesta org).
  const { data: paciente, error: errPac } = await supabase
    .from('patients')
    .insert({
      org_id: ctx.orgId,
      nome: parsedPaciente.data.nome,
      cpf: parsedPaciente.data.cpf || null,
      whatsapp: parsedPaciente.data.whatsapp || null,
      data_nascimento: parsedPaciente.data.data_nascimento || null,
      responsavel_legal: parsedPaciente.data.responsavel_legal || null,
      email: parsedPaciente.data.email || null,
      endereco: parsedPaciente.data.endereco || null,
      sexo_biologico: parsedPaciente.data.sexo_biologico ?? null,
      observacoes: parsedPaciente.data.observacoes || null,
    })
    .select('id')
    .single()

  if (errPac || !paciente) {
    if (errPac?.code === '23505') {
      return { error: 'CPF_DUPLICADO', recordId: null }
    }
    return { error: errPac?.message ?? 'Falha ao cadastrar paciente', recordId: null }
  }

  // Reusa o fluxo walk-in para criar appointment + clinical_record
  return iniciarAtendimentoWalkin({
    patientId: paciente.id,
    duracao: parsedRest.data.duracao,
    observacao: parsedRest.data.observacao ?? null,
  })
}

export async function excluirAtendimentoAtivo(
  recordId: string
): Promise<{ error: string | null }> {
  // F3-C03: usa assertActiveOrg pra validar plan_status (org suspensa
  // nao deve conseguir excluir fichas via fetch direto).
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // Busca o appointment_id antes de deletar
  const { data: record } = await supabase
    .from('clinical_records')
    .select('id, appointment_id, status')
    .eq('id', recordId)
    .eq('org_id', ctx.orgId)
    .single()
  if (!record) return { error: 'Atendimento não encontrado' }

  // Proteção legal/clínica: ficha finalizada não pode ser excluída
  if (record.status === 'finalizado') {
    return { error: 'AGENDAMENTO_FINALIZADO' }
  }

  // Deleta o clinical_record
  const { error: errDelete } = await supabase
    .from('clinical_records')
    .delete()
    .eq('id', recordId)
    .eq('org_id', ctx.orgId)

  if (errDelete) return { error: mensagemErroAmigavel(errDelete) }

  // F5-A03: só reverte para 'agendado' se o appointment estava em_andamento.
  // Antes, o UPDATE incondicional sobrescrevia 'confirmado' (perde confirmação)
  // e reativava 'cancelado'/'faltou' (transição proibida). Filtro .eq('status',
  // 'em_andamento') torna o UPDATE no-op fora desse estado.
  // Limitação aceita: 'confirmado' → 'em_andamento' → excluir → 'agendado'
  // perde a confirmação. Documentado em decisions.md.
  if (record.appointment_id) {
    await supabase
      .from('appointments')
      .update({ status: 'agendado' })
      .eq('id', record.appointment_id)
      .eq('org_id', ctx.orgId)
      .eq('status', 'em_andamento')
  }

  revalidatePath('/ficha')
  revalidatePath('/agenda')
  return { error: null }
}
