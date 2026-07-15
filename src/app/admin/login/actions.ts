'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { loginAdmin } from '@/lib/admin-auth'

/**
 * Server Action do form de login do /admin.
 * - Valida (email, senha, código TOTP) contra ADMIN_EMAIL + ADMIN_PASSWORD +
 *   ADMIN_TOTP_SECRET da env.
 * - Aplica rate limit por email via tabela admin_login_attempts (F3-C02).
 * - Em sucesso: seta cookie e redireciona para /admin.
 * - Em falha: retorna mensagem genérica (não distingue email/senha/código errados).
 */
export async function loginAdminAction(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email = (formData.get('email') ?? '').toString().trim().toLowerCase()
  const password = (formData.get('password') ?? '').toString()
  // Código do app autenticador (6 dígitos). Só dígitos — remove espaços que alguns
  // apps inserem no meio ("123 456"). A validação do valor fica no loginAdmin.
  const totp = (formData.get('totp') ?? '').toString().replace(/\s/g, '')

  if (!email || !email.includes('@')) {
    return { error: 'Email inválido.' }
  }
  if (!password) {
    return { error: 'Digite a senha.' }
  }

  // Extrai IP + UA pra auditar a tentativa (mesmo que IP nao seja mais a chave do rate limit).
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const userAgent = headersList.get('user-agent')

  try {
    await loginAdmin(email, password, totp, ip, userAgent)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Falha ao autenticar.' }
  }

  redirect('/admin')
}
