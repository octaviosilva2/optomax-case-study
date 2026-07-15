'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, Calendar, CalendarDays } from 'lucide-react'
import GradeCalendario from './GradeCalendario'
import ModalNovoAgendamento from './ModalNovoAgendamento'
import type { Agendamento } from '@/hooks/useAgenda'
import { getStatusConfig, type StatusAgendamento } from '@/lib/utils/status'

// Status exibidos na legenda de cores (cancelado é legacy — fica de fora).
const STATUS_LEGENDA: StatusAgendamento[] = ['agendado', 'confirmado', 'em_andamento', 'concluido', 'faltou']

type AgendamentoEditar = {
  id: string
  patientId: string
  patientNome: string
  dataHora: string
  duracao: number
  observacao: string | null
}

type Visao = 'dia' | 'semana'

type Props = {
  orgId: string
  /** Visão inicial lida do cookie no server (evita salto no SSR). */
  visaoInicial: Visao
}

// Segunda a domingo a partir de qualquer data da semana.
function getDiasDaSemana(data: Date): Date[] {
  const dow = data.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const seg = new Date(data)
  seg.setDate(data.getDate() + diff)
  seg.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(seg)
    d.setDate(seg.getDate() + i)
    return d
  })
}

// "Quinta-feira, 28 de maio de 2026" — capitaliza só a 1ª letra (sem mono).
function tituloDia(d: Date): string {
  const s = d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// "28 – 31 de maio de 2026" (ou cruzando mês: "28 de maio – 3 de junho de 2026").
function tituloSemana(dias: Date[]): string {
  const a = dias[0]
  const b = dias[dias.length - 1]
  const mes = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' })
  const ano = b.getFullYear()
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()} – ${b.getDate()} de ${mes(a)} de ${ano}`
  }
  return `${a.getDate()} de ${mes(a)} – ${b.getDate()} de ${mes(b)} de ${ano}`
}

export default function AgendaView({ orgId, visaoInicial }: Props) {
  const searchParams = useSearchParams()
  const [dataRef, setDataRef] = useState(() => new Date())
  const [visao, setVisao] = useState<Visao>(visaoInicial)
  const [isMobile, setIsMobile] = useState(false)

  // Modal de novo agendamento / edição
  const [modalAberto, setModalAberto] = useState(false)
  const [agendamentoEditar, setAgendamentoEditar] = useState<AgendamentoEditar | undefined>(undefined)

  // Mobile = sempre visão dia. Detecção pós-mount (sem hydration mismatch).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  function abrirNovo() {
    setAgendamentoEditar(undefined)
    setModalAberto(true)
  }

  function abrirEditar(ag: Agendamento) {
    setAgendamentoEditar({
      id: ag.id,
      patientId: ag.patient_id,
      patientNome: ag.patients?.nome ?? 'Paciente',
      dataHora: ag.data_hora,
      duracao: ag.duracao,
      observacao: ag.observacao,
    })
    setModalAberto(true)
  }

  // Abre o modal quando ?novo=1 está na URL (atalhos externos)
  useEffect(() => {
    if (searchParams.get('novo') === '1') setModalAberto(true)
  }, [searchParams])

  const effView: Visao = isMobile ? 'dia' : visao
  const dias = effView === 'dia' ? [dataRef] : getDiasDaSemana(dataRef)
  const titulo = effView === 'dia' ? tituloDia(dataRef) : tituloSemana(dias)

  function setVisaoPersistida(v: Visao) {
    setVisao(v)
    document.cookie = `agenda_view=${v}; path=/; max-age=31536000; samesite=lax`
  }

  function navegar(delta: number) {
    const nova = new Date(dataRef)
    nova.setDate(nova.getDate() + (effView === 'semana' ? delta * 7 : delta))
    setDataRef(nova)
  }

  const seg = (ativo: boolean) =>
    `inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium transition-colors ${
      ativo ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'
    }`

  return (
    <div className="flex h-full flex-col">
      {/* Cabeçalho (toolbar + legenda): fixo no topo do mobile, só a grade rola.
          No desktop volta a estático (a própria grade tem scroll interno). */}
      <div className="sticky top-0 z-20 bg-card md:static md:z-auto">
      {/* Toolbar única */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => setDataRef(new Date())}
          className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Hoje
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navegar(-1)}
            aria-label="Período anterior"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => navegar(1)}
            aria-label="Próximo período"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="ml-1 text-[15px] font-medium text-foreground">{titulo}</span>

        <div className="flex-1" />

        {/* Seletor Dia/Semana — só desktop (no mobile é sempre dia) */}
        <div className="hidden overflow-hidden rounded-lg border border-border md:inline-flex">
          <button onClick={() => setVisaoPersistida('dia')} className={seg(visao === 'dia')}>
            <Calendar className="h-3.5 w-3.5" />
            Dia
          </button>
          <button onClick={() => setVisaoPersistida('semana')} className={`${seg(visao === 'semana')} border-l border-border`}>
            <CalendarDays className="h-3.5 w-3.5" />
            Semana
          </button>
        </div>

        {/* "+ Novo" — desktop (mobile usa FAB) */}
        <button
          onClick={() => abrirNovo()}
          className="hidden h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary-hover md:inline-flex"
        >
          <Plus className="h-4 w-4" />
          Novo
        </button>
      </div>

      {/* Legenda de cores dos status — simples e discreta */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border bg-card px-4 py-2">
        {STATUS_LEGENDA.map((s) => {
          const cfg = getStatusConfig(s)
          return (
            <span key={s} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${cfg.dotClass}`} />
              {cfg.label}
            </span>
          )
        })}
      </div>
      </div>

      {/* Grade — no mobile flui no scroll do main (cabeçalho fica fixo);
          no desktop a própria grade tem scroll interno. */}
      <div className="bg-background md:flex-1 md:overflow-hidden">
        <GradeCalendario
          dias={dias}
          onEditar={abrirEditar}
          onAgendarVazio={() => abrirNovo()}
        />
      </div>

      {/* FAB — mobile */}
      <button
        onClick={() => abrirNovo()}
        aria-label="Novo agendamento"
        className="fixed bottom-20 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      <ModalNovoAgendamento
        open={modalAberto}
        onOpenChange={(o) => {
          setModalAberto(o)
          if (!o) {
            setAgendamentoEditar(undefined)
          }
        }}
        orgId={orgId}
        dataSelecionada={dataRef}
        agendamentoEditar={agendamentoEditar}
      />
    </div>
  )
}
