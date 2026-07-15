'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertActiveOrg } from '@/lib/auth-guards'
import { revalidatePath } from 'next/cache'
import { mensagemErroAmigavel } from '@/lib/utils/erro'
import {
  atualizarReceitaRapidaSchema,
  criarRascunhoReceitaSchema,
  rascunhoReceitaIdSchema,
} from '@/lib/validations/receitas'
import { novaPrescricaoSchema } from '@/lib/validations/clinical'
import type { Json } from '@/types/database'
import type { NovaPrescricao } from '@/types/clinical'
import { arquivarAtendimento, restaurarAtendimento } from '@/app/(app)/agenda/actions'
import * as Sentry from '@sentry/nextjs'

// F5-C02: schema mínimo — apenas o id da prescrição.
// Mutações no client (`useDeletarPrescricao`, `deletarReceita`) chamavam o
// Supabase direto, sem validar status da ficha pai. Receita legal era apagável
// por qualquer user da org.
const excluirPrescricaoSchema = z.object({
  prescricaoId: z.string().uuid(),
})

/**
 * Soft delete de prescrição (preenche `deleted_at`).
 *
 * Proteções:
 * - Auth + org ativa (assertActiveOrg).
 * - org_id do contexto autenticado, nunca do client.
 * - Bloqueia exclusão se a prescrição estiver vinculada a clinical_record
 *   com status='finalizado' (documento legal — apagar perde rastreabilidade).
 *   Receita rápida (sem clinical_record_id) ou vinculada a ficha em_andamento
 *   continua excluível.
 *
 * B2.2 (CA16): desde a cascata bidirecional, vinculada finalizada passa a
 * arquivar por `arquivarReceita` → `arquivarAtendimento` (nunca chega aqui).
 * A trava acima fica só como defesa caso esta função seja chamada direto.
 */
export async function excluirPrescricao(
  input: { prescricaoId: string },
): Promise<{ error: string | null }> {
  const parsed = excluirPrescricaoSchema.safeParse(input)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // Busca a prescrição e o status da ficha pai (se houver).
  // org_id no filtro garante isolamento cross-tenant.
  const { data: prescricao, error: errFetch } = await supabase
    .from('prescriptions')
    .select(
      `
      id,
      org_id,
      clinical_record_id,
      clinical_records:clinical_record_id ( status )
    `,
    )
    .eq('id', parsed.data.prescricaoId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (errFetch || !prescricao) {
    return { error: 'Prescrição não encontrada' }
  }

  // Supabase tipa relação 1:1 ora como array, ora como objeto — normaliza.
  const recordRel = Array.isArray(prescricao.clinical_records)
    ? prescricao.clinical_records[0]
    : prescricao.clinical_records

  if (recordRel?.status === 'finalizado') {
    return { error: 'Não é possível excluir receita de ficha finalizada' }
  }

  const { error } = await supabase
    .from('prescriptions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data.prescricaoId)
    .eq('org_id', ctx.orgId)

  if (error) return { error: 'Falha ao excluir' }

  // Invalida caches SSR das duas telas que listam prescrições.
  revalidatePath('/receitas')
  revalidatePath('/pacientes/[id]', 'page')

  return { error: null }
}

/**
 * Restaura uma receita arquivada (deleted_at → null) — usada na visão
 * "Arquivadas" da aba Receitas.
 */
export async function restaurarPrescricao(
  prescricaoId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  const { error } = await supabase
    .from('prescriptions')
    .update({ deleted_at: null })
    .eq('id', prescricaoId)
    .eq('org_id', ctx.orgId)
    .not('deleted_at', 'is', null)

  if (error) return { error: 'Falha ao restaurar' }
  revalidatePath('/receitas')
  return { error: null }
}

/**
 * Exclusão DEFINITIVA (hard delete) de receitas arquivadas — limpeza total da
 * visão "Arquivadas". Só age sobre receitas JÁ arquivadas (deleted_at NOT NULL).
 * prescriptions não tem filhos, então o DELETE é direto.
 */
export async function excluirPrescricoesEmMassa(
  prescricaoIds: string[],
): Promise<{ error: string | null; total: number }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message, total: 0 }
  if (prescricaoIds.length === 0) return { error: null, total: 0 }

  const { data: encontradas } = await supabase
    .from('prescriptions')
    .select('id')
    .in('id', prescricaoIds)
    .eq('org_id', ctx.orgId)
    .not('deleted_at', 'is', null)

  const ids = (encontradas ?? []).map((p) => p.id)
  if (ids.length === 0) return { error: null, total: 0 }

  const { error } = await supabase
    .from('prescriptions')
    .delete()
    .in('id', ids)
    .eq('org_id', ctx.orgId)
  if (error) return { error: mensagemErroAmigavel(error), total: 0 }

  revalidatePath('/receitas')
  return { error: null, total: ids.length }
}

