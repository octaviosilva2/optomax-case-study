// Formatação de grau/dioptria para os PDFs clínicos (receita + ficha).
// Reusa formatarDioptria() de utils/grau.ts — a MESMA função das listas, cards
// e Evolução do grau — garantindo formato idêntico em todo o produto.
//
// O campo é texto livre (Etapa 6 #27): pode ser numérico ("-2.5") ou clínico
// ("PL", "neutro"). Estratégia:
//   - esf/cil/add: tenta formatar como dioptria (sinal + 2 casas + vírgula BR);
//     se não for número, devolve o texto como o profissional digitou (trim).
//   - eixo: número puro recebe "°"; valor que já traz "°" ou texto livre mantém.
//   - vazio → "—" (mantém o layout das tabelas limpo).

import { formatarDioptria } from '@/lib/utils/grau'

export function formatarCampoRx(
  valor: unknown,
  campo: 'esf' | 'cil' | 'eixo' | 'add',
): string {
  if (valor === null || valor === undefined) return '—'
  const bruto = typeof valor === 'number' ? String(valor) : String(valor).trim()
  if (bruto === '') return '—'

  if (campo === 'eixo') {
    // Já contém grau ou é texto → mantém como está.
    if (bruto.includes('°')) return bruto
    const n = Number(bruto.replace(',', '.'))
    return Number.isFinite(n) ? `${Math.round(n)}°` : bruto
  }

  // esf / cil / add — sinal explícito + 2 casas + vírgula; senão texto bruto.
  const fmt = formatarDioptria(bruto)
  return fmt ?? bruto
}
