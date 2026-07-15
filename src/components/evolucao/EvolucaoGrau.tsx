'use client'

import { useEffect, useMemo, useState } from 'react'
import { LineChart, AlertCircle, Check, TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useEvolucaoGrau } from '@/hooks/useEvolucaoGrau'
import { logEventClient } from '@/lib/events'
import { GraficoEvolucao } from './GraficoEvolucao'
import { TabelaDelta } from './TabelaDelta'
import type { PontoEvolucao } from '@/types/evolucao'

type Props = {
  patientId: string
  // Variante "compacta" usa altura menor e omite título — útil em painel lateral
  // dentro do atendimento. Default é "completa" para o perfil do paciente.
  variante?: 'completa' | 'compacta'
}

type Olho = 'od' | 'oe' | 'ambos'
type Medida = 'esf' | 'cil'
type Periodo = '1ano' | 'tudo'

// Variação mínima considerada "mexeu" — abaixo disso o grau é tido como estável.
const LIMIAR_ESTAVEL = 0.25
const UM_ANO_MS = 365 * 24 * 60 * 60 * 1000

// Botão segmentado discreto (Olho/Medida/Período).
function Seg({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { v: string; label: string }[]
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 shrink-0">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-2.5 py-1 rounded-md text-[12px] font-semibold transition-colors whitespace-nowrap ${
            value === o.v
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Série temporal (t, v) de uma medida/olho, descartando pontos sem valor.
function serieDe(
  pontos: PontoEvolucao[],
  olho: 'od' | 'oe',
  medida: Medida,
): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = []
  for (const p of pontos) {
    const v = p[olho][medida]
    if (v !== null) out.push({ t: new Date(p.finalizadoEm).getTime(), v })
  }
  return out
}

// "0,50 D" com sinal — usado na frase de insight.
function fmtDelta(n: number): string {
  if (Math.abs(n) < 0.005) return '0 D'
  const sinal = n > 0 ? '+' : '−'
  return `${sinal}${Math.abs(n).toFixed(2).replace('.', ',')} D`
}

type Insight = { texto: string; tom: 'ok' | 'info' }

// Frase automática derivada da série: variação no último ano + total desde a 1ª consulta.
function montarInsight(pontos: PontoEvolucao[], medida: Medida, olhoSel: Olho): Insight | null {
  if (pontos.length < 2) return null

  // Para "Ambos", usa OD como referência; cai para OE se OD não tiver série.
  let olhoRef: 'od' | 'oe' = olhoSel === 'oe' ? 'oe' : 'od'
  let serie = serieDe(pontos, olhoRef, medida)
  if (serie.length < 2 && olhoSel === 'ambos') {
    olhoRef = 'oe'
    serie = serieDe(pontos, 'oe', medida)
  }
  if (serie.length < 2) return null

  const nomeMedida = medida === 'esf' ? 'Grau' : 'Cilíndrico'
  const deltaTotal = serie[serie.length - 1].v - serie[0].v

  // Variação nos últimos 12 meses (se houver ≥2 pontos no período).
  const limite = Date.now() - UM_ANO_MS
  const serieAno = serie.filter((s) => s.t >= limite)
  let parteAno: string
  let estavelAno: boolean
  if (serieAno.length >= 2) {
    const dAno = serieAno[serieAno.length - 1].v - serieAno[0].v
    estavelAno = Math.abs(dAno) < LIMIAR_ESTAVEL
    parteAno = estavelAno
      ? `${nomeMedida} estável no último ano`
      : `${nomeMedida} ${dAno > 0 ? 'subiu' : 'caiu'} ${fmtDelta(dAno)} no último ano`
  } else {
    estavelAno = Math.abs(deltaTotal) < LIMIAR_ESTAVEL
    parteAno = estavelAno
      ? `${nomeMedida} estável`
      : `${nomeMedida} ${deltaTotal > 0 ? 'subiu' : 'caiu'} ${fmtDelta(deltaTotal)}`
  }

  const texto = `${parteAno} · ${fmtDelta(deltaTotal)} desde a 1ª consulta`
  const estavel = estavelAno && Math.abs(deltaTotal) < LIMIAR_ESTAVEL
  return { texto, tom: estavel ? 'ok' : 'info' }
}

// Componente orquestrador: chama o hook e decide o que mostrar
// (skeleton, vazio, controles + gráfico + insight + tabela).
export function EvolucaoGrau({ patientId, variante = 'completa' }: Props) {
  const { pontos, delta, isLoading, isError } = useEvolucaoGrau(patientId)
  const compacta = variante === 'compacta'

  const [olho, setOlho] = useState<Olho>('ambos')
  const [medida, setMedida] = useState<Medida>('esf')
  const [periodo, setPeriodo] = useState<Periodo>('tudo')

  // Evento: gráfico de evolução visualizado (não-bloqueante — painel /admin).
  // Dispara apenas uma vez por montagem do componente para esse paciente.
  useEffect(() => {
    if (patientId) {
      logEventClient('grade_evolution_viewed', { patient_id: patientId })
    }
  }, [patientId])

  // Filtra os pontos pelo período selecionado (eixo X = finalizado_em).
  const pontosFiltrados = useMemo(() => {
    if (periodo === 'tudo') return pontos
    const limite = Date.now() - UM_ANO_MS
    return pontos.filter((p) => new Date(p.finalizadoEm).getTime() >= limite)
  }, [pontos, periodo])

  // Quais linhas do gráfico mostrar = medida × olho selecionados.
  const linhasVisiveis = useMemo(() => {
    const olhos = olho === 'ambos' ? ['od', 'oe'] : [olho]
    return olhos.map((o) => `${medida}_${o}`)
  }, [olho, medida])

  // Insight usa a série completa (não filtrada pelo período) — a frase já
  // descreve "último ano" e "desde a 1ª consulta" independente do zoom.
  const insight = useMemo(() => montarInsight(pontos, medida, olho), [pontos, medida, olho])

  // ----- Loading -----
  if (isLoading) {
    return (
      <div className="space-y-3">
        {!compacta && <Skeleton className="h-5 w-48" />}
        <Skeleton className={compacta ? 'h-48 w-full' : 'h-[360px] w-full'} />
        {!compacta && <Skeleton className="h-32 w-full" />}
      </div>
    )
  }

  // ----- Erro -----
  if (isError) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive-bg p-3 text-sm text-destructive flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Não foi possível carregar a evolução do grau. Tente recarregar a página.</span>
      </div>
    )
  }

  // ----- Vazio (0 atendimentos finalizados) -----
  if (pontos.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted p-6 text-center">
        <LineChart className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Nenhum dado de prescrição registrado.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          A evolução do grau aparecerá aqui após o primeiro atendimento finalizado.
        </p>
      </div>
    )
  }

  // ----- Controles + gráfico + insight + tabela -----
  return (
    <div className="space-y-4">
      {!compacta && (
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
          <Seg
            value={olho}
            onChange={(v) => setOlho(v as Olho)}
            options={[
              { v: 'od', label: 'OD' },
              { v: 'oe', label: 'OE' },
              { v: 'ambos', label: 'Ambos' },
            ]}
          />
          <Seg
            value={medida}
            onChange={(v) => setMedida(v as Medida)}
            options={[
              { v: 'esf', label: 'Esférico' },
              { v: 'cil', label: 'Cilíndrico' },
            ]}
          />
          <Seg
            value={periodo}
            onChange={(v) => setPeriodo(v as Periodo)}
            options={[
              { v: '1ano', label: '1 ano' },
              { v: 'tudo', label: 'Tudo' },
            ]}
          />
        </div>
      )}

      {!compacta && insight && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            insight.tom === 'ok'
              ? 'bg-status-ok-bg border-status-ok/20 text-status-ok'
              : 'bg-primary-subtle border-primary/20 text-primary'
          }`}
        >
          {insight.tom === 'ok' ? (
            <Check className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span className="font-medium">{insight.texto}</span>
        </div>
      )}

      {pontosFiltrados.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted p-6 text-center text-sm text-muted-foreground">
          Nenhum atendimento finalizado no período selecionado.
        </div>
      ) : (
        <GraficoEvolucao
          pontos={pontosFiltrados}
          linhasVisiveis={compacta ? undefined : linhasVisiveis}
        />
      )}

      <TabelaDelta delta={delta} />
    </div>
  )
}
