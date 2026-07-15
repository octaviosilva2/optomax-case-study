// Formatadores de texto compartilhados pelos PDFs (receita + ficha).
// Centralizados para evitar divergência de rótulos entre os documentos.

export function capitalizar(s: string | null | undefined): string {
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Mapeamento de tratamento → rótulo amigável (cobre IDs atuais da UI + legados).
const ROTULOS_TRATAMENTO: Record<string, string> = {
  antirreflexo: 'Antirreflexo',
  fotossensivel: 'Fotossensível',
  fotossensível: 'Fotossensível',
  bluelight: 'Filtro de luz azul',
  filtro_azul: 'Filtro de luz azul',
  blue_filter: 'Filtro de luz azul',
  hidrofobico: 'Hidrofóbico',
  hidrofóbico: 'Hidrofóbico',
  endurecido: 'Endurecido',
  uv: 'Proteção UV',
}

export function formatarTratamento(t: string): string {
  const k = t.toLowerCase().trim()
  if (ROTULOS_TRATAMENTO[k]) return ROTULOS_TRATAMENTO[k]
  // fallback gentil — troca underscores por espaço e capitaliza
  return capitalizar(t.replace(/_/g, ' '))
}
