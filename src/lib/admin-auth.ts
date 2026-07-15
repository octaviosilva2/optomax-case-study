// Auth do painel /admin via cookie httpOnly assinado.
//
// Modelo: sem usuário no Supabase Auth — apenas (email, senha) globais definidos
// nas env vars ADMIN_EMAIL + ADMIN_PASSWORD, mais um segundo fator TOTP
// (app autenticador) em ADMIN_TOTP_SECRET. O cookie carrega só a expiração,
// assinada com HMAC-SHA256 usando ADMIN_PASSWORD como chave (rotacionar senha
// invalida todos os cookies). Suficiente para uso interno do fundador na fase
// de validação. É 1 usuário — mantivemos o fluxo próprio em vez de migrar para
// Supabase MFA (R6 do plano CTO).
//
// IMPORTANTE: usa Web Crypto API (disponível em Node 20+ e Edge runtime).
//
// Rate limit (F3-C02): substituído o Map<ip, count> in-memory (zerava no cold
// start) pela tabela `admin_login_attempts`. Chave = email_attempted, então
// atacante não consegue burlar rotacionando X-Forwarded-For.

import { cookies } from 'next/headers'
import { TOTP, Secret } from 'otpauth'
import { createAdminClient } from '@/lib/supabase/admin'

const COOKIE_NAME = 'optomax_admin'
const COOKIE_TTL_HOURS = 24
const COOKIE_TTL_MS = COOKIE_TTL_HOURS * 60 * 60 * 1000

const MAX_TENTATIVAS = 5
const JANELA_MS = 15 * 60 * 1000

function getAdminPassword(): string {
  const pwd = process.env.ADMIN_PASSWORD
  if (!pwd || pwd.length < 8) {
    throw new Error('ADMIN_PASSWORD não configurada ou curta demais (>= 8 chars).')
  }
  return pwd
}

function getAdminEmail(): string {
  const email = process.env.ADMIN_EMAIL
  if (!email || !email.includes('@')) {
    throw new Error('ADMIN_EMAIL não configurada ou inválida.')
  }
  return email.trim().toLowerCase()
}

/**
 * Monta o validador TOTP a partir de ADMIN_TOTP_SECRET (segredo base32 do app
 * autenticador). Fallback quando a env está ausente:
 *   - produção → lança erro (falha FECHADA: login admin bloqueado, nunca abre
 *     o /admin sem o segundo fator).
 *   - dev → warn e retorna null (verificação TOTP desligada, pra não trancar o
 *     desenvolvimento local que ainda não cadastrou o segredo).
 * `Secret.fromBase32` lança se o segredo for base32 inválido — também falha fechada.
 */
function getAdminTotpValidator(): TOTP | null {
  const secret = process.env.ADMIN_TOTP_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_TOTP_SECRET não configurada — login admin bloqueado.')
    }
    console.warn(
      '[admin-auth] ADMIN_TOTP_SECRET ausente — verificação TOTP DESLIGADA (apenas dev).',
    )
    return null
  }
  return new TOTP({
    issuer: 'OptoMax',
    label: 'admin',
    algorithm: 'SHA1', // padrão RFC 6238, compatível com Google Authenticator/Authy
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  })
}

/**
 * Verifica se a chave (email) ainda pode tentar — consulta a tabela
 * `admin_login_attempts` e conta falhas na janela de 15min.
 */
async function podeTentar(email: string): Promise<{ ok: boolean; restante: number }> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - JANELA_MS).toISOString()

  const { count } = await admin
    .from('admin_login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('email_attempted', email)
    .eq('success', false)
    .gte('created_at', since)

  const restante = Math.max(0, MAX_TENTATIVAS - (count ?? 0))
  return { ok: (count ?? 0) < MAX_TENTATIVAS, restante }
}

/**
 * Persiste a tentativa de login (sucesso ou falha) pra rate limit + auditoria.
 */
