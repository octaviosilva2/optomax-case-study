'use client'

import { ArrowDown, ArrowRight, ArrowUp, Minus } from 'lucide-react'
import type { DeltaEvolucao, ItemDelta } from '@/types/evolucao'

type Props = {
  delta: DeltaEvolucao
}

// Formata um valor numérico com sinal explícito ("+1.25", "-2.50") ou "—" se null.
// Eixo é inteiro (graus); ESF/CIL têm 2 casas (dioptrias).
function formatarValor(v: number | null, campo: string): string {
  if (v === null) return '—'
  if (campo === 'eixo') return `${v}°`
  const sinal = v > 0 ? '+' : ''
  return `${sinal}${v.toFixed(2)}`
}

// Mesmo formato do delta (sempre com sinal). Para eixo, sinal positivo é redundante
// mas mantém consistência visual.
function formatarDelta(v: number | null, campo: string): string {
  if (v === null) return '—'
  if (campo === 'eixo') {
    const sinal = v > 0 ? '+' : ''
    return `${sinal}${v}°`
  }
  const sinal = v > 0 ? '+' : ''
  return `${sinal}${v.toFixed(2)}`
}

// Ícone direcional + cor pelo sinal do delta. Para eixo, neutralizamos cor
// porque "aumento de eixo" não é necessariamente piora clínica.
function IconeDelta({ valor, campo }: { valor: number | null; campo: string }) {
  if (valor === null) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
  if (valor === 0) return <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
  if (campo === 'eixo') return <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
  // ESF/CIL: convenção em optometria — valores mais negativos = piora;
  // mais positivos = melhora (correção menor). Marcamos visualmente.
  if (valor < 0) return <ArrowDown className="h-3.5 w-3.5 text-destructive" />
  return <ArrowUp className="h-3.5 w-3.5 text-status-ok" />
}

const LABELS_CAMPO: Record<ItemDelta['campo'], string> = {
  esf: 'ESF',
  cil: 'CIL',
  eixo: 'EIXO',
  add: 'ADD',
}

// Formata uma data ISO para "DD/MM/AAAA" em horário Brasília
function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function TabelaDelta({ delta }: Props) {
  // Caso especial: 1 atendimento — não há comparação ainda
  if (delta.totalAtendimentos === 1) {
    return (
      <div className="rounded-md border border-status-warning/30 bg-status-warning-bg p-3 text-sm text-status-warning">
        Aguardando próximo atendimento para comparação.
      </div>
    )
  }

  // 0 atendimentos: o wrapper trata esse caso, aqui é defesa
  if (delta.itens.length === 0) return null

  // Filtra só os campos do gráfico (esf/cil/eixo) — DNP/ADD não aparecem aqui.
  const itensVisiveis = delta.itens.filter(
    (i) => i.campo === 'esf' || i.campo === 'cil' || i.campo === 'eixo',
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 px-2 font-medium text-muted-foreground">Métrica</th>
            <th className="py-2 px-2 font-medium text-muted-foreground">
              <div>Primeiro</div>
              <div className="text-[10px] font-normal text-muted-foreground">
                {formatarData(delta.primeiroEm)}
              </div>
            </th>
            <th className="py-2 px-2 font-medium text-muted-foreground">
              <div>Atual</div>
              <div className="text-[10px] font-normal text-muted-foreground">
                {formatarData(delta.ultimoEm)}
              </div>
            </th>
            <th className="py-2 px-2 font-medium text-muted-foreground">Δ</th>
          </tr>
        </thead>
        <tbody>
          {itensVisiveis.map((i) => (
            <tr key={`${i.olho}-${i.campo}`} className="border-b last:border-0">
              <td className="py-2 px-2 font-medium text-foreground">
                {i.olho.toUpperCase()} {LABELS_CAMPO[i.campo]}
              </td>
              <td className="py-2 px-2 text-muted-foreground tabular-nums">
                {formatarValor(i.primeiro, i.campo)}
              </td>
              <td className="py-2 px-2 text-muted-foreground tabular-nums">
                {formatarValor(i.ultimo, i.campo)}
              </td>
              <td className="py-2 px-2 tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <IconeDelta valor={i.delta} campo={i.campo} />
                  <span className="font-medium text-foreground">
                    {formatarDelta(i.delta, i.campo)}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
