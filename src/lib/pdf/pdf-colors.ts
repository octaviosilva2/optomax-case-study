// Cores hexadecimais derivadas dos tokens oklch V2 do DESIGN.md.
// @react-pdf/renderer nao suporta CSS vars, entao precisamos espelhar como hex.
//
// IMPORTANTE: este arquivo e a UNICA excecao permitida para hex literal no codebase.
// A regra ESLint AST tem allowlist explicita para este arquivo.
//
// Mapeamento oklch -> hex (aproximacao manual, refinado conforme necessario):
// - oklch(0.985 0.005 80) -> #FAF8F5 (background)
// - oklch(0.18 0.01 80)   -> #1A1813 (foreground)
// - oklch(1 0 0)          -> #FFFFFF (card)
// - oklch(0.32 0.12 280)  -> #2E2A6E (primary - indigo profundo)
// - oklch(0.90 0.008 80)  -> #E8E4DE (border)
// - oklch(0.95 0.006 80)  -> #F4F2EE (muted)
// - oklch(0.45 0.01 80)   -> #6B6660 (muted-foreground)
// - oklch(0.55 0.13 160)  -> #1E9E6B (status-ok)
// - oklch(0.70 0.14 75)   -> #C89545 (status-warning)
// - oklch(0.55 0.20 25)   -> #C04040 (status-critical/destructive)
// - oklch(0.55 0.12 230)  -> #4080C0 (status-info)
//
// TODO (Fase 5): refinar conversoes oklch -> hex com ferramenta de precisao.

export const PDF_COLORS = {
  // Base
  background: '#FAF8F5',
  foreground: '#1A1813',
  card: '#FFFFFF',

  // Marca
  primary: '#2E2A6E',           // indigo profundo V2
  primaryLegacy: '#0E7490',     // cyan-700 legado (removido apos migracao completa)
  accent: '#C99D4E',            // dourado da marca (oklch 0.72 0.11 80) — ponto do wordmark OptoMax.

  // Neutros
  border: '#E8E4DE',
  borderSubtle: '#CBD5E1',      // slate-300 legado, ainda usado em algumas bordas de tabela
  muted: '#F4F2EE',
  mutedAlt: '#F1F5F9',          // slate-100 legado
  mutedForeground: '#6B6660',
  mutedForegroundDark: '#475569', // slate-600 legado

  // Status
  statusOk: '#1E9E6B',          // emerald adaptado
  statusWarning: '#C89545',     // amber adaptado
  statusCritical: '#C04040',    // vermelho editorial
  statusInfo: '#4080C0',        // sky adaptado

  // Aliases para legibilidade no codigo
  destructive: '#C04040',

  // Texto em niveis
  text: '#1A1813',
  textSecondary: '#475569',     // slate-600
  textTertiary: '#64748B',      // slate-500
  textQuaternary: '#94A3B8',    // slate-400

  // Titulos (header da clinica + titulos de secao) — navy V2.
  // Migrado do cyan legado #0891B2 para o primary da identidade (modelos de PDF, 29/05).
  headerPrimary: '#2E2A6E',
} as const

// Type helper para autocomplete
export type PdfColorKey = keyof typeof PDF_COLORS
