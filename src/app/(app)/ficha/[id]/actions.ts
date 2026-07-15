'use server'

import { createClient } from '@/lib/supabase/server'
import type { FichaClinica } from '@/types/clinical'
import type { Json, TablesUpdate } from '@/types/database'
import { logEventServer } from '@/lib/events'
import { assertActiveOrg } from '@/lib/auth-guards'
import { mensagemErroAmigavel } from '@/lib/utils/erro'
import {
  gerarTokenPrescricao,
  gerarTokenFicha,
  decodificarExpiracao,
} from '@/lib/auth/hmac-token'
import { revalidatePath } from 'next/cache'
import { fichaClinicaSchema } from '@/lib/validations/clinical'
import * as Sentry from '@sentry/nextjs'

// `warning` representa falha não-crítica — a operação principal foi gravada
// com sucesso, mas algum efeito colateral (ex.: regeneração do snapshot de
// prescription) não rodou. UI deve exibir como aviso, não como erro.
type ActionResult = { error: string | null; warning?: string | null }

// Retorno das actions `gerarLinkPublico*`.
// Etapa 13 #38 (13/05/2026): adicionado `expiraEm` para que a UI mostre
// "Este link expira em DD/MM/YYYY" no WhatsApp sem precisar decodificar o
// token no client. Discriminated union garante que sucesso traz Date e falha
// traz string de erro — TS força o caller a checar `error` antes de usar.
type GerarLinkResult =
  | { token: string; expiraEm: Date; error: null }
  | { token: null; expiraEm: null; error: string }

// Verificação 3 camadas (auth + profile + org ativa) + retorna org_id e record para reuso
async function verificarAcessoRecord(recordId: string) {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) {
    return { error: ctx.message, supabase, user: null, ctx: null, record: null } as const
  }

  const { data: record } = await supabase
    .from('clinical_records')
    .select('id, org_id, patient_id, status, editado, appointment_id')
    .eq('id', recordId)
    .eq('org_id', ctx.orgId)
    .single()
  if (!record) {
    return { error: 'Ficha não encontrada', supabase, user: null, ctx, record: null } as const
  }

  return { error: null, supabase, ctx, user: { id: ctx.userId }, record } as const
}

// Tamanho máximo do JSONB da ficha (proteção contra payload massivo / DoS).
// 200KB cobre folgadamente todos os campos preenchidos com observações longas.
const MAX_FICHA_BYTES = 200 * 1024

/**
 * Salva (auto-save) o JSONB da ficha clínica.
 *
 * Filosofia de validação:
 * - Auto-save é LENIENTE: salva trabalho em progresso mesmo com valores
 *   fora do range esperado. Optometrista preenche aos poucos e não pode
 *   perder tudo por causa de um campo inválido.
 * - Validação rigorosa só na finalização (`finalizarAtendimento`).
 * - O cliente roda Zod localmente para mostrar avisos visuais (⚠️) sem
 *   bloquear o save.
 *
 * Proteções server-side mantidas:
 * - Tamanho máximo do JSON (DoS guard)
 * - Verificação de acesso (auth + org_id + record pertence à org)
 *
 * Se o record já está finalizado, marca editado=true + editado_em + last_edited_by.
 */
