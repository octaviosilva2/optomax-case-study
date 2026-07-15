// Validação de deep-link `?next` (funil ASAAS — Fase 3).
//
// O `next` chega da URL (não-confiável). Só aceitamos um CAMINHO INTERNO para
// não virar open-redirect: precisa começar com uma única "/" e NÃO com "//"
// (que o browser interpreta como URL protocol-relative, ex.: //evil.com).
// Também barramos "/\" (variação que alguns browsers normalizam para "//").
//
// Retorna o caminho seguro ou `null` (cabe ao chamador cair no fallback, ex.: /dashboard).
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null
  // Precisa ser caminho absoluto interno: "/algo". Rejeita "//x", "/\x" e qualquer
  // coisa que não comece com "/".
  if (!/^\/(?![/\\])/.test(value)) return null
  return value
}
