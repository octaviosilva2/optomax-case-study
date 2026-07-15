'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientIp } from '@/lib/server/get-client-ip'
import { TERMS_VERSION } from '@/lib/legal/version'
import { normalizarTelefone } from '@/lib/validations/onboarding'

// Schema do cadastro finalizado. O aceite dos Termos/Política é IMPLÍCITO ao
// clicar em "Criar conta" (padrão de mercado) → sempre `true`. Além do aceite,
// gravamos os dados coletados na própria tela de cadastro:
//   - nome_completo  → profiles.nome_completo
//   - telefone       → organizations.telefone (mesma coluna que o onboarding usava)
// userId NÃO vem do client (F3-C01): usamos `supabase.auth.getUser()` como
// source-of-truth. O trigger handle_new_user já criou profile + organization
// quando esta action roda (signUp do client cria a sessão antes da confirmação).
const finalizarCadastroSchema = z.object({
  nomeCompleto: z.string().trim().min(3, 'Informe seu nome completo.').max(200),
  // Telefone livre aqui (a validação de formato fica no client); só limitamos
  // o tamanho. Pode vir vazio em chamadas diretas — tratamos como null.
  telefone: z.string().trim().max(40).optional().default(''),
})

export async function finalizarCadastro(input: {
  nomeCompleto: string
  telefone: string
}): Promise<{ error: string | null }> {
  const parsed = finalizarCadastroSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  // Sessão obrigatória — userId vem da auth, NUNCA do client (F3-C01).
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Não autenticado.' }
  }

  // Busca org_id usando a sessão do user — RLS cobre.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile?.org_id) {
    return { error: 'Não foi possível concluir o cadastro. Tente novamente.' }
  }

  // Nome do profissional — UPDATE no próprio profile (RLS permite via policy normal).
  const { error: nomeError } = await supabase
    .from('profiles')
    .update({ nome_completo: parsed.data.nomeCompleto })
    .eq('id', user.id)

  if (nomeError) {
    return { error: 'Falha ao salvar seus dados. Tente novamente.' }
  }

  const ip = await getClientIp()
  // Normaliza no server: aceita 47/047/+55 etc. e grava limpo. Vazio/inválido → null
  // (não trava o cadastro — o client já exige um telefone válido).
  const telefone = normalizarTelefone(parsed.data.telefone ?? '')

  // UPDATE via admin client: a policy UPDATE em organizations não cobre todos os
  // campos (accepted_terms_*). O org_id veio do profile do user da sessão — não
  // pode atingir outras orgs. Grava telefone + aceite numa única escrita.
  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('organizations')
    .update({
      telefone,
      accepted_terms_at: new Date().toISOString(),
      accepted_terms_ip: ip,
      accepted_terms_version: TERMS_VERSION,
    })
    .eq('id', profile.org_id)

  if (updateError) {
    return { error: 'Falha ao concluir o cadastro. Tente novamente.' }
  }

  return { error: null }
}
