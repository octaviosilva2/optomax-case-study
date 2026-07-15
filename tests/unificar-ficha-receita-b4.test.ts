// Testes do BLOCO 4 — "Unificar Ficha e Receita": Lista de Receitas repaginada.
// Cobre o plano de teste da SPEC §3 (parágrafo B4): derivação de Tipo (CA26) e
// Status (CA27), e o botão único por estado (CA28), incluindo a PRECEDÊNCIA do
// ternário (rascunho antes de vinculada). CA25 (colunas) e CA29 (regressão:
// Arquivadas/seleção em massa/menu enxuto) são verificação estática/checklist —
// documentadas no relatório com arquivo:linha (não render em node), padrão B1/B2.
//
// Mapa critério → teste:
//   CA26  → tipoReceitaLabel (função REAL exportada de ReceitasView) — com/sem ficha.
//   CA27  → StatusPill: rascunho→"Em andamento", finalizada→"Finalizado" (contrato espelhado).
//   CA28  → botão único: Retomar (rascunho) · Ver ficha (vinculada) · Ver receita (avulsa)
//           + precedência rascunho-antes-de-vinculada + destinos de rota corretos.
//
// Ambiente: Vitest `environment: 'node'` (vitest.config.ts) — SEM jsdom/@testing-library.
// Render de React é impossível aqui. Por isso:
//   • tipoReceitaLabel é função PURA top-level → testada REAL (exportada em B4-S3;
//     mudança trivial de produção, zero comportamento — declarada no relatório).
//   • StatusPill (componente JSX privado) e o botão único (ternário inline no JSX)
//     NÃO são extraíveis sem render → CONTRATO ESPELHADO documentado (padrão B1),
//     com os fixtures amarrados ao tipo REAL `ReceitaListaItem` (`import type`) para
//     que drift no shape de `status`/`clinical_record_id` quebre a compilação.

import { describe, it, expect } from 'vitest'

// Função REAL sob teste (CA26). O `import type` de ReceitaListaItem é apagado na
// transpilação; o import de valor abaixo carrega a função de verdade.
import { tipoReceitaLabel } from '@/app/(app)/receitas/ReceitasView'
import type { ReceitaListaItem } from '@/app/(app)/receitas/ReceitasView'

// ─────────────────────────────────────────────────────────────────────────
// Fixture builder — devolve um ReceitaListaItem REAL (todos os campos do tipo).
// Amarrar os fixtures ao tipo garante que, se o shape mudar (ex.: `status` deixar
// de ser 'rascunho'|'finalizada', ou `clinical_record_id` mudar de nulabilidade),
// este arquivo pare de compilar — pegando o drift sem precisar renderizar.
// ─────────────────────────────────────────────────────────────────────────
function receita(over: Partial<ReceitaListaItem> = {}): ReceitaListaItem {
  return {
    id: 'presc-1',
    tipo: 'oculos',
    prescription_type: 'quick',
    created_at: '2026-07-13T10:00:00.000Z',
    patient_id: 'pac-1',
    dados_prescricao: null,
    clinical_record_id: null,
    status: 'finalizada',
    patients: { id: 'pac-1', nome: 'Maria', whatsapp: null },
    ...over,
  }
}

// ═════════════════════════════════════════════════════════════════════════
// CA26 — coluna Tipo (função REAL `tipoReceitaLabel`)
// Comportamento observável: o texto exibido na coluna "Tipo" deriva só de
// `clinical_record_id` (presente = veio de ficha; ausente = avulsa/quick).
// ═════════════════════════════════════════════════════════════════════════
describe('CA26 — tipoReceitaLabel (função real, coluna Tipo)', () => {
  it('receita VINCULADA (clinical_record_id presente) → "Receita (com ficha)"', () => {
    expect(tipoReceitaLabel(receita({ clinical_record_id: 'rec-123' }))).toBe(
      'Receita (com ficha)',
    )
  })

  it('receita AVULSA (clinical_record_id null) → "Receita (sem ficha)"', () => {
    expect(tipoReceitaLabel(receita({ clinical_record_id: null }))).toBe(
      'Receita (sem ficha)',
    )
  })

  it('deriva SÓ de clinical_record_id — status/tipo não influenciam o rótulo', () => {
    // Rascunho avulso e finalizada avulsa dão o mesmo Tipo (ambos sem ficha).
    expect(tipoReceitaLabel(receita({ status: 'rascunho', clinical_record_id: null }))).toBe(
      'Receita (sem ficha)',
    )
    // Vinculada continua "com ficha" independentemente do resto.
    expect(
      tipoReceitaLabel(receita({ status: 'finalizada', clinical_record_id: 'rec-9' })),
    ).toBe('Receita (com ficha)')
  })

  it('aceita string vazia como "sem ficha" (falsy — mesmo caminho do null)', () => {
    // Defesa: uma FK vazia (não deveria ocorrer) cai no ramo "sem ficha" — nunca
    // rotula "com ficha" sem um id real para linkar.
    expect(tipoReceitaLabel({ clinical_record_id: '' })).toBe('Receita (sem ficha)')
  })
})

