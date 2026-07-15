'use server'

import { z, ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertActiveOrg } from '@/lib/auth-guards'
import { normalizarTelefone } from '@/lib/validations/onboarding'

// Actions dos modais que substituíram o wizard /onboarding.
//
// São DOIS modais:
//  1. ModalDadosEssenciais → nome completo (profile) + telefone (org).
//     OBRIGATÓRIO, e só aparece para contas antigas que ficaram sem esses dados
//     (quem se cadastra agora já informa ambos na tela de cadastro). Não mexe
//     em `onboarded` — é apenas o contato essencial.
//  2. ModalCompletarPerfil → nome da clínica, CRB (cro_cboo) e formações.
//     OPCIONAL ("deixar para depois"); marca `onboarded = true`. NÃO toca em
//     telefone/endereço da org (o telefone já foi gravado e seria apagado).

const dadosEssenciaisSchema = z.object({
  nome_completo: z.string().trim().min(3, 'Informe seu nome completo.').max(200),
  // Normaliza no server (defense-in-depth): aceita 47/047/+55 etc. e grava limpo.
  telefone: z.string().max(40).transform((v, ctx) => {
    const norm = normalizarTelefone(v)
    if (!norm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Telefone inválido.' })
      return z.NEVER
    }
    return norm
  }),
})

export type DadosEssenciaisInput = z.input<typeof dadosEssenciaisSchema>

/**
 * Grava nome completo (profile) + telefone (org) das contas antigas que ficaram
 * sem esses dados. NÃO altera `onboarded` — o modal de perfil clínico continua
 * podendo aparecer depois.
 */
export async function salvarDadosEssenciais(input: DadosEssenciaisInput): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  let parsed: z.output<typeof dadosEssenciaisSchema>
  try {
    parsed = dadosEssenciaisSchema.parse(input)
  } catch (err) {
    if (err instanceof ZodError) return { error: 'VALIDACAO_FALHOU' }
    return { error: 'VALIDACAO_FALHOU' }
  }

  const { error: nomeError } = await supabase
    .from('profiles')
    .update({ nome_completo: parsed.nome_completo })
    .eq('id', ctx.userId)
  if (nomeError) return { error: nomeError.message }

  const { error: telError } = await supabase
    .from('organizations')
    .update({ telefone: parsed.telefone })
    .eq('id', ctx.orgId)
  if (telError) return { error: telError.message }

  return { error: null }
}

const perfilInicialSchema = z.object({
  // Vazio é permitido (a pessoa pode salvar parcialmente) — só validamos
  // tamanho quando há conteúdo.
  nome_clinica: z.string().trim().max(120).optional().default(''),
  cro_cboo: z.string().trim().max(50).optional().default(''),
  formacoes: z.array(z.string().trim().max(200)).max(10).default([]),
})

export type PerfilInicialInput = z.input<typeof perfilInicialSchema>

/**
 * Salva os dados do modal de perfil e marca `onboarded = true` para que o modal
 * não reapareça. Atualiza o nome da clínica apenas se preenchido (não zera o
 * default). cro_cboo/formacoes sempre são gravados no profile.
 */
export async function salvarPerfilInicial(input: PerfilInicialInput): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  let parsed: z.output<typeof perfilInicialSchema>
  try {
    parsed = perfilInicialSchema.parse(input)
  } catch (err) {
    if (err instanceof ZodError) return { error: 'VALIDACAO_FALHOU' }
    return { error: 'VALIDACAO_FALHOU' }
  }

  // Nome da clínica — só atualiza se a pessoa digitou algo (preserva o default
  // e não apaga um nome já existente com um envio vazio).
  if (parsed.nome_clinica) {
    const { error: orgError } = await supabase
      .from('organizations')
      .update({ nome_clinica: parsed.nome_clinica })
      .eq('id', ctx.orgId)
    if (orgError) return { error: orgError.message }
  }

  // Dados do profissional + marca onboarded numa única escrita.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      cro_cboo: parsed.cro_cboo || null,
      formacoes: parsed.formacoes,
      onboarded: true,
    })
    .eq('id', ctx.userId)

  if (profileError) return { error: profileError.message }
  return { error: null }
}

/**
 * "Deixar para depois": apenas marca `onboarded = true` para o modal não voltar
 * a aparecer. A pessoa pode completar o perfil depois em Configurações.
 */
export async function dispensarOnboarding(): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) return { error: ctx.message }

  const { error } = await supabase
    .from('profiles')
    .update({ onboarded: true })
    .eq('id', ctx.userId)

  if (error) {
    console.error('[dispensarOnboarding] falha ao marcar onboarded:', error)
    return { error: error.message }
  }
  return { error: null }
}
