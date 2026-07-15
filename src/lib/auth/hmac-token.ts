// HMAC tokens para acesso público a prescrições e fichas clínicas.
// Gerados server-side (em uma server action autenticada), validados server-side
// (no endpoint público), distribuídos via WhatsApp/email para o paciente.
// Permitem ao paciente baixar o PDF sem precisar logar no sistema.
//
// Padrão idêntico ao lib/admin-auth.ts (Web Crypto API — Edge-compatível).
// Diferença: este token é colocado em URL (não em cookie) e carrega o id do
// recurso + o `tipo` (prescricao | ficha) assinados, em vez de só uma expiração.
//
// O campo `tipo` foi adicionado em 2026-05-12 (Etapa 11 #32) para evitar
// reuso cruzado: um token emitido para prescrição não passa na verificação do
// endpoint de ficha e vice-versa. Tokens emitidos ANTES dessa mudança ficam
// inválidos (não têm `tipo` no payload) — aceitável porque ainda não houve
// distribuição em produção (Caio começa testes agora).

// Validade padrão dos tokens públicos.
// Reduzido de 30 → 7 dias em 13/05/2026 (Etapa 13 #38) para limitar a janela
// de exposição do link no WhatsApp/email (LGPD + segurança defensiva).
// Caso o paciente perca o prazo, o profissional gera um novo link em segundos.
const VALIDADE_PADRAO_DIAS = 7
const SECRET_VAR = 'PRESCRICAO_PUBLIC_SECRET'

// Tipos de recurso que aceitam token público. Bem fechado de propósito —
// adicionar um novo tipo exige tocar aqui (impede reuso acidental).
type TipoToken = 'prescricao' | 'ficha'

// Lê o segredo do ambiente. Lança se não configurado ou curto demais.
// Rotacionar este segredo invalida todos os tokens existentes (intencional —
// path de revogação em massa em caso de incidente). Mesma env var cobre os
// dois tipos de token (prescrição e ficha) — não duplicar segredo.
function getSecret(): string {
  const secret = process.env[SECRET_VAR]
  if (!secret || secret.length < 32) {
    throw new Error(`${SECRET_VAR} não configurada ou curta demais (>= 32 chars).`)
  }
  return secret
}

// Encode/decode helpers — base64url para tokens seguros em URL.
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

// Comparação de strings em tempo constante para evitar timing attacks
// na verificação da assinatura.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

// ----- Helpers internos compartilhados entre prescrição e ficha -----

// Gera um token assinado a partir de { tipo, id, exp }.
// Centraliza a montagem do payload para garantir que os dois tipos compartilhem
// o mesmo formato e que `tipo` sempre seja gravado.
async function gerarTokenInterno(
  tipo: TipoToken,
  id: string,
  validadeDias: number,
): Promise<string> {
  const secret = getSecret()
  const exp = Date.now() + validadeDias * 24 * 60 * 60 * 1000
  const payload = toBase64Url(
    new TextEncoder().encode(JSON.stringify({ tipo, id, exp })),
  )
  const sig = await hmacSign(payload, secret)
  return `${payload}.${sig}`
}

// Resultado bruto de verificação (sem rotular o id para um tipo específico).
type VerificacaoBruta =
  | { ok: true; tipo: TipoToken; id: string }
  | { ok: false; error: string }

// Verifica assinatura + expiração + formato do payload.
// O chamador é responsável por checar `result.tipo` — assim quem busca um
// token de ficha não aceita acidentalmente um token de prescrição.
async function verificarTokenInterno(token: string): Promise<VerificacaoBruta> {
  try {
    const [payload, sig] = token.split('.')
    if (!payload || !sig) return { ok: false, error: 'Token malformado' }

    const secret = getSecret()
    const expectedSig = await hmacSign(payload, secret)
    if (!timingSafeEqual(sig, expectedSig)) return { ok: false, error: 'Token inválido' }

    const decoded = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload)),
    ) as { tipo?: unknown; id?: unknown; exp?: unknown }

    if (
      typeof decoded.id !== 'string' ||
      decoded.id.length === 0 ||
      typeof decoded.exp !== 'number'
    ) {
      return { ok: false, error: 'Token corrompido' }
    }
    if (decoded.tipo !== 'prescricao' && decoded.tipo !== 'ficha') {
      // Cobre tanto tokens antigos (sem `tipo`) quanto valores inesperados.
      return { ok: false, error: 'Token inválido' }
    }
    if (Date.now() > decoded.exp) return { ok: false, error: 'Token expirado' }

    return { ok: true, tipo: decoded.tipo, id: decoded.id }
  } catch {
    return { ok: false, error: 'Token inválido' }
  }
}

