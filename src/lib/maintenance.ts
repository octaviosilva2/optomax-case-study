// Modo manutenção — "fecha a loja" para os usuários enquanto configuramos
// coisas em produção (ex: go-live do billing ASAAS). Plano B ao Password
// Protection da Vercel (indisponível no plano Hobby): bloqueio no próprio app,
// ligado por env var, com BYPASS para o fundador continuar usando/testando.
//
// Liga/desliga trocando a env `MAINTENANCE_MODE` na Vercel (sem redeploy de
// código — só a env var + redeploy do projeto). Reversível na hora.
//
// Quem PASSA pelo bloqueio (continua usando o app normalmente):
//   1. Org com plan === 'admin' (as orgs internas — você).
//   2. Qualquer e-mail listado em `MAINTENANCE_BYPASS_EMAILS` (CSV) — rede de
//      segurança caso a conta de teste não esteja numa org admin (ex: o Caio).
//
// Lido em Server Components (o gate vive no (app)/layout.tsx) — por isso a env
// NÃO precisa do prefixo NEXT_PUBLIC. A mensagem reusa a env já existente do
// MaintenanceBanner (NEXT_PUBLIC_MAINTENANCE_MESSAGE), com fallback.

import { planoEhIlimitado } from '@/lib/utils/status'

/** True quando o modo manutenção está ligado (env `MAINTENANCE_MODE=true`). */
export function modoManutencaoLigado(): boolean {
  return process.env.MAINTENANCE_MODE === 'true'
}

/**
 * Decide se um usuário logado PASSA pelo bloqueio de manutenção.
 * Recebe só o que precisa (plan + email) para ser facilmente testável e não
 * acoplar à forma da sessão.
 */
export function usuarioPassaManutencao(input: {
  plan?: string | null
  email?: string | null
}): boolean {
  // Orgs admin nunca são bloqueadas.
  if (planoEhIlimitado(input.plan)) return true

  // Bypass por e-mail (CSV em env). Comparação case-insensitive.
  const bypassEmails = (process.env.MAINTENANCE_BYPASS_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const email = input.email?.trim().toLowerCase()
  return !!email && bypassEmails.includes(email)
}

/** Mensagem exibida na tela de manutenção (custom via env, com fallback). */
export function mensagemManutencao(): string {
  return (
    process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE ??
    'Estamos fazendo melhorias e voltamos já. Obrigado pela paciência.'
  )
}
