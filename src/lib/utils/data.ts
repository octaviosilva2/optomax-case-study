// Helpers centralizados de formatação e cálculo de data/hora em horário de Brasília.
// Eliminam duplicação entre /admin, agenda, prescrições, perfil do paciente.
//
// Convenção: o banco (Supabase) armazena timestamps SEMPRE em UTC.
// A formatação para exibição usa explicitamente o timezone 'America/Sao_Paulo'
// para garantir comportamento consistente em SSR (Vercel/UTC) e CSR (browser do user).
//
// Datas de nascimento (YYYY-MM-DD sem timezone) são exceção e devem ser formatadas
// com timeZone: 'UTC' no chamador — não usar estes helpers para data_nascimento.

const TZ_BR = 'America/Sao_Paulo'

/**
 * Deriva a data da última consulta finalizada a partir do embedded select de
 * clinical_records: retorna o max(finalizado_em não-null) ou null (nunca atendido).
 * Pura (sem 'use client') — usada tanto no SSR quanto no hook client.
 */
export function ultimaConsultaDe(
  records: { finalizado_em: string | null }[] | null | undefined,
): string | null {
  const datas = (records ?? [])
    .map((r) => r.finalizado_em)
    .filter((d): d is string => !!d)
  if (datas.length === 0) return null
  return datas.reduce((a, b) => (a > b ? a : b))
}

/**
 * Retorna "agora" como Date. Mantido como wrapper de `new Date()` para deixar
 * explícita a intenção semântica nos call-sites. O Date sempre é UTC internamente;
 * qualquer formatação posterior deve usar TZ_BR.
 */
export function agora(): Date {
  return new Date()
}

/**
 * Início do dia em horário de Brasília, retornado como Date UTC equivalente.
 * Útil para queries por intervalo (`gte`) em colunas timestamptz.
 *
 * Ex.: se "agora" é 2026-05-12 23h em Brasília (= 02h UTC do dia 13),
 * retorna 2026-05-12T03:00:00Z (= 00:00 BR do dia 12).
 */
export function inicioDoDiaBR(date: Date = new Date()): Date {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.format(date).split('-') // ['2026', '05', '12']
  const isoLocal = `${parts[0]}-${parts[1]}-${parts[2]}T00:00:00.000-03:00`
  return new Date(isoLocal)
}

/**
 * Fim do dia em horário de Brasília (23:59:59.999), Date UTC equivalente.
 * Útil para queries por intervalo (`lte`/`lt`) em colunas timestamptz.
 */
export function fimDoDiaBR(date: Date = new Date()): Date {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.format(date).split('-')
  const isoLocal = `${parts[0]}-${parts[1]}-${parts[2]}T23:59:59.999-03:00`
  return new Date(isoLocal)
}

/**
 * Formata uma data ISO em texto relativo curto:
 *   "Agora", "5min atrás", "3h atrás", "2d atrás", "DD/MM/AAAA" (>30d).
 * Aceita string ISO ou null. Retorna "Nunca" para null.
 */
export function formatarDataRelativa(iso: string | null): string {
  if (!iso) return 'Nunca'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'

  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Agora'
  if (diffMin < 60) return `${diffMin}min atrás`

  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h atrás`

  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD}d atrás`

  return d.toLocaleDateString('pt-BR', { timeZone: TZ_BR })
}

/**
 * Formata data ISO no formato curto pt-BR: "12 de mai. 2026"
 * Retorna "—" se ISO inválido ou null.
 */
export function formatarDataCurta(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', {
    timeZone: TZ_BR,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Formata data ISO de forma compacta: "12 mai 2026" (sem "de", sem ponto).
 * Ideal para colunas de tabela onde espaço é limitado.
 * Retorna "—" se ISO inválido ou null.
 */
export function formatarDataCompacta(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d
    .toLocaleDateString('pt-BR', {
      timeZone: TZ_BR,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .replace(/\sde\s/g, ' ')
    .replace('.', '')
}

/**
 * Formata data + hora pt-BR: "12/05/2026 14:30" (horário de Brasília).
 */
export function formatarDataHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    timeZone: TZ_BR,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formata só a hora (HH:MM) em horário Brasília. Útil para grades de agenda
 * e indicadores de auto-save.
 */
export function formatarHoraBR(iso: string | Date | null): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('pt-BR', {
    timeZone: TZ_BR,
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formata data por extenso (ex.: "12 de maio de 2026") em horário Brasília.
 * Aceita Date (default: agora) ou string ISO.
 */
export function formatarDataExtensa(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', {
    timeZone: TZ_BR,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Formata o dia da semana em horário Brasília (ex.: "segunda-feira").
 */
export function formatarDiaSemanaBR(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', {
    timeZone: TZ_BR,
    weekday: 'long',
  })
}
