// Testes do BLOCO 1 (Nomenclatura + Tela de Receita dedicada + Imprimir) do
// pacote "Unificar Ficha e Receita". Cobre o plano de teste da SPEC §3 (linha B1):
//   - unit de `imprimirPdf` (helper compartilhado dos botões "Imprimir" — CA7);
//   - regressão dos helpers de WhatsApp/ótica que os cards Ficha/Receita usam
//     (extraídos em B1-S2 para `whatsapp-link.ts` — não podem ter regredido);
//   - contrato de `tipoLabel` (coluna "Tipo" da lista de fichas — CA2/CA3).
//
// Estratégia (mocking-estrategico): tudo aqui é lógica pura de UI. A única borda
// é `window.open`, que este ambiente (Vitest `environment: 'node'`) não tem — é
// substituída por um stub por teste e restaurada depois. Nada de rede/banco/DOM.
//
// ⚠️ LIMITAÇÃO CONHECIDA (reportada ao validator, não corrigida aqui):
// `tipoLabel` vive como função PRIVADA (não exportada) dentro do client component
// `src/app/(app)/ficha/AtendimentoCentral.tsx`. Sem exportá-la (mudança de
// produção, fora do escopo desta sessão) ou sem um harness de render de React
// (jsdom/@testing-library, não instalados no projeto), o teste não consegue
// vincular-se à função real. O bloco `tipoLabel` abaixo é um CONTRATO ESPELHADO
// da SPEC §B1.1: documenta e verifica o mapeamento esperado (CA2/CA3) e amarra os
// fixtures ao tipo real `AtendimentoItem` (pega drift de tipo), mas NÃO guarda a
// implementação privada. Recomendação no relatório: exportar `tipoLabel`.

import { describe, it, expect, afterEach, vi } from 'vitest'

import { imprimirPdf } from '@/lib/utils/print'
import {
  mascaraWhatsApp,
  normalizarNumero,
  formatarMensagemComExpiracao,
} from '@/lib/utils/whatsapp-link'
import type { AtendimentoItem } from '@/hooks/useAtendimentos'