export async function salvarFichaClinica(
  recordId: string,
  clinicalData: FichaClinica,
): Promise<ActionResult> {
  // F4-A01: roda fichaClinicaSchema.safeParse server-side. Filosofia lenient
  // mantida — drafts inválidos podem ser salvos durante edição, mas:
  //  - se passar, usa parsed.data (descarta campos desconhecidos e normaliza
  //    defaults — defesa contra payloads arbitrários via fetch direto);
  //  - se falhar, mantém clinicalData original e loga no Sentry pra detectar
  //    regressões silenciosas. Sentry sanitiza CPF/email/etc (F2-A01).
  const parsed = fichaClinicaSchema.safeParse(clinicalData)
  const dataValidada: FichaClinica = parsed.success
    ? (parsed.data as unknown as FichaClinica)
    : clinicalData

  if (!parsed.success) {
    Sentry.captureMessage('[salvarFichaClinica] schema falhou — salvando dado bruto', {
      level: 'warning',
      tags: { recordId },
    })
  }

  // Proteção mínima: limite de tamanho do payload (defesa em camada)
  let serialized: string
  try {
    serialized = JSON.stringify(dataValidada ?? {})
  } catch {
    return { error: 'Dados não serializáveis' }
  }
  if (serialized.length > MAX_FICHA_BYTES) {
    return { error: 'Ficha muito grande para salvar.' }
  }

  const acesso = await verificarAcessoRecord(recordId)
  if (acesso.error) return { error: acesso.error }
  const { supabase, user, record } = acesso

  // F5-A05: bloqueio server-side de UPDATE em ficha finalizada sem reabrir.
  // A UI desabilita inputs quando status='finalizado' && !editado, mas
  // chamada direta da server action (via DevTools/script) bypassaria sem
  // este guard. `reabrirParaEdicao` é o único caminho legítimo que seta
  // editado=true ANTES de liberar a edição.
  if (record!.status === 'finalizado' && !record!.editado) {
    return { error: 'Ficha finalizada. Reabra para edição antes de salvar.' }
  }

  const update: TablesUpdate<'clinical_records'> = {
    clinical_data: dataValidada as unknown as Json,
    updated_at: new Date().toISOString(),
  }

  // Se está finalizada (e já foi reaberta — checado acima), mantém o flag
  // e atualiza metadados de quem editou e quando.
  if (record!.status === 'finalizado') {
    update.editado = true
    update.editado_em = new Date().toISOString()
    update.last_edited_by = user!.id
  }

  const { error } = await supabase
    .from('clinical_records')
    .update(update)
    .eq('id', recordId)
    .eq('org_id', record!.org_id)

  if (error) return { error: mensagemErroAmigavel(error) }

  // Regeneração automática do snapshot de prescription:
  // se o record já está finalizado, mantemos a linha em `prescriptions`
  // sincronizada com a versão mais recente — garantindo que o próximo download
  // do PDF reflita a edição. Atômico via UPSERT (ON CONFLICT).
  //
  // Falha aqui NÃO bloqueia o auto-save — os dados clínicos já foram gravados.
  // Mas reportamos como warning para o usuário saber que o PDF pode estar
  // desatualizado (ex.: violação temporária de RLS, indisponibilidade).
  let warning: string | null = null
  if (record!.status === 'finalizado') {
    const erroSnap = await upsertPrescricaoSnapshot(
      supabase,
      recordId,
      record!.org_id,
      record!.patient_id,
      dataValidada.nova_prescricao,
    )
    if (erroSnap) {
      console.error('[prescricao snapshot] falha ao regenerar:', erroSnap)
      warning = 'O PDF da prescrição pode estar desatualizado.'
    }
  }

  return { error: null, warning }
}

/**
 * Finaliza o atendimento.
 * - Revalida o conteúdo no servidor (impede finalização de ficha vazia).
 * - status=finalizado, finalizado_em=now()
 * - Cria snapshot em prescriptions se houver nova_prescricao com algum valor.
 * - Atualiza appointments.status=concluido se houver appointment_id.
 * - Dashboard V2 FASE F: grava retorno_previsto_em se fornecido.
 *
 * @param recordId - ID do clinical_record
 * @param retornoEm - Data do retorno previsto (ISO string YYYY-MM-DD) ou null
 */
