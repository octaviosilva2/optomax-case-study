'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z, ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertActiveOrg } from '@/lib/auth-guards'
import { logEventServer } from '@/lib/events'
import { mensagemErroAmigavel } from '@/lib/utils/erro'
import {
  salvarClinicaSchema,
  salvarProfissionalSchema,
  salvarOrigemSchema,
  toggleSchema,
  type SalvarClinicaInput,
  type SalvarProfissionalInput,
  type SalvarOrigemInput,
  type ToggleInput,
} from '@/lib/validations/configuracoes'

export async function salvarClinica(input: SalvarClinicaInput): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // Valida e normaliza a entrada antes do UPDATE
  let parsed: SalvarClinicaInput
  try {
    parsed = salvarClinicaSchema.parse(input)
  } catch (err) {
    if (err instanceof ZodError) return { error: 'VALIDACAO_FALHOU' }
    return { error: 'VALIDACAO_FALHOU' }
  }

  // `horario_funcionamento` deixou de ser editado pela UI (agenda livre 00–24h).
  const { error } = await supabase
    .from('organizations')
    .update({
      nome_clinica: parsed.nome_clinica,
      endereco: parsed.endereco || null,
      telefone: parsed.telefone || null,
    })
    .eq('id', ctx.orgId)

  if (error) return { error: mensagemErroAmigavel(error) }
  revalidatePath('/configuracoes')
  revalidatePath('/', 'layout')
  return { error: null }
}

// Salvar profissional SEM intervalo_consulta (removido na refatoracao)
export async function salvarProfissional(input: SalvarProfissionalInput): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // Valida e normaliza a entrada antes do UPDATE
  let parsed: SalvarProfissionalInput
  try {
    parsed = salvarProfissionalSchema.parse(input)
  } catch (err) {
    if (err instanceof ZodError) return { error: 'VALIDACAO_FALHOU' }
    return { error: 'VALIDACAO_FALHOU' }
  }

  // UPDATE sem intervalo_consulta — campo removido
  const { error } = await supabase
    .from('profiles')
    .update({
      nome_completo: parsed.nome_completo,
      cro_cboo: parsed.cro_cboo || null,
      formacoes: parsed.formacoes,
    })
    .eq('id', ctx.userId)

  if (error) return { error: mensagemErroAmigavel(error) }
  revalidatePath('/configuracoes')
  return { error: null }
}

export async function salvarOrigem(input: SalvarOrigemInput): Promise<{ error: string | null; id: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message, id: null }

  // Valida e normaliza a entrada antes do INSERT/UPDATE
  let parsed: SalvarOrigemInput
  try {
    parsed = salvarOrigemSchema.parse(input)
  } catch (err) {
    if (err instanceof ZodError) return { error: 'VALIDACAO_FALHOU', id: null }
    return { error: 'VALIDACAO_FALHOU', id: null }
  }

  if (parsed.id) {
    const { error } = await supabase
      .from('origens_paciente')
      .update({ nome: parsed.nome })
      .eq('id', parsed.id)
      .eq('org_id', ctx.orgId)
    if (error) return { error: mensagemErroAmigavel(error), id: null }
    revalidatePath('/configuracoes')
    return { error: null, id: parsed.id }
  } else {
    // Retorna o id gerado para que o cliente atualize a UI otimisticamente sem refresh
    const { data, error } = await supabase
      .from('origens_paciente')
      .insert({ nome: parsed.nome, org_id: ctx.orgId })
      .select('id')
      .single()
    if (error) return { error: mensagemErroAmigavel(error), id: null }
    revalidatePath('/configuracoes')
    return { error: null, id: data.id }
  }
}

export async function toggleOrigem(id: string, ativo: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // Validação enxuta — UUID + boolean
  let parsed: ToggleInput
  try {
    parsed = toggleSchema.parse({ id, ativo })
  } catch (err) {
    if (err instanceof ZodError) return { error: 'VALIDACAO_FALHOU' }
    return { error: 'VALIDACAO_FALHOU' }
  }

  // Garante que o UPDATE só afeta origem da própria org (defesa em profundidade além da RLS)
  const { error } = await supabase
    .from('origens_paciente')
    .update({ ativo: parsed.ativo })
    .eq('id', parsed.id)
    .eq('org_id', ctx.orgId)

  if (error) return { error: mensagemErroAmigavel(error) }
  revalidatePath('/configuracoes')
  return { error: null }
}

// ── Assinatura digital do profissional ──────────────────────────────────────
// Upload de PNG (data URL base64) para o bucket "signatures" e atualiza
// profiles.signature_url com o path interno. Tamanho máximo 500 KB.

const MAX_SIGNATURE_BYTES = 500 * 1024
const SIGNATURE_DATA_URL_PREFIX = 'data:image/png;base64,'