// ─────────────────────────────────────────────────────────────────────────
// imprimirPdf (src/lib/utils/print.ts) — CA7 ("Imprimir" nos 2 cards + lista)
//
// Comportamento observável: abre a URL do PDF em nova aba e dispara a impressão
// do navegador quando o documento termina de carregar. É o mesmo helper ligado
// aos botões "Imprimir" de CardFicha, CardReceita e aos pontos inline de
// ReceitasView — testar o helper cobre a lógica dos três de uma vez.
// ─────────────────────────────────────────────────────────────────────────
describe('imprimirPdf', () => {
  // `window` não existe no ambiente node; guardamos e restauramos o stub.
  const realWindow = (globalThis as { window?: unknown }).window
  afterEach(() => {
    ;(globalThis as { window?: unknown }).window = realWindow
  })

  function stubWindow(open: (url: string, target: string) => unknown) {
    ;(globalThis as { window?: unknown }).window = { open }
  }

  it('abre a URL recebida em nova aba (_blank)', () => {
    const open = vi.fn(() => ({}))
    stubWindow(open)

    imprimirPdf('/api/prescricao/presc-1')

    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith('/api/prescricao/presc-1', '_blank')
  })

  it('dispara a impressão do navegador quando a aba termina de carregar (onload)', () => {
    const print = vi.fn()
    const fakeWin: { onload?: () => void; print: () => void } = { print }
    stubWindow(() => fakeWin)

    imprimirPdf('/api/ficha/rec-1')

    // O helper registra um onload; a impressão só ocorre ao carregar o PDF.
    expect(typeof fakeWin.onload).toBe('function')
    expect(print).not.toHaveBeenCalled()

    fakeWin.onload?.()
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('popup bloqueado (window.open retorna null) não lança nem imprime', () => {
    const open = vi.fn(() => null)
    stubWindow(open)

    expect(() => imprimirPdf('/api/prescricao/presc-2')).not.toThrow()
    expect(open).toHaveBeenCalledWith('/api/prescricao/presc-2', '_blank')
  })

  it('repassa a URL de FICHA e a de PRESCRIÇÃO sem reescrever', () => {
    const open = vi.fn(() => ({}))
    stubWindow(open)

    imprimirPdf('/api/ficha/abc')
    imprimirPdf('/api/prescricao/xyz')

    expect(open).toHaveBeenNthCalledWith(1, '/api/ficha/abc', '_blank')
    expect(open).toHaveBeenNthCalledWith(2, '/api/prescricao/xyz', '_blank')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Helpers de WhatsApp/ótica (src/lib/utils/whatsapp-link.ts)
//
// Regressão: B1-S2 EXTRAIU esta lógica de CardsPosFinalizacao para reuso entre
// CardFicha e CardReceita (WhatsApp do paciente) e o envio para ótica do
// CardReceita. O comportamento deve ser idêntico ao original — estes testes são
// a rede de segurança da extração (CA5/CA6: os botões de WhatsApp/ótica seguem
// montando o mesmo link).
// ─────────────────────────────────────────────────────────────────────────
describe('whatsapp-link — regressão da extração B1-S2', () => {
  describe('mascaraWhatsApp', () => {
    it('formata 11 dígitos como (XX) XXXXX-XXXX', () => {
      expect(mascaraWhatsApp('11987654321')).toBe('(11) 98765-4321')
    })

    it('descarta caracteres não numéricos antes de formatar', () => {
      expect(mascaraWhatsApp('(11) 98765-4321')).toBe('(11) 98765-4321')
    })

    it('limita a 11 dígitos (excedente é ignorado)', () => {
      expect(mascaraWhatsApp('11987654321999')).toBe('(11) 98765-4321')
    })

    it('formata parcialmente enquanto o usuário digita', () => {
      expect(mascaraWhatsApp('11')).toBe('11')
      expect(mascaraWhatsApp('119')).toBe('(11) 9')
      expect(mascaraWhatsApp('1198765')).toBe('(11) 98765')
    })
  })

  describe('normalizarNumero', () => {
    it('prefixa DDI 55 em número nacional (<= 11 dígitos)', () => {
      expect(normalizarNumero('(11) 98765-4321')).toBe('5511987654321')
    })

    it('mantém número que já vem com DDI (12+ dígitos)', () => {
      expect(normalizarNumero('5511987654321')).toBe('5511987654321')
    })

    it('retorna null quando não há dígito algum', () => {
      expect(normalizarNumero('')).toBeNull()
      expect(normalizarNumero('sem número')).toBeNull()
    })
  })

  describe('formatarMensagemComExpiracao', () => {
    it('monta intro + link + validade de 7 dias na data (fuso America/Sao_Paulo)', () => {
      // Data fixa → teste determinístico. O helper formata com timeZone
      // explícito, então o resultado independe do fuso do runner.
      const expiraEm = new Date('2026-07-17T12:00:00Z')
      const msg = formatarMensagemComExpiracao(
        'Olá! Aqui está sua prescrição:',
        'https://app.optomax.com.br/p/token-123',
        expiraEm,
      )
      expect(msg).toBe(
        'Olá! Aqui está sua prescrição:\n' +
          'https://app.optomax.com.br/p/token-123\n\n' +
          'Este link expira em 7 dias (até 17/07/2026).',
      )
    })

    it('usa a intro recebida (ficha vs prescrição vs ótica compartilham o mesmo formato)', () => {
      const expiraEm = new Date('2026-12-31T12:00:00Z')
      const msg = formatarMensagemComExpiracao('Olá! Aqui está sua ficha clínica:', 'x', expiraEm)
      expect(msg.startsWith('Olá! Aqui está sua ficha clínica:\nx\n\n')).toBe(true)
      expect(msg).toContain('31/12/2026')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────
// tipoLabel — contrato da coluna "Tipo" (CA2/CA3) — SPEC §B1.1
//
// ⚠️ CONTRATO ESPELHADO (ver aviso no topo do arquivo): a função real é privada
// em AtendimentoCentral.tsx. `tipoLabelContrato` abaixo reproduz EXATAMENTE a
// lógica da SPEC; os testes fixam o comportamento esperado e amarram os fixtures
// ao tipo `AtendimentoItem` real. Se `tipoLabel` for exportada no futuro, trocar
// o import por ela e apagar este espelho.
// ─────────────────────────────────────────────────────────────────────────
describe('tipoLabel — contrato da coluna Tipo (CONTRATO ESPELHADO, ver aviso)', () => {
  function tipoLabelContrato(item: Pick<AtendimentoItem, 'status' | 'modelo'>): string {
    if (item.status === 'em_andamento') return 'Ficha em andamento'
    return item.modelo === 'completo' ? 'Completa' : 'Resumida'
  }

  it('CA2 — em andamento exibe "Ficha em andamento" e ignora o modelo', () => {
    expect(tipoLabelContrato({ status: 'em_andamento', modelo: 'completo' })).toBe(
      'Ficha em andamento',
    )
    expect(tipoLabelContrato({ status: 'em_andamento', modelo: 'resumido' })).toBe(
      'Ficha em andamento',
    )
  })

  it('CA3 — finalizada exibe "Completa" quando modelo é completo', () => {
    expect(tipoLabelContrato({ status: 'finalizado', modelo: 'completo' })).toBe('Completa')
  })

  it('CA3 — finalizada exibe "Resumida" quando modelo é resumido', () => {
    expect(tipoLabelContrato({ status: 'finalizado', modelo: 'resumido' })).toBe('Resumida')
  })

  it('finalizada com modelo inesperado cai em "Resumida" (fallback defensivo)', () => {
    expect(tipoLabelContrato({ status: 'finalizado', modelo: '' })).toBe('Resumida')
  })
})
