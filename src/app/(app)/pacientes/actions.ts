'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { pacienteSchema, type PacienteInput } from '@/lib/validations/paciente'
import { logEventServer } from '@/lib/events'
import { assertActiveOrg } from '@/lib/auth-guards'
import { mensagemErroAmigavel } from '@/lib/utils/erro'
import { ZodError } from 'zod'

// Tipo de retorno padronizado para criarPaciente
type CriarPacienteResult = {
  error: string | null
  pacienteId?: string
  pacienteExistenteId?: string
}

/**
 * Cria um novo paciente.
 * - org_id sempre lido server-side de profiles.
 * - Antes de criar: verifica CPF duplicado na org (check otimista).
 * - Também trata unique_violation (23505) para race conditions.
 * - Retorna { error: 'CPF_DUPLICADO', pacienteExistenteId } se duplicado.
 */
export async function criarPaciente(input: PacienteInput): Promise<CriarPacienteResult> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // Valida o input com Zod
  let parsed: PacienteInput
  try {
    parsed = pacienteSchema.parse(input)
  } catch (err) {
    if (err instanceof ZodError) return { error: 'VALIDACAO_FALHOU' }
    return { error: 'VALIDACAO_FALHOU' }
  }

  // CPF é opcional no cadastro rápido — só checa duplicidade quando informado.
  if (parsed.cpf) {
    // Verifica CPF duplicado na org (apenas registros não deletados)
    const { data: existente } = await supabase
      .from('patients')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('cpf', parsed.cpf)
      .is('deleted_at', null)
      .maybeSingle()

    if (existente) {
      return { error: 'CPF_DUPLICADO', pacienteExistenteId: existente.id }
    }

    // CPF pertence a um paciente arquivado? Avisa para restaurar em vez de
    // duplicar — criar um novo ativo com o mesmo CPF trava depois a restauração
    // do arquivado (índice único parcial patients_org_cpf_active_unique).
    const { data: arquivado } = await supabase
      .from('patients')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('cpf', parsed.cpf)
      .not('deleted_at', 'is', null)
      .maybeSingle()

    if (arquivado) {
      return { error: 'CPF_DUPLICADO_ARQUIVADO', pacienteExistenteId: arquivado.id }
    }
  }

  // Cria o paciente
  const { data: novoPaciente, error } = await supabase
    .from('patients')
    .insert({
      org_id: ctx.orgId,
      nome: parsed.nome,
      cpf: parsed.cpf || null,
      whatsapp: parsed.whatsapp,
      data_nascimento: parsed.data_nascimento || null,
      email: parsed.email || null,
      endereco: parsed.endereco || null,
      sexo_biologico: parsed.sexo_biologico ?? null,
      responsavel_legal: parsed.responsavel_legal || null,
      observacoes: parsed.observacoes || null,
      origem_id: parsed.origem_id ?? null,
    })
    .select('id')
    .single()

  if (error) {
    // 23505 = unique_violation — race condition no check de CPF (só ocorre
    // quando cpf foi informado, já que o índice único é sobre essa coluna).
    if ((error as { code?: string }).code === '23505' && parsed.cpf) {
      const { data: dup } = await supabase
        .from('patients')
        .select('id')
        .eq('org_id', ctx.orgId)
        .eq('cpf', parsed.cpf)
        .is('deleted_at', null)
        .maybeSingle()
      return { error: 'CPF_DUPLICADO', pacienteExistenteId: dup?.id }
    }
    return { error: mensagemErroAmigavel(error) }
  }

  // Evento: paciente criado (não-bloqueante — usado pelo painel /admin)
  await logEventServer(supabase, {
    userId: ctx.userId,
    orgId: ctx.orgId,
    eventName: 'patient_created',
    payload: { patient_id: novoPaciente.id },
  })

  revalidatePath('/pacientes')
  return { error: null, pacienteId: novoPaciente.id }
}

/**
 * Atualiza dados de um paciente.
 * - Verifica que o paciente pertence à org antes de atualizar.
 */
export async function atualizarPaciente(
  id: string,
  input: PacienteInput
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // Valida input
  let parsed: PacienteInput
  try {
    parsed = pacienteSchema.parse(input)
  } catch (err) {
    if (err instanceof ZodError) return { error: 'VALIDACAO_FALHOU' }
    return { error: 'VALIDACAO_FALHOU' }
  }

  // Confirma que o paciente pertence à org
  const { data: paciente } = await supabase
    .from('patients')
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!paciente) return { error: 'Paciente não encontrado' }

  const { error } = await supabase
    .from('patients')
    .update({
      nome: parsed.nome,
      cpf: parsed.cpf || null,
      whatsapp: parsed.whatsapp,
      data_nascimento: parsed.data_nascimento || null,
      email: parsed.email || null,
      endereco: parsed.endereco || null,
      sexo_biologico: parsed.sexo_biologico ?? null,
      responsavel_legal: parsed.responsavel_legal || null,
      observacoes: parsed.observacoes || null,
      origem_id: parsed.origem_id ?? null,
    })
    .eq('id', id)

  if (error) return { error: mensagemErroAmigavel(error) }

  revalidatePath('/pacientes')
  revalidatePath(`/pacientes/${id}`)
  return { error: null }
}

