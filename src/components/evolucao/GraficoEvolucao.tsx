'use client'

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PontoEvolucao } from '@/types/evolucao'

type Props = {
  pontos: PontoEvolucao[]
  // Quando definido, renderiza apenas as linhas cujas `key` estão na lista
  // (controlado pelos seletores Olho/Medida em EvolucaoGrau). Omitido = todas.
  linhasVisiveis?: string[]
}

// Configuração das 6 linhas: ESF/CIL em dioptrias (eixo Y esquerdo)
// e EIXO em graus (eixo Y direito) — escalas diferentes não combinam num só Y.
type LinhaCfg = {
  key: string         // dataKey no Recharts
  label: string       // texto na legenda + tooltip
  cor: string
  yAxisId: 'dioptrias' | 'graus'
  unidade: string
}

// Cores escolhidas para garantir contraste mínimo em fundo branco (WCAG AA).
// CIL OE foi escurecido (#CA8A04 — yellow-700) para legibilidade.
const LINHAS: LinhaCfg[] = [
  { key: 'esf_od',  label: 'ESF OD',  cor: '#0891B2', yAxisId: 'dioptrias', unidade: 'D' },
  { key: 'esf_oe',  label: 'ESF OE',  cor: '#0EA5E9', yAxisId: 'dioptrias', unidade: 'D' },
  { key: 'cil_od',  label: 'CIL OD',  cor: '#EA580C', yAxisId: 'dioptrias', unidade: 'D' },
  { key: 'cil_oe',  label: 'CIL OE',  cor: '#CA8A04', yAxisId: 'dioptrias', unidade: 'D' },
  { key: 'eixo_od', label: 'EIXO OD', cor: '#7C3AED', yAxisId: 'graus',     unidade: '°' },
  { key: 'eixo_oe', label: 'EIXO OE', cor: '#DB2777', yAxisId: 'graus',     unidade: '°' },
]

// Formata uma data ISO para "DD/MM/AAAA" em horário Brasília
function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Formata data + hora ("DD/MM/AAAA HH:mm") em horário Brasília — usado no tooltip
function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Tipo mínimo do payload de tooltip — Recharts 3 mudou os tipos genéricos;
// usamos shape estrutural para evitar acoplar a tipos internos.
type PayloadTooltip = {
  dataKey?: string | number
  value?: number | string | null
}

type CustomTooltipProps = {
  active?: boolean
  payload?: PayloadTooltip[]
  label?: string | number
}

// Tooltip customizado — mostra todas as métricas do ponto com unidades.
// Header usa data + hora (do `dataHoraCompleta` no payload), não o label do eixo X.
function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  // O Recharts coloca o objeto-fonte de cada Line no `payload[i].payload`.
  // Pegamos o primeiro para ler `dataHoraCompleta`.
  const primeira = payload[0] as PayloadTooltip & {
    payload?: { dataHoraCompleta?: string }
  }
  const titulo = primeira.payload?.dataHoraCompleta ?? label
  return (
    <div className="rounded-md border bg-card p-3 text-sm shadow-md">
      <p className="font-medium text-foreground mb-2">{titulo}</p>
      <div className="space-y-1">
        {payload.map((p) => {
          const cfg = LINHAS.find((l) => l.key === p.dataKey)
          if (!cfg) return null
          const val = p.value
          const txt = val === null || val === undefined ? '—' : `${val} ${cfg.unidade}`
          return (
            <div key={String(p.dataKey)} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: cfg.cor }}
              />
              <span className="text-muted-foreground">{cfg.label}:</span>
              <span className="font-medium text-foreground">{txt}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function GraficoEvolucao({ pontos, linhasVisiveis }: Props) {
  // Set de chaves ocultas — toggle pelo clique na legenda
  const [ocultas, setOcultas] = useState<Set<string>>(() => new Set())

  // Linhas a desenhar: subconjunto controlado externamente ou todas (default).
  const linhasMostradas = linhasVisiveis
    ? LINHAS.filter((l) => linhasVisiveis.includes(l.key))
    : LINHAS
  // O eixo Y direito (graus) só aparece quando há alguma linha de EIXO visível.
  const mostrarEixoGraus = linhasMostradas.some((l) => l.yAxisId === 'graus')

  // Transforma pontos em formato linear que o Recharts consome.
  // Quando há múltiplos atendimentos no mesmo dia, anexa horário ao label
  // para evitar pontos com X-axis idêntico (que se sobreporiam visualmente).
  const dadosGrafico = useMemo(() => {
    // Primeiro pass: conta ocorrências de cada data
    const contagem = new Map<string, number>()
    for (const p of pontos) {
      const d = formatarData(p.finalizadoEm)
      contagem.set(d, (contagem.get(d) ?? 0) + 1)
    }
    // Segundo pass: monta os dados; só adiciona hora se houver duplicata
    return pontos.map((p) => {
      const dataBase = formatarData(p.finalizadoEm)
      const precisaHora = (contagem.get(dataBase) ?? 0) > 1
      const dataLabel = precisaHora
        ? `${dataBase} ${new Date(p.finalizadoEm).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}`
        : dataBase
      return {
        dataLabel,
        dataHoraCompleta: formatarDataHora(p.finalizadoEm),
        esf_od: p.od.esf,
        esf_oe: p.oe.esf,
        cil_od: p.od.cil,
        cil_oe: p.oe.cil,
        eixo_od: p.od.eixo,
        eixo_oe: p.oe.eixo,
      }
    })
  }, [pontos])

  function toggleLinha(key: string) {
    setOcultas((prev) => {
      const novo = new Set(prev)
      if (novo.has(key)) novo.delete(key)
      else novo.add(key)
      return novo
    })
  }

  return (
    <div className="w-full h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={dadosGrafico}
          margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis
            dataKey="dataLabel"
            tick={{ fontSize: 11, fill: '#64748B' }}
            stroke="#CBD5E1"
          />
          <YAxis
            yAxisId="dioptrias"
            label={{
              value: 'Dioptrias',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 11, fill: '#64748B' },
            }}
            tick={{ fontSize: 11, fill: '#64748B' }}
            stroke="#CBD5E1"
          />
          {mostrarEixoGraus && (
            <YAxis
              yAxisId="graus"
              orientation="right"
              label={{
                value: 'Eixo (°)',
                angle: 90,
                position: 'insideRight',
                style: { fontSize: 11, fill: '#64748B' },
              }}
              domain={[0, 180]}
              tick={{ fontSize: 11, fill: '#64748B' }}
              stroke="#CBD5E1"
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend
            onClick={(o) => {
              // O Recharts passa um objeto com `dataKey` no clique da legenda
              const k = (o as { dataKey?: string }).dataKey
              if (typeof k === 'string') toggleLinha(k)
            }}
            wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
          />
          {linhasMostradas.map((l) => (
            <Line
              key={l.key}
              yAxisId={l.yAxisId}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.cor}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              hide={ocultas.has(l.key)}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