/** Restaura várias receitas arquivadas de uma vez. */
export async function restaurarPrescricoesEmMassa(
  prescricaoIds: string[],
): Promise<{ error: string | null; total: number }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message, total: 0 }
  if (prescricaoIds.length === 0) return { error: null, total: 0 }

  const { error } = await supabase
    .from('prescriptions')
    .update({ deleted_at: null })
    .in('id', prescricaoIds)
    .eq('org_id', ctx.orgId)
  if (error) return { error: mensagemErroAmigavel(error), total: 0 }

  revalidatePath('/receitas')
  return { error: null, total: prescricaoIds.length }
}

/** Exclusão definitiva de uma única receita arquivada. */
export async function excluirPrescricaoDefinitiva(
  id: string,
): Promise<{ error: string | null; total: number }> {
  return excluirPrescricoesEmMassa([id])
}

/**
 * Reorganização "Novo Atendimento" (CA4b): edita uma receita quick/standalone
 * já emitida — atualiza `dados_prescricao` da MESMA linha (não cria nova).
 * O PDF é sempre renderizado on-demand a partir do estado atual da linha
 * (ver /api/prescricao/[id]), então não há "regeneração" separada a fazer.
 *
 * Invariante de status (CA4b): NÃO mexe em `appointments` — a 1ª emissão já
 * marcou o agendamento como concluído; edições posteriores não revertem isso.
 *
 * B2.1 (CA13–CA14): receita VINCULADA a uma ficha também edita por aqui agora
 * — a proteção de 29/05 que rejeitava esse caso foi revertida (decisão Q2).
 * Além de atualizar a própria linha de `prescriptions`, reflete `nova_prescricao`
 * no `clinical_data` da ficha (o mesmo objeto que `upsertPrescricaoSnapshot`
 * grava na via ficha→receita — as duas vias não podem divergir) e marca a
 * ficha como editada (trilha de quem/quando). NÃO mexe em `status` da ficha
 * nem em `appointments` (CA14) — editar a receita nunca reabre nem revalida a
 * ficha.
 */