async function registrarTentativa(
  email: string,
  ip: string,
  userAgent: string | null,
  success: boolean,
): Promise<void> {
  const admin = createAdminClient()
  await admin.from('admin_login_attempts').insert({
    email_attempted: email,
    ip,
    user_agent: userAgent,
    success,
  })
}

// Encode/decode helpers — base64url para tokens em cookie.
function toBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return toBase64Url(sig)
}

// Comparação de strings em tempo constante para evitar timing attacks.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

/**
 * Valida (email, senha, código TOTP) e seta o cookie httpOnly assinado.
 * Aplica rate limit por email (5 falhas / 15min via tabela admin_login_attempts).
 * Lança Error se rate limit atingido, credenciais inválidas ou TOTP inválido.
 * O TOTP entra na MESMA verificação folhada (email && senha && totp): a mensagem
 * de erro é genérica e não revela qual fator falhou.
 */
export async function loginAdmin(
  email: string,
  password: string,
  totpCode: string,
  ip: string,
  userAgent: string | null,
): Promise<void> {
  const emailNormalizado = email.trim().toLowerCase()

  // Rate limit: bloqueia ANTES de checar credenciais (atacante nem sabe se a tentativa
  // entrou na contagem ou não, mensagem é a mesma).
  const limit = await podeTentar(emailNormalizado)
  if (!limit.ok) {
    throw new Error('Muitas tentativas. Aguarde 15 minutos.')
  }

  const expectedEmail = getAdminEmail()
  const expectedPassword = getAdminPassword()
  // Em produção sem ADMIN_TOTP_SECRET isto lança (falha fechada) antes de qualquer
  // verificação — o /admin não abre sem o segundo fator configurado.
  const totp = getAdminTotpValidator()

  // Comparação timing-safe pra email e senha (defesa contra timing attacks).
  const emailOk = timingSafeEqual(emailNormalizado, expectedEmail)
  const passwordOk = timingSafeEqual(password, expectedPassword)
  // TOTP: null = dev sem segredo (pula, já avisou no warn). Caso contrário, `validate`
  // devolve o delta da janela (0/±1) se o código bate, ou null se errado/ausente/expirado.
  // window: 1 tolera ±30s de drift de relógio. Código vazio/curto → validate devolve null.
  const totpOk = totp === null ? true : totp.validate({ token: totpCode.trim(), window: 1 }) !== null
  const credenciaisOk = emailOk && passwordOk && totpOk

  // Registra a tentativa (sucesso ou falha) pra auditoria + rate limit.
  await registrarTentativa(emailNormalizado, ip, userAgent, credenciaisOk)

  if (!credenciaisOk) {
    throw new Error('Credenciais inválidas')
  }

  // Sucesso — gera cookie HMAC.
  const exp = Date.now() + COOKIE_TTL_MS
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({ exp })))
  const sig = await hmacSign(payload, expectedPassword)
  const value = `${payload}.${sig}`

  const store = await cookies()
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: COOKIE_TTL_HOURS * 60 * 60,
  })
}

/**
 * Verifica o cookie atual. Retorna true se válido (assinatura ok + não expirado).
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const store = await cookies()
    const cookie = store.get(COOKIE_NAME)
    if (!cookie?.value) return false

    const [payload, sig] = cookie.value.split('.')
    if (!payload || !sig) return false

    const expected = getAdminPassword()
    const expectedSig = await hmacSign(payload, expected)
    if (!timingSafeEqual(sig, expectedSig)) return false

    const decoded = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { exp?: number }
    if (typeof decoded.exp !== 'number') return false
    if (Date.now() > decoded.exp) return false

    return true
  } catch {
    return false
  }
}

/**
 * Limpa o cookie do admin (logout).
 */
export async function logoutAdmin(): Promise<void> {
  const store = await cookies()
  store.delete({ name: COOKIE_NAME, path: '/admin' })
}