export async function salvarAssinatura(pngDataUrl: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // Valida formato data URL e decodifica base64 → Buffer
  if (typeof pngDataUrl !== 'string' || !pngDataUrl.startsWith(SIGNATURE_DATA_URL_PREFIX)) {
    return { error: 'Formato inválido. Envie uma imagem PNG.' }
  }
  const base64 = pngDataUrl.slice(SIGNATURE_DATA_URL_PREFIX.length)
  let bytes: Buffer
  try {
    bytes = Buffer.from(base64, 'base64')
  } catch {
    return { error: 'Não foi possível ler a imagem.' }
  }
  if (bytes.length === 0) return { error: 'Imagem vazia.' }
  if (bytes.length > MAX_SIGNATURE_BYTES) {
    return { error: 'Imagem maior que 500 KB. Reduza o tamanho.' }
  }

  // Path por usuário — RLS garante que só o dono lê/escreve
  const path = `${ctx.userId}/signature.png`

  const { error: uploadErr } = await supabase.storage
    .from('signatures')
    .upload(path, bytes, {
      contentType: 'image/png',
      upsert: true,
      cacheControl: '0', // assinatura troca raramente, mas sem cache evita preview velho
    })
  if (uploadErr) return { error: mensagemErroAmigavel(uploadErr) }

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ signature_url: path })
    .eq('id', ctx.userId)
  if (updErr) return { error: mensagemErroAmigavel(updErr) }

  revalidatePath('/configuracoes')
  revalidatePath('/', 'layout') // invalida o banner global
  return { error: null }
}

export async function removerAssinatura(): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  const path = `${ctx.userId}/signature.png`

  // remove() retorna ok mesmo se o arquivo não existir — não tratamos como erro fatal
  const { error: rmErr } = await supabase.storage.from('signatures').remove([path])
  if (rmErr) {
    // log mas não bloqueia: limpa o DB de qualquer forma para não deixar referência órfã
    console.warn('[removerAssinatura] erro ao deletar do storage:', rmErr.message)
  }

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ signature_url: null })
    .eq('id', ctx.userId)
  if (updErr) return { error: mensagemErroAmigavel(updErr) }

  revalidatePath('/configuracoes')
  revalidatePath('/', 'layout')
  return { error: null }
}

// Gera URL assinada temporária para preview da assinatura no painel
// (TTL 1h, suficiente para a sessão e curto o bastante se vazar).
export async function getAssinaturaSignedUrl(): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { url: null, error: ctx.message }

  const path = `${ctx.userId}/signature.png`
  const { data, error } = await supabase.storage
    .from('signatures')
    .createSignedUrl(path, 3600)

  if (error || !data) return { url: null, error: error?.message ?? 'Assinatura não encontrada' }
  return { url: data.signedUrl, error: null }
}

// ── Exclusão de conta (LGPD art. 18 — direito de eliminação) ───────────────
// Fase 8: titular solicita exclusão da própria org.
//   1. Valida sessão + confirmação textual "EXCLUIR"
//   2. Marca timestamps em organizations + plan_status='suspended' (bloqueia acesso imediato)
//   3. Loga evento + redireciona para /conta-excluida
// Hard-delete é processado MANUALMENTE durante a fase de validação — sem cron automatizado.

const exclusaoSchema = z.object({
  // Motivo opcional (max 2000 chars pra não explodir o banco se alguém colar um texto absurdo)
  reason: z.string().max(2000).optional(),
  // Confirmação obrigatória — defense in depth: client já valida, server checa de novo
  confirmacao: z.literal('EXCLUIR', {
    message: 'Digite EXCLUIR exatamente para confirmar.',
  }),
})

export async function solicitarExclusaoConta(
  input: { reason?: string; confirmacao: string },
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  // Valida entrada
  let parsed: z.infer<typeof exclusaoSchema>
  try {
    parsed = exclusaoSchema.parse(input)
  } catch (err) {
    if (err instanceof ZodError) return { error: err.issues[0]?.message ?? 'Dados inválidos.' }
    return { error: 'Dados inválidos.' }
  }

  // Marca timestamps + bloqueia acesso. Usa admin client porque, mesmo com RLS permitindo
  // o user atualizar a própria org, queremos garantir o UPDATE atômico de plan_status.
  const admin = createAdminClient()
  const now = new Date()
  const scheduledFor = new Date(now)
  scheduledFor.setDate(scheduledFor.getDate() + 30)

  const { error: updErr } = await admin
    .from('organizations')
    .update({
      deletion_requested_at: now.toISOString(),
      deletion_scheduled_for: scheduledFor.toISOString(),
      deletion_reason: parsed.reason || null,
      plan_status: 'suspended',
    })
    .eq('id', ctx.orgId)

  if (updErr) {
    console.error('[solicitarExclusaoConta] falha ao registrar exclusão:', updErr)
    return { error: 'Não foi possível processar a exclusão. Tente novamente em alguns minutos.' }
  }

  // Loga evento (fire-and-forget — não bloqueia o fluxo se falhar)
  await logEventServer(admin, {
    userId: ctx.userId,
    orgId: ctx.orgId,
    eventName: 'account_deletion_requested',
    payload: { reason: parsed.reason ?? null },
  })

  // Desloga o usuário — a próxima navegação já não terá sessão.
  await supabase.auth.signOut()

  // Revalida o layout pra invalidar qualquer cache de sessão e redireciona.
  revalidatePath('/', 'layout')
  redirect('/conta-excluida')
}