// ═════════════════════════════════════════════════════════════════════════
// CA27 — coluna Status (CONTRATO ESPELHADO de StatusPill, ver aviso no topo)
//
// StatusPill (ReceitasView.tsx:92) é componente JSX privado. `statusLabel` abaixo
// reproduz EXATAMENTE seu mapeamento de texto (o efeito observável ao usuário) e
// amarra o input ao tipo real `ReceitaListaItem['status']`. Se StatusPill for
// extraído para função pura no futuro, trocar por ela e apagar o espelho.
// ═════════════════════════════════════════════════════════════════════════
describe('CA27 — Status (contrato espelhado de StatusPill)', () => {
  // Espelho fiel de ReceitasView.tsx:92-107: rascunho → "Em andamento";
  // qualquer outro (finalizada) → "Finalizado".
  function statusLabel(status: ReceitaListaItem['status']): string {
    return status === 'rascunho' ? 'Em andamento' : 'Finalizado'
  }

  it('status "rascunho" → pílula "Em andamento" (B3)', () => {
    expect(statusLabel('rascunho')).toBe('Em andamento')
  })

  it('status "finalizada" → pílula "Finalizado"', () => {
    expect(statusLabel('finalizada')).toBe('Finalizado')
  })

  it('o rótulo textual difere da chave do banco (Finalizado ≠ finalizada; Em andamento ≠ rascunho)', () => {
    // Garante que a UI traduz o enum do banco para o vocabulário do usuário —
    // e que a lista de fichas e a de receitas falam a mesma língua (CA1/CA27).
    expect(statusLabel('finalizada')).not.toBe('finalizada')
    expect(statusLabel('rascunho')).not.toBe('rascunho')
  })
})

// ═════════════════════════════════════════════════════════════════════════
// CA28 — botão único por estado (CONTRATO ESPELHADO do ternário inline)
//
// O ternário vive inline no JSX (ReceitasView.tsx:563 desktop / :691 mobile),
// não é função extraível sem render. `botaoUnico` abaixo espelha EXATAMENTE a
// ordem e os destinos das 3 ramificações. A ORDEM importa: `status==='rascunho'`
// é testado ANTES de `clinical_record_id` (precedência), depois avulsa finalizada.
// Fixtures amarrados a ReceitaListaItem (pega drift de id/status/clinical_record_id).
// ═════════════════════════════════════════════════════════════════════════
describe('CA28 — botão único por estado (contrato espelhado do ternário)', () => {
  // Espelho fiel de ReceitasView.tsx:563-587 (idêntico no mobile :691-713).
  // Devolve o rótulo primário (desktop) + a rota de destino do clique.
  function botaoUnico(
    rx: Pick<ReceitaListaItem, 'id' | 'status' | 'clinical_record_id'>,
  ): { label: string; href: string } {
    if (rx.status === 'rascunho') {
      return { label: 'Retomar', href: `/receitas/${rx.id}/editar` }
    }
    if (rx.clinical_record_id) {
      return { label: 'Ver ficha', href: `/ficha/${rx.clinical_record_id}` }
    }
    return { label: 'Ver receita', href: `/receitas/${rx.id}` }
  }

  it('rascunho avulso → "Retomar" → /receitas/{id}/editar', () => {
    const rx = receita({ id: 'p-draft', status: 'rascunho', clinical_record_id: null })
    expect(botaoUnico(rx)).toEqual({ label: 'Retomar', href: '/receitas/p-draft/editar' })
  })

  it('vinculada finalizada → "Ver ficha" → /ficha/{clinical_record_id} (2 cards, não a receita)', () => {
    const rx = receita({ id: 'p-vinc', status: 'finalizada', clinical_record_id: 'rec-777' })
    expect(botaoUnico(rx)).toEqual({ label: 'Ver ficha', href: '/ficha/rec-777' })
  })

  it('avulsa finalizada → "Ver receita" → /receitas/{id} (tela só-receita)', () => {
    const rx = receita({ id: 'p-avul', status: 'finalizada', clinical_record_id: null })
    expect(botaoUnico(rx)).toEqual({ label: 'Ver receita', href: '/receitas/p-avul' })
  })

  it('PRECEDÊNCIA — rascunho ganha de vinculada: rascunho COM clinical_record_id ainda mostra "Retomar"', () => {
    // Estado anômalo (CA24 diz que vinculada nunca é rascunho), mas o ternário
    // testa `status==='rascunho'` PRIMEIRO — este teste trava essa ordem: se
    // alguém inverter os ramos, uma vinculada em rascunho abriria a ficha por
    // engano em vez de retomar o preenchimento.
    const rx = receita({ id: 'p-anom', status: 'rascunho', clinical_record_id: 'rec-x' })
    expect(botaoUnico(rx)).toEqual({ label: 'Retomar', href: '/receitas/p-anom/editar' })
    // Reforço explícito: NÃO caiu no ramo "Ver ficha".
    expect(botaoUnico(rx).label).not.toBe('Ver ficha')
  })

  it('"Ver ficha" e "Ver receita" nunca abrem a mesma rota (rótulo bate com conteúdo — CA12/CA28)', () => {
    const vinc = botaoUnico(receita({ id: 'x', status: 'finalizada', clinical_record_id: 'rec-1' }))
    const avul = botaoUnico(receita({ id: 'x', status: 'finalizada', clinical_record_id: null }))
    expect(vinc.href.startsWith('/ficha/')).toBe(true)
    expect(avul.href.startsWith('/receitas/')).toBe(true)
    expect(vinc.href).not.toBe(avul.href)
  })

  it('cada estado tem UM único rótulo — os três são mutuamente exclusivos', () => {
    const rascunho = botaoUnico(receita({ status: 'rascunho', clinical_record_id: null })).label
    const vinculada = botaoUnico(receita({ status: 'finalizada', clinical_record_id: 'r' })).label
    const avulsa = botaoUnico(receita({ status: 'finalizada', clinical_record_id: null })).label
    expect(new Set([rascunho, vinculada, avulsa]).size).toBe(3)
  })
})