export async function atualizarReceitaRapida(
  input: { prescricaoId: string; dados_prescricao: unknown },
): Promise<{ error: string | null }> {
  const parsed = atualizarReceitaRapidaSchema.safeParse(input)
  if (!parsed.success) return { error: 'Dados inválidos' }

  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  const { data: prescricao } = await supabase
    .from('prescriptions')
    .select('id, clinical_record_id')
    .eq('id', parsed.data.prescricaoId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!prescricao) return { error: 'Receita não encontrada' }

  const { error } = await supabase
    .from('prescriptions')
    .update({
      dados_prescricao: parsed.data.dados_prescricao as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.prescricaoId)
    .eq('org_id', ctx.orgId)

  if (error) return { error: mensagemErroAmigavel(error) }

  if (prescricao.clinical_record_id) {
    const recordId = prescricao.clinical_record_id
    const { data: record } = await supabase
      .from('clinical_records')
      .select('clinical_data')
      .eq('id', recordId)
      .eq('org_id', ctx.orgId)
      .maybeSingle()

    if (record) {
      const clinicalData = (record.clinical_data ?? {}) as Record<string, unknown>
      const merged = { ...clinicalData, nova_prescricao: parsed.data.dados_prescricao }

      await supabase
        .from('clinical_records')
        .update({
          clinical_data: merged as Json,
          editado: true,
          editado_em: new Date().toISOString(),
          last_edited_by: ctx.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .eq('org_id', ctx.orgId)
    }

    revalidatePath(`/ficha/${recordId}`)
    revalidatePath('/ficha')
  }

  revalidatePath('/receitas')
  revalidatePath('/pacientes/[id]', 'page')
  return { error: null }
}

/**
 * Arquiva uma receita — ponto único de decisão do CA16/CA18: se a receita é
 * VINCULADA a uma ficha, delega para `arquivarAtendimento` (cascata
 * ficha+receita, já existente); se é AVULSA, arquiva só a receita
 * (`excluirPrescricao`, sem cascata).
 *
 * Edge case 2 (corrida): se a ficha vinculada já estiver arquivada, é no-op
 * bem-sucedido (idempotente) em vez de propagar o "não encontrado" que
 * `arquivarAtendimento` devolveria (ele espera `deleted_at` ainda null).
 */
export async function arquivarReceita(
  prescricaoId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  const { data: prescricao } = await supabase
    .from('prescriptions')
    .select('id, clinical_record_id')
    .eq('id', prescricaoId)
    .eq('org_id', ctx.orgId)
    .maybeSingle()

  if (!prescricao) return { error: 'Receita não encontrada' }

  if (prescricao.clinical_record_id) {
    const { data: record } = await supabase
      .from('clinical_records')
      .select('deleted_at')
      .eq('id', prescricao.clinical_record_id)
      .eq('org_id', ctx.orgId)
      .maybeSingle()
    if (record?.deleted_at) return { error: null }

    return arquivarAtendimento(prescricao.clinical_record_id)
  }
  return excluirPrescricao({ prescricaoId })
}

/**
 * Restaura uma receita arquivada — espelha `arquivarReceita` (CA17): vinculada
 * delega para `restaurarAtendimento` (traz ficha+receita de volta); avulsa
 * restaura só a receita (`restaurarPrescricao`, sem cascata — CA18).
 *
 * Mesma defesa de corrida do `arquivarReceita`: se a ficha vinculada já
 * estiver ativa (não arquivada), é no-op bem-sucedido.
 */
export async function restaurarReceita(
  prescricaoId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  const { data: prescricao } = await supabase
    .from('prescriptions')
    .select('id, clinical_record_id')
    .eq('id', prescricaoId)
    .eq('org_id', ctx.orgId)
    .maybeSingle()

  if (!prescricao) return { error: 'Receita não encontrada' }

  if (prescricao.clinical_record_id) {
    const { data: record } = await supabase
      .from('clinical_records')
      .select('deleted_at')
      .eq('id', prescricao.clinical_record_id)
      .eq('org_id', ctx.orgId)
      .maybeSingle()
    if (!record?.deleted_at) return { error: null }

    return restaurarAtendimento(prescricao.clinical_record_id)
  }
  return restaurarPrescricao(prescricaoId)
}

// ─────────────────────────────────────────────────────────────────────────────
// B3 (CA19–CA24): ciclo de vida da receita AVULSA — rascunho → finalizada.
// A receita VINCULADA a ficha nasce finalizada (CA24) e NÃO passa por aqui:
// seu ciclo é o da ficha. Só a avulsa tem rascunho/auto-save/finalização.
// ─────────────────────────────────────────────────────────────────────────────

// Tamanho máximo do JSON de grau do rascunho (defesa em camada / DoS). Mesmo
// mecanismo do auto-save da ficha (salvarFichaClinica), dimensionado para o
// payload bem menor da prescrição (só nova_prescricao, não a ficha inteira).
const MAX_RASCUNHO_BYTES = 50 * 1024

/**
 * Cria uma receita avulsa em RASCUNHO e devolve o id (para a página de
 * preenchimento, B3-S3). A receita nasce vazia — o grau é preenchido depois.
 *
 * Constraint prescriptions_type_record_consistency_check exige que
 * `prescription_type='quick'` ⇔ `clinical_record_id IS NULL`: por isso a receita
 * avulsa É SEMPRE `quick` + sem ficha. Deixar o default ('from_record') violaria
 * a constraint (clinical_record_id nulo).
 *
 * Segurança: org_id vem da sessão (nunca do client); o paciente é validado como
 * pertencente à org (defesa cross-tenant além da RLS de INSERT).
 */
export async function criarRascunhoReceita(
  patientId: string,
): Promise<{ error: string | null; id: string | null }> {
  const parsed = criarRascunhoReceitaSchema.safeParse({ patientId })
  if (!parsed.success) return { error: 'Paciente inválido', id: null }

  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message, id: null }

  // Defesa cross-tenant: o paciente precisa ser da org da sessão. Sem isso, um
  // usuário poderia abrir rascunho apontando para paciente de outra clínica.
  const { data: paciente } = await supabase
    .from('patients')
    .select('id')
    .eq('id', parsed.data.patientId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!paciente) return { error: 'Paciente não encontrado', id: null }

  const { data: inserida, error } = await supabase
    .from('prescriptions')
    .insert({
      org_id: ctx.orgId,
      patient_id: parsed.data.patientId,
      tipo: 'oculos',
      prescription_type: 'quick',
      clinical_record_id: null,
      dados_prescricao: {} as Json,
      status: 'rascunho',
    })
    .select('id')
    .single()

  if (error || !inserida) {
    return { error: mensagemErroAmigavel(error, 'criar rascunho de receita'), id: null }
  }

  revalidatePath('/receitas')
  return { error: null, id: inserida.id }
}

/**
 * Auto-save LENIENTE do rascunho (espelha `salvarFichaClinica`): salva progresso
 * mesmo com valores fora do range esperado — o optometrista preenche aos poucos
 * e não pode perder trabalho por um campo dióptrico inválido no meio.
 *
 * Só age se a linha é um rascunho AVULSO da org da sessão:
 *  - status='rascunho'  → não sobrescreve receita já finalizada por esta rota;
 *  - clinical_record_id IS NULL → esta rota é só da avulsa (a vinculada edita
 *    por `atualizarReceitaRapida`, que reflete na ficha);
 *  - org_id da sessão → isolamento cross-tenant (além da RLS).
 */
export async function salvarRascunhoReceita(
  id: string,
  dados: NovaPrescricao,
): Promise<{ error: string | null }> {
  // Valida o id estritamente (consistência com as demais actions do arquivo).
  const idParsed = rascunhoReceitaIdSchema.safeParse(id)
  if (!idParsed.success) return { error: 'ID inválido' }

  // Leniência: safeParse — se passar, usa parsed.data (normaliza e descarta
  // chaves desconhecidas, defesa contra payload arbitrário via fetch direto);
  // se falhar, mantém o bruto e loga no Sentry para detectar regressão silenciosa.
  const parsedDados = novaPrescricaoSchema.safeParse(dados)
  const dadosValidados = parsedDados.success ? parsedDados.data : dados
  if (!parsedDados.success) {
    Sentry.captureMessage('[salvarRascunhoReceita] schema falhou — salvando dado bruto', {
      level: 'warning',
      tags: { prescricaoId: idParsed.data },
    })
  }

  // Guard de tamanho do JSON (defesa em camada) — mesmo mecanismo da ficha.
  let serialized: string
  try {
    serialized = JSON.stringify(dadosValidados ?? {})
  } catch {
    return { error: 'Dados não serializáveis' }
  }
  if (serialized.length > MAX_RASCUNHO_BYTES) {
    return { error: 'Receita muito grande para salvar.' }
  }

  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  const { data: prescricao } = await supabase
    .from('prescriptions')
    .select('id, status, clinical_record_id')
    .eq('id', idParsed.data)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (
    !prescricao ||
    prescricao.status !== 'rascunho' ||
    prescricao.clinical_record_id !== null
  ) {
    return { error: 'Rascunho de receita não encontrado' }
  }

  const { error } = await supabase
    .from('prescriptions')
    .update({
      dados_prescricao: dadosValidados as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', idParsed.data)
    .eq('org_id', ctx.orgId)
    // Guard de corrida: se finalizou em outra aba entre o SELECT e o UPDATE,
    // não reescreve por cima do estado finalizado.
    .eq('status', 'rascunho')

  if (error) return { error: mensagemErroAmigavel(error, 'salvar rascunho de receita') }

  // Rascunho aparece na lista de receitas como "Em andamento".
  revalidatePath('/receitas')
  return { error: null }
}

/**
 * Finaliza um rascunho de receita avulsa: valida o mínimo (algum dado de grau),
 * seta status='finalizada' + finalizada_em=now.
 *
 * Idempotente (edge case 6 — duplo-clique/corrida): se já está finalizada,
 * devolve sucesso SEM re-executar (não duplica finalizada_em). Não toca em
 * `appointments` (rascunho avulso não tem agendamento).
 */
export async function finalizarReceita(
  id: string,
): Promise<{ error: string | null }> {
  const idParsed = rascunhoReceitaIdSchema.safeParse(id)
  if (!idParsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  const { data: prescricao } = await supabase
    .from('prescriptions')
    .select('id, status, clinical_record_id, dados_prescricao')
    .eq('id', idParsed.data)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!prescricao) return { error: 'Receita não encontrada' }

  // Idempotência: já finalizada → no-op bem-sucedido (guard de duplo-clique).
  if (prescricao.status === 'finalizada') return { error: null }

  // Esta rota finaliza só rascunho AVULSO. Vinculada nasce finalizada (CA24) e
  // não passa por aqui; se chegar uma vinculada em rascunho (estado anômalo),
  // barra — a via correta é a finalização da ficha.
  if (prescricao.clinical_record_id !== null) {
    return { error: 'Receita vinculada a ficha não é finalizada por aqui.' }
  }

  // Validação mínima (CA21 / edge case 5): a receita precisa ter algum dado de
  // grau. Só prescrição — não há queixa/diagnóstico numa receita avulsa. Espelha
  // o critério "tem prescrição" de finalizarAtendimento (ficha/[id]/actions.ts).
  const dados = (prescricao.dados_prescricao ?? {}) as Partial<NovaPrescricao>
  const temPrescricao =
    !!dados.tipo_lente ||
    hasAnyEyeData(dados) ||
    (dados.tratamentos?.length ?? 0) > 0
  if (!temPrescricao) {
    return { error: 'Preencha ao menos um dado de grau antes de finalizar.' }
  }

  const { error } = await supabase
    .from('prescriptions')
    .update({
      status: 'finalizada',
      finalizada_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', idParsed.data)
    .eq('org_id', ctx.orgId)
    // Guard de corrida: só finaliza se ainda é rascunho (evita duplo flip).
    .eq('status', 'rascunho')

  if (error) return { error: mensagemErroAmigavel(error, 'finalizar receita') }

  revalidatePath('/receitas')
  revalidatePath('/pacientes/[id]', 'page')
  return { error: null }
}

// ----- helpers internos -----

// Verifica se os campos de OD/OE têm pelo menos um valor preenchido.
// Duplicado deliberadamente: o mesmo helper já vive (privado, não exportado) em
// `ficha/[id]/actions.ts` e `AtendimentoView.tsx`. Manter o padrão do projeto —
// extrair um util compartilhado agora exigiria mexer nos 2 usos existentes
// (fora do escopo deste bloco backend, com risco de regressão no frontend).
function hasAnyEyeData(p: { od?: unknown; oe?: unknown }): boolean {
  const valores: unknown[] = []
  for (const olho of ['od', 'oe'] as const) {
    const o = (p as Record<string, unknown>)[olho] as Record<string, unknown> | undefined
    if (o) valores.push(...Object.values(o))
  }
  return valores.some((v) => v !== null && v !== undefined && v !== '')
}