export async function finalizarAtendimento(
  recordId: string,
  retornoEm?: string | null,
): Promise<ActionResult> {
  const acesso = await verificarAcessoRecord(recordId)
  if (acesso.error) return { error: acesso.error }
  const { supabase, user, record } = acesso

  // Lê o clinical_data atual (já gravado pelo último auto-save) para criar
  // o snapshot e revalidar conteúdo mínimo no servidor
  const { data: full } = await supabase
    .from('clinical_records')
    .select('clinical_data, appointment_id, status')
    .eq('id', recordId)
    .single()
  if (!full) return { error: 'Ficha não encontrada' }

  // Bloqueia tentativa de re-finalizar uma ficha já finalizada
  if (full.status === 'finalizado') {
    return { error: 'Ficha já está finalizada.' }
  }

  const dados = (full.clinical_data ?? {}) as FichaClinica

  // Validação mínima server-side (espelha podeFinalizar do client).
  // Critério: pelo menos um de queixa principal, prescrição ou diagnóstico
  // (este último permite finalizar fichas puramente diagnósticas no modelo Completo).
  const queixa = dados.anamnese?.queixa_principal?.trim()
  const novaPresc = dados.nova_prescricao
  const temPrescricao =
    !!novaPresc &&
    (!!novaPresc.tipo_lente ||
      hasAnyEyeData(novaPresc) ||
      (novaPresc.tratamentos?.length ?? 0) > 0)
  const temDiagnostico = !!dados.diagnostico?.hipoteses?.trim()
  if (!queixa && !temPrescricao && !temDiagnostico) {
    return {
      error: 'Preencha a queixa principal, uma prescrição ou um diagnóstico antes de finalizar.',
    }
  }

  // Snapshot de prescrição (apenas se preenchida).
  // Helper compartilhado com salvarFichaClinica — garante que a finalização
  // inicial e edições posteriores produzam linhas equivalentes.
  if (temPrescricao) {
    const erroSnap = await upsertPrescricaoSnapshot(
      supabase,
      recordId,
      record!.org_id,
      record!.patient_id,
      novaPresc,
    )
    if (erroSnap) return { error: 'Falha ao gerar prescrição: ' + erroSnap }
  }

  // Marca finalizado.
  // finalizado_por: registra quem é o profissional responsável legal pela
  // prescrição. Diferente de last_edited_by (que reflete a última edição),
  // este campo é imutável após a finalização — assistente que reabrir e
  // ajustar uma observação não troca o autor do PDF.
  //
  // Dashboard V2 FASE F: retorno_previsto_em é gravado se fornecido.
  // Aceita string ISO YYYY-MM-DD; validação básica server-side.
  let retornoPrevisto: string | null = null
  if (retornoEm) {
    // Valida formato básico (YYYY-MM-DD)
    const regex = /^\d{4}-\d{2}-\d{2}$/
    if (regex.test(retornoEm)) {
      const parsed = new Date(retornoEm + 'T00:00:00')
      if (!isNaN(parsed.getTime())) {
        retornoPrevisto = retornoEm
      }
    }
  }

  const { error: errFin } = await supabase
    .from('clinical_records')
    .update({
      status: 'finalizado',
      finalizado_em: new Date().toISOString(),
      finalizado_por: user!.id,
      retorno_previsto_em: retornoPrevisto,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
    .eq('org_id', record!.org_id)

  if (errFin) return { error: mensagemErroAmigavel(errFin) }

  // Evento: ficha finalizada (não-bloqueante — usado pelo painel /admin)
  await logEventServer(supabase, {
    userId: user!.id,
    orgId: record!.org_id,
    eventName: 'clinical_record_completed',
    payload: {
      record_id: recordId,
      record_type: record!.status === 'finalizado' ? 'edicao' : 'finalizacao',
    },
  })

  // F5-A02: marca appointment como concluído apenas a partir de estados
  // válidos. Antes, UPDATE incondicional reverteria 'cancelado'/'faltou'
  // caso o appointment tivesse sido mudado em paralelo (outra aba). Filtro
  // .in('status', [...]) torna o UPDATE no-op se o estado já não permite
  // mais a transição (terminais 'cancelado'/'faltou'/'concluido' protegidos).
  if (full.appointment_id) {
    await supabase
      .from('appointments')
      .update({ status: 'concluido', updated_at: new Date().toISOString() })
      .eq('id', full.appointment_id)
      .eq('org_id', record!.org_id)
      .in('status', ['agendado', 'confirmado', 'em_andamento'])
  }

  revalidatePath('/agenda')
  revalidatePath(`/ficha/${recordId}`)
  return { error: null }
}

/**
 * Reabre uma ficha finalizada para edição.
 * Marca editado=true + editado_em + last_edited_by já no servidor — assim a
 * intenção de edição persiste em caso de refresh, e o auto-save subsequente
 * não fica bloqueado pela checagem `status==='finalizado' && !editado`.
 *
 * O status permanece 'finalizado' (a ficha continua visível como concluída
 * no histórico); apenas a flag editado=true sinaliza que houve mudança após
 * a finalização.
 */
export async function reabrirParaEdicao(
  recordId: string,
): Promise<ActionResult> {
  const acesso = await verificarAcessoRecord(recordId)
  if (acesso.error) return { error: acesso.error }
  const { supabase, user, record } = acesso

  if (record!.status !== 'finalizado') {
    // Já está em edição — no-op idempotente
    return { error: null }
  }

  const { error } = await supabase
    .from('clinical_records')
    .update({
      editado: true,
      editado_em: new Date().toISOString(),
      last_edited_by: user!.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
    .eq('org_id', record!.org_id)

  if (error) return { error: mensagemErroAmigavel(error) }

  revalidatePath(`/ficha/${recordId}`)
  return { error: null }
}

/**
 * Troca o modelo da ficha (resumido ↔ completo).
 * - Bloqueado se a ficha estiver finalizada e não-editada (precisa reabrir antes).
 * - Não apaga clinical_data: dados de seções exclusivas do Completo permanecem
 *   no JSONB mesmo se o usuário voltar para Resumido (preserva trabalho).
 */
export async function trocarModelo(
  recordId: string,
  novoModelo: 'resumido' | 'completo',
): Promise<ActionResult> {
  if (novoModelo !== 'resumido' && novoModelo !== 'completo') {
    return { error: 'Modelo inválido.' }
  }

  const acesso = await verificarAcessoRecord(recordId)
  if (acesso.error) return { error: acesso.error }
  const { supabase, record } = acesso

  // Bloqueia troca em ficha finalizada (precisa reabrir primeiro)
  if (record!.status === 'finalizado' && !record!.editado) {
    return { error: 'Reabra a ficha para edição antes de trocar o modelo.' }
  }

  const { error } = await supabase
    .from('clinical_records')
    .update({
      modelo: novoModelo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
    .eq('org_id', record!.org_id)

  if (error) return { error: mensagemErroAmigavel(error) }

  revalidatePath(`/ficha/${recordId}`)
  return { error: null }
}

/**
 * Gera um token HMAC para acesso público (sem login) ao PDF de uma prescrição.
 * O token é entregue ao paciente via WhatsApp/email — abre a página pública
 * `/p/{token}` que oferece visualizar/baixar o PDF via endpoint
 * `/api/prescricao/publico/{token}`.
 *
 * Defesa cross-tenant: valida que a prescrição pertence à org do usuário
 * logado ANTES de gerar o token. Sem essa checagem, qualquer usuário poderia
 * gerar links válidos para prescrições de outras clínicas.
 *
 * Validade: 7 dias (definida em lib/auth/hmac-token.ts).
 *
 * Etapa 13 #38 (13/05/2026): retorno passou a incluir `expiraEm` (Date) para
 * que a UI inclua a data exata na mensagem do WhatsApp sem decodificar token.
 */
export async function gerarLinkPublicoPrescricao(
  prescricaoId: string,
): Promise<GerarLinkResult> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { token: null, expiraEm: null, error: ctx.message }

  const { data } = await supabase
    .from('prescriptions')
    .select('id')
    .eq('id', prescricaoId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!data) {
    return { token: null, expiraEm: null, error: 'Prescrição não encontrada' }
  }

  try {
    const token = await gerarTokenPrescricao(prescricaoId)
    const expiraEm = decodificarExpiracao(token)
    if (!expiraEm) {
      // Não deve acontecer (token recém-gerado é válido), mas defesa em
      // profundidade: a interface promete `expiraEm: Date` no sucesso.
      console.error('[gerarLinkPublicoPrescricao] token gerado sem exp válido')
      return { token: null, expiraEm: null, error: 'Falha ao gerar link público' }
    }
    return { token, expiraEm, error: null }
  } catch (e) {
    console.error('[gerarLinkPublicoPrescricao] falha ao assinar token:', e)
    return { token: null, expiraEm: null, error: 'Falha ao gerar link público' }
  }
}

/**
 * Gera um token HMAC para acesso público (sem login) ao PDF da ficha clínica.
 * O token é entregue ao paciente via WhatsApp/email — abre a página pública
 * `/f/{token}` que oferece visualizar/baixar o PDF via endpoint
 * `/api/ficha/publico/{token}`.
 *
 * Defesa cross-tenant: valida que o `clinical_record` pertence à org do
 * usuário logado ANTES de gerar o token. Sem essa checagem, qualquer usuário
 * poderia gerar links válidos para fichas de outras clínicas.
 *
 * Defesa de tipo: o token gerado tem `tipo: 'ficha'` no payload — não passa
 * pelo verificador do endpoint de prescrição e vice-versa
 * (`lib/auth/hmac-token.ts`).
 *
 * Validade: 7 dias (definida em lib/auth/hmac-token.ts).
 *
 * Etapa 13 #38 (13/05/2026): retorno passou a incluir `expiraEm` (Date).
 */
export async function gerarLinkPublicoFicha(
  recordId: string,
): Promise<GerarLinkResult> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { token: null, expiraEm: null, error: ctx.message }

  // Confirma que o record existe, pertence à org do usuário logado e NÃO está
  // arquivado — não geramos link público para ficha arquivada (prontuário
  // descartado não deve ficar acessível por token de 7 dias).
  const { data } = await supabase
    .from('clinical_records')
    .select('id')
    .eq('id', recordId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!data) {
    return { token: null, expiraEm: null, error: 'Ficha não encontrada' }
  }

  try {
    const token = await gerarTokenFicha(recordId)
    const expiraEm = decodificarExpiracao(token)
    if (!expiraEm) {
      console.error('[gerarLinkPublicoFicha] token gerado sem exp válido')
      return { token: null, expiraEm: null, error: 'Falha ao gerar link público' }
    }
    return { token, expiraEm, error: null }
  } catch (e) {
    console.error('[gerarLinkPublicoFicha] falha ao assinar token:', e)
    return { token: null, expiraEm: null, error: 'Falha ao gerar link público' }
  }
}

/**
 * Atualiza o título (nome/rótulo) da ficha de atendimento.
 * O título é armazenado em `appointments.titulo` — a ficha (clinical_record)
 * referencia o appointment via `appointment_id`.
 *
 * Regras:
 * - Só atualiza se a ficha estiver em andamento OU reaberta para edição
 *   (mesmo critério de edição dos demais campos).
 * - Ficha sem appointment vinculado (walk-in direto) retorna erro — o título
 *   precisa de um appointment para ser persistido.
 * - Título vazio string é normalizado para null (limpa o campo).
 */
export async function atualizarTituloFicha(
  recordId: string,
  titulo: string | null,
): Promise<ActionResult> {
  const acesso = await verificarAcessoRecord(recordId)
  if (acesso.error) return { error: acesso.error }
  const { supabase, record } = acesso

  // Bloqueia edição em ficha finalizada não-reaberta (mesmo critério do auto-save)
  if (record!.status === 'finalizado' && !record!.editado) {
    return { error: 'Ficha finalizada. Reabra para edição antes de alterar o título.' }
  }

  // Ficha precisa ter appointment vinculado para persistir o título
  if (!record!.appointment_id) {
    return { error: 'Esta ficha não possui agendamento vinculado.' }
  }

  // Normaliza: string vazia → null (limpa o campo); trunca em 120 (defesa
  // server-side contra título acima do limite do input).
  const tituloNormalizado = titulo?.trim().slice(0, 120) || null

  const { error } = await supabase
    .from('appointments')
    .update({
      titulo: tituloNormalizado,
      updated_at: new Date().toISOString(),
    })
    .eq('id', record!.appointment_id)
    .eq('org_id', record!.org_id)

  if (error) return { error: mensagemErroAmigavel(error) }

  revalidatePath(`/ficha/${recordId}`)
  revalidatePath('/ficha') // Central de atendimentos também mostra o título
  return { error: null }
}

// ----- helpers internos -----

// Verifica se os campos de OD/OE têm pelo menos um valor preenchido
function hasAnyEyeData(p: { od?: unknown; oe?: unknown }): boolean {
  const valores: unknown[] = []
  for (const olho of ['od', 'oe'] as const) {
    const o = (p as Record<string, unknown>)[olho] as Record<string, unknown> | undefined
    if (o) valores.push(...Object.values(o))
  }
  return valores.some((v) => v !== null && v !== undefined && v !== '')
}

// Tipo mínimo do client Supabase usado pelos helpers — evita acoplar com
// import circular do tipo Database completo aqui.
type SupabaseLike = Awaited<ReturnType<typeof createClient>>

/**
 * Mantém a linha em `prescriptions` sincronizada com `nova_prescricao` do record.
 * Atômico via Postgres UPSERT (ON CONFLICT) — evita race condition TOCTOU
 * que existia no fluxo SELECT→INSERT/UPDATE anterior.
 *
 * Pré-requisito: UNIQUE INDEX em prescriptions(clinical_record_id, tipo)
 * (migration 20260427_prescriptions_indexes.sql).
 *
 * Retorna mensagem de erro string ou `null` em sucesso.
 *
 * NÃO deleta a linha quando o usuário esvazia a prescrição: em edição
 * pós-finalização, manter o snapshot anterior é mais seguro do que descartá-lo.
 */
async function upsertPrescricaoSnapshot(
  supabase: SupabaseLike,
  recordId: string,
  orgId: string,
  patientId: string,
  novaPrescricao: unknown,
): Promise<string | null> {
  const presc = novaPrescricao as
    | {
        od?: unknown
        oe?: unknown
        tipo_lente?: string | null
        tratamentos?: string[]
      }
    | undefined

  // Mesma checagem de "tem prescrição" usada na finalização.
  const temDados =
    !!presc &&
    (!!presc.tipo_lente ||
      hasAnyEyeData(presc) ||
      (presc.tratamentos?.length ?? 0) > 0)
  if (!temDados) return null

  // No-op: auto-save dispara a cada 2s; se o usuário só editou seções fora
  // de nova_prescricao (anamnese, observações, etc.), o snapshot já está
  // correto — evitamos UPDATE redundante no Postgres + invalidações de
  // queryKey ['prescricoes'] em outras telas.
  //
  // Comparação por JSON.stringify: ambos os lados vêm do schema Zod, que
  // normaliza ordem das chaves; é estável o suficiente para esse caso.
  // Em caso de falha do SELECT (RLS, timeout), seguimos com o UPSERT —
  // melhor reescrever que arriscar PDF stale.
  const { data: atual } = await supabase
    .from('prescriptions')
    .select('dados_prescricao')
    .eq('clinical_record_id', recordId)
    .eq('tipo', 'oculos')
    .eq('org_id', orgId)
    .maybeSingle()

  if (atual && JSON.stringify(atual.dados_prescricao) === JSON.stringify(presc)) {
    return null
  }

  const { error } = await supabase
    .from('prescriptions')
    .upsert(
      {
        org_id: orgId,
        patient_id: patientId,
        clinical_record_id: recordId,
        tipo: 'oculos',
        dados_prescricao: presc as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'clinical_record_id,tipo' },
    )

  return error?.message ?? null
}