// ----- API pública: prescrição -----

/**
 * Gera token HMAC para acesso público a uma prescrição.
 * Payload assinado: `{ tipo: 'prescricao', id, exp }`.
 * Validade padrão: 7 dias.
 */
export async function gerarTokenPrescricao(
  prescricaoId: string,
  validadeDias = VALIDADE_PADRAO_DIAS,
): Promise<string> {
  return gerarTokenInterno('prescricao', prescricaoId, validadeDias)
}

/**
 * Verifica token de prescrição. Retorna `{ ok: true, prescricaoId }` se válido,
 * `{ ok: false, error }` caso contrário.
 *
 * Validações:
 * - Formato `payload.sig`
 * - Assinatura HMAC bate (timing-safe)
 * - Payload decodificável, contém `id` + `exp` + `tipo`
 * - `tipo === 'prescricao'` (defesa contra token de ficha reaproveitado)
 * - Não expirou
 */
export async function verificarTokenPrescricao(
  token: string,
): Promise<{ ok: true; prescricaoId: string } | { ok: false; error: string }> {
  const r = await verificarTokenInterno(token)
  if (!r.ok) return r
  if (r.tipo !== 'prescricao') return { ok: false, error: 'Token inválido' }
  return { ok: true, prescricaoId: r.id }
}

// ----- API pública: ficha clínica -----

/**
 * Gera token HMAC para acesso público à ficha clínica (PDF do atendimento).
 * Payload assinado: `{ tipo: 'ficha', id, exp }`.
 * Validade padrão: 7 dias.
 *
 * Adicionado na Etapa 11 (2026-05-12). Reusa a mesma env var
 * `PRESCRICAO_PUBLIC_SECRET` que o token de prescrição — não há motivo para
 * segredos separados (mesma fronteira de confiança), e duplicar exigiria
 * reconfigurar Vercel.
 */
export async function gerarTokenFicha(
  recordId: string,
  validadeDias = VALIDADE_PADRAO_DIAS,
): Promise<string> {
  return gerarTokenInterno('ficha', recordId, validadeDias)
}

/**
 * Verifica token de ficha. Retorna `{ ok: true, recordId }` se válido,
 * `{ ok: false, error }` caso contrário.
 *
 * Validações (idênticas a `verificarTokenPrescricao`):
 * - Formato `payload.sig`
 * - Assinatura HMAC bate (timing-safe)
 * - Payload decodificável, contém `id` + `exp` + `tipo`
 * - `tipo === 'ficha'` (defesa contra token de prescrição reaproveitado)
 * - Não expirou
 */
export async function verificarTokenFicha(
  token: string,
): Promise<{ ok: true; recordId: string } | { ok: false; error: string }> {
  const r = await verificarTokenInterno(token)
  if (!r.ok) return r
  if (r.tipo !== 'ficha') return { ok: false, error: 'Token inválido' }
  return { ok: true, recordId: r.id }
}

// ----- Utilitário compartilhado: decodificar expiração -----

/**
 * Extrai apenas o timestamp de expiração (`exp`) do payload do token, SEM
 * validar HMAC. Usado para exibir "expira em DD/MM/YYYY" em UIs onde o token
 * JÁ foi validado por `verificarToken*` antes — economiza um HMAC sign.
 *
 * Retorna `null` se o token estiver malformado ou sem `exp` numérico válido.
 * NÃO usar como substituto de `verificarToken*`: este helper aceita qualquer
 * payload base64url decodificável, independentemente da assinatura.
 *
 * Adicionado na Etapa 13 (13/05/2026) para alimentar a página pública
 * `/p/[token]` (mostra data de expiração) e o retorno das actions
 * `gerarLinkPublico*` (interface ampliada com `expiraEm`).
 */
export function decodificarExpiracao(token: string): Date | null {
  try {
    const [payload] = token.split('.')
    if (!payload) return null
    const json = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload)),
    ) as { exp?: unknown }
    if (typeof json.exp !== 'number' || !Number.isFinite(json.exp)) {
      return null
    }
    return new Date(json.exp)
  } catch {
    return null
  }
}