/**
 * Soft delete de paciente.
 * - Permitido a qualquer momento, mesmo com atendimentos/receitas vinculadas.
 * - Apenas atualiza deleted_at (LGPD: recuperável; nunca faz hard delete).
 * - Os atendimentos e receitas continuam no banco mas somem das listagens
 *   pelo JOIN com patients!inner + filtro deleted_at IS NULL.
 */
export async function excluirPaciente(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // Confirma que o paciente pertence à org
  const { data: paciente } = await supabase
    .from('patients')
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!paciente) return { error: 'Paciente não encontrado' }

  // Soft delete — backend não bloqueia mais por histórico
  const { error } = await supabase
    .from('patients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: mensagemErroAmigavel(error) }

  revalidatePath('/pacientes')
  return { error: null }
}

/**
 * Restaura um paciente arquivado (deleted_at → null). Inverso do soft delete.
 * - Valida org ownership; o SELECT busca justamente um registro arquivado.
 */
export async function restaurarPaciente(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  const { data: paciente } = await supabase
    .from('patients')
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .not('deleted_at', 'is', null)
    .maybeSingle()

  if (!paciente) return { error: 'Paciente não encontrado' }

  const { error } = await supabase
    .from('patients')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: mensagemErroAmigavel(error) }

  revalidatePath('/pacientes')
  return { error: null }
}

/**
 * Conta atendimentos (clinical_records) e receitas (prescriptions) vinculadas
 * a um paciente. Usado para popular o modal de confirmação de exclusão.
 * - Valida org ownership do paciente antes de contar.
 * - Receitas filtradas por deleted_at IS NULL (não conta receitas já apagadas).
 */
export async function contarHistoricoPaciente(
  id: string,
): Promise<{ error: string | null; atendimentos?: number; receitas?: number }> {
  const supabase = await createClient()

  // Usa o guard centralizado (auth + profile + plan_status='active' em cache).
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // Confirma que o paciente pertence à org
  const { data: paciente } = await supabase
    .from('patients')
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!paciente) return { error: 'Paciente não encontrado' }

  // Defesa em profundidade: filtra por org_id mesmo com RLS já cobrindo.
  // clinical_records: ignora fichas deletadas — coerência com o resto da UI.
  const { count: atendimentos } = await supabase
    .from('clinical_records')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', id)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)

  const { count: receitas } = await supabase
    .from('prescriptions')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', id)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)

  return {
    error: null,
    atendimentos: atendimentos ?? 0,
    receitas: receitas ?? 0,
  }
}

/**
 * Exclusão DEFINITIVA (hard delete) de pacientes arquivados — usada na visão
 * "Arquivados" para limpeza total. Apaga em cascata manual (FKs são NO ACTION),
 * na ordem: prescriptions → clinical_records → appointments → patients.
 *
 * Decisão de produto (Octavio, 29/05/2026): a limpeza de arquivados pode apagar
 * todo o histórico clínico do paciente (prontuário + receitas). Por isso só age
 * sobre pacientes JÁ arquivados (deleted_at NOT NULL) e exige confirmação na UI.
 */
export async function excluirPacientesEmMassa(
  patientIds: string[],
): Promise<{ error: string | null; total: number }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message, total: 0 }
  if (patientIds.length === 0) return { error: null, total: 0 }

  // Só pacientes ARQUIVADOS desta org entram na limpeza (proteção dupla).
  const { data: pacientes } = await supabase
    .from('patients')
    .select('id')
    .in('id', patientIds)
    .eq('org_id', ctx.orgId)
    .not('deleted_at', 'is', null)

  const ids = (pacientes ?? []).map((p) => p.id)
  if (ids.length === 0) return { error: null, total: 0 }

  // Ordem das FKs (NO ACTION): filhos antes do pai.
  await supabase.from('prescriptions').delete().in('patient_id', ids).eq('org_id', ctx.orgId)
  await supabase.from('clinical_records').delete().in('patient_id', ids).eq('org_id', ctx.orgId)
  await supabase.from('appointments').delete().in('patient_id', ids).eq('org_id', ctx.orgId)
  const { error } = await supabase.from('patients').delete().in('id', ids).eq('org_id', ctx.orgId)
  if (error) return { error: mensagemErroAmigavel(error), total: 0 }

  revalidatePath('/pacientes')
  revalidatePath('/ficha')
  revalidatePath('/receitas')
  revalidatePath('/agenda')
  return { error: null, total: ids.length }
}

/** Restaura vários pacientes arquivados de uma vez. */
export async function restaurarPacientesEmMassa(
  patientIds: string[],
): Promise<{ error: string | null; total: number }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message, total: 0 }
  if (patientIds.length === 0) return { error: null, total: 0 }

  const { error } = await supabase
    .from('patients')
    .update({ deleted_at: null })
    .in('id', patientIds)
    .eq('org_id', ctx.orgId)
  if (error) return { error: mensagemErroAmigavel(error), total: 0 }

  revalidatePath('/pacientes')
  revalidatePath('/ficha')
  revalidatePath('/receitas')
  return { error: null, total: patientIds.length }
}

/** Exclusão definitiva de um único paciente arquivado. */
export async function excluirPacienteDefinitivo(
  id: string,
): Promise<{ error: string | null; total: number }> {
  return excluirPacientesEmMassa([id])
}
