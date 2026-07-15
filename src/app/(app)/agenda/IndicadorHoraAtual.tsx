'use client'

// Indicador "agora" (linha vermelha) das grades de agenda — diária e semanal.
// Isola o setInterval de 60s aqui dentro: só este componente re-renderiza a
// cada minuto, ao invés da grade inteira. Antes era um useState no parent que
// causava render completo da grade + todos agendamentos.

import { useEffect, useState } from 'react'

// Extrai hora/minuto/data-string em horário de Brasília.
// Garante comportamento correto mesmo se o browser estiver em fuso diferente.
function obterPartesBR(date: Date): { hour: number; minute: number; dateKey: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return {
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  }
}

type PropsDia = {
  modo: 'dia'
  alturaHora: number
  inicioMinutos: number
  fimMinutos: number
  data: Date
}

type PropsSemana = {
  modo: 'semana'
  alturaHora: number
  inicioMinutos: number
  fimMinutos: number
  dias: Date[]
}

type Props = PropsDia | PropsSemana

export default function IndicadorHoraAtual(props: Props) {
  const [horaAtual, setHoraAtual] = useState<Date>(() => new Date())

  // Atualiza a cada 60s — só este componente re-renderiza, não a grade inteira
  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  // Hora/minuto e data em horário de Brasília (não depende do fuso do browser)
  const partesAgora = obterPartesBR(horaAtual)
  const agoraMinutos = partesAgora.hour * 60 + partesAgora.minute
  const dentroDaJanela = agoraMinutos >= props.inicioMinutos && agoraMinutos <= props.fimMinutos
  if (!dentroDaJanela) return null

  // Para o modo dia: só renderiza se a data exibida for hoje.
  // Para o modo semana: só se algum dos 7 dias for hoje.
  const ehHoje =
    props.modo === 'dia'
      ? obterPartesBR(props.data).dateKey === partesAgora.dateKey
      : props.dias.some((d) => obterPartesBR(d).dateKey === partesAgora.dateKey)
  if (!ehHoje) return null

  const topAtual = ((agoraMinutos - props.inicioMinutos) / 60) * props.alturaHora

  // Estilo varia entre grade diária (dentro do wrapper de 3.5rem) e semanal
  // (sobreposta ao grid inteiro, precisa do offset left=3.5rem).
  if (props.modo === 'dia') {
    return (
      <div
        className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
        style={{ top: topAtual }}
      >
        <div className="-ml-1.5 h-2.5 w-2.5 rounded-full bg-status-critical shrink-0" />
        <div className="flex-1 h-px bg-status-critical" />
      </div>
    )
  }

  return (
    <div
      className="absolute flex items-center z-30 pointer-events-none"
      style={{ top: topAtual, left: '3.5rem', right: 0 }}
    >
      <div className="-ml-1.5 h-2.5 w-2.5 rounded-full bg-status-critical shrink-0" />
      <div className="flex-1 h-px bg-status-critical" />
    </div>
  )
}
