'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  useAgendaDia,
  useAgendaSemana,
  useAtualizarStatus,
  type Agendamento,
} from '@/hooks/useAgenda'
import { formatarDataKey } from '@/lib/utils/agenda'
import { formatarHoraBR } from '@/lib/utils/data'
import { getStatusConfig, type StatusAgendamento } from '@/lib/utils/status'
import IndicadorHoraAtual from './IndicadorHoraAtual'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { excluirAgendamento } from './actions'
import FluxoEscolhaAtendimento from '@/components/atendimento/FluxoEscolhaAtendimento'
import { toast } from 'sonner'
import {
  Loader2,
  MoreVertical,
  CheckCheck,
  UserX,
  RefreshCw,
  Stethoscope,
  CalendarPlus,
  Pencil,
  Trash2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Grade cobre o dia inteiro (00:00 → 24:00) pra caber qualquer horário, mas os
// RÓTULOS visíveis vão só de 01:00 a 23:00 (sem "00:00" no topo nem no fim).
const GRID_END_H = 24
const ALTURA_HORA = 56 // px por hora
const BODY_H = GRID_END_H * ALTURA_HORA
const DIA_SEMANA_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Estilo do bloco por status (classes literais — Tailwind não interpola).
const EV_BOX: Record<StatusAgendamento, string> = {
  agendado:
    'bg-agenda-agendado/10 border-l-[3px] border-l-agenda-agendado text-foreground',
  confirmado:
    'bg-agenda-confirmado/10 border-l-[3px] border-l-agenda-confirmado text-foreground',
  em_andamento:
    'bg-agenda-em-andamento/10 border-l-[3px] border-l-agenda-em-andamento text-foreground',
  concluido:
    'bg-agenda-concluido/10 border-l-[3px] border-l-agenda-concluido text-muted-foreground',
  faltou:
    'bg-agenda-faltou/10 border-l-[3px] border-l-agenda-faltou text-foreground',
  cancelado:
    'bg-agenda-cancelado/10 border-l-[3px] border-l-agenda-cancelado text-muted-foreground',
}

type Props = {
  /** 1 data = visão dia; 7 datas = visão semana. */
  dias: Date[]
  incluirCancelados?: boolean
  onEditar: (ag: Agendamento) => void
  onAgendarVazio: () => void
}

// ── Layout de sobreposição: eventos que colidem no tempo ganham colunas
// lado a lado (col/cols), como no Google Calendar. ──────────────────────────
type Pos = { ev: Agendamento; topMin: number; durMin: number; col: number; cols: number }

function layoutDia(ags: Agendamento[]): Pos[] {
  const items = ags
    .map((ev) => {
      const d = new Date(ev.data_hora)
      const topMin = d.getHours() * 60 + d.getMinutes()
      const durMin = ev.duracao && ev.duracao > 0 ? ev.duracao : 30
      return { ev, topMin, durMin, start: topMin, end: topMin + durMin, col: 0, cols: 1 }
    })
    .sort((a, b) => a.start - b.start || a.end - b.end)

  let cluster: typeof items = []
  let clusterEnd = -1
  const colEnds: number[] = []

  const flush = () => {
    const total = colEnds.length || 1
    cluster.forEach((p) => (p.cols = total))
    cluster = []
    colEnds.length = 0
  }

  for (const it of items) {
    if (cluster.length && it.start >= clusterEnd) flush()
    let col = colEnds.findIndex((e) => e <= it.start)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(it.end)
    } else {
      colEnds[col] = it.end
    }
    it.col = col
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.end)
  }
  if (cluster.length) flush()

  return items.map(({ ev, topMin, durMin, col, cols }) => ({ ev, topMin, durMin, col, cols }))
}

function EventoCard({
  ag,
  altura,
  onEditar,
}: {
  ag: Agendamento
  altura: number
  onEditar: (ag: Agendamento) => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const atualizarStatus = useAtualizarStatus()
  const [confirmFalta, setConfirmFalta] = useState(false)
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  // Reorganização "Novo Atendimento" (SPEC §5, porta D): "Iniciar atendimento"
  // abre direto o fluxo comum (CA5 + modal Ficha × Receita).
  const [escolhaAberta, setEscolhaAberta] = useState(false)

  const status = ag.status as StatusAgendamento
  const cfg = getStatusConfig(ag.status)
  const hora = formatarHoraBR(ag.data_hora)
  const compacto = altura < 44 // evento curto → conteúdo em 1 linha

  // Máquina de estados do menu de ações (mesma lógica do painel):
  // - agendado     → Iniciar · Confirmar · Registrar falta · Editar · Excluir
  // - confirmado   → Iniciar · Excluir
  // - em_andamento → Voltar ao atendimento · Excluir
  // - faltou       → Reabrir · Excluir
  // - concluido/cancelado → só Excluir (servidor bloqueia ficha finalizada)
  const temIniciar = status === 'agendado' || status === 'confirmado' || status === 'em_andamento'
  const labelIniciar = status === 'em_andamento' ? 'Voltar ao atendimento' : 'Iniciar atendimento'
  const temConfirmar = status === 'agendado'
  const temFalta = status === 'agendado'
  const temReabrir = status === 'faltou'
  const temEditar = status === 'agendado'

  async function executarAcao(novo: StatusAgendamento) {
    try {
      await atualizarStatus.mutateAsync({ id: ag.id, status: novo })
      toast.success(`Status atualizado para "${getStatusConfig(novo).label}"`)
      router.refresh()
    } catch {
      toast.error('Erro ao atualizar status.')
    }
  }

  async function handleExcluir() {
    setExcluindo(true)
    try {
      const res = await excluirAgendamento(ag.id)
      if (res.error === 'AGENDAMENTO_FINALIZADO') {
        toast.error('Atendimento finalizado não pode ser excluído.')
      } else if (res.error) {
        toast.error('Erro ao excluir agendamento.')
      } else {
        toast.success('Agendamento excluído.')
        // Atualiza a grade na hora (a grade é react-query no client).
        queryClient.invalidateQueries({ queryKey: ['agenda'] })
        router.refresh()
      }
    } finally {
      setExcluindo(false)
      setConfirmExcluir(false)
    }
  }

  const pulsar = status === 'em_andamento'

  return (
    <>
      {/* stopPropagation evita disparar o "criar no slot" ao clicar no evento */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`group relative h-full overflow-hidden rounded-md py-0.5 pl-2 pr-6 shadow-sm transition-shadow hover:shadow-md ${EV_BOX[status] ?? 'bg-card border-l-[3px] border-l-border'}`}
      >
        {compacto ? (
          <div className="flex h-full items-center gap-1.5 overflow-hidden">
            <span className="shrink-0 text-[10px] font-semibold tabular-nums opacity-90">{hora}</span>
            {pulsar && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-agenda-em-andamento" />}
            <span className={`truncate text-[11px] font-semibold ${status === 'faltou' ? 'line-through' : ''}`}>
              {ag.patients?.nome ?? '—'}
            </span>
          </div>
        ) : (
          <div className="flex h-full flex-col overflow-hidden">
            <span className="flex items-center gap-1 text-[10px] font-semibold tabular-nums leading-tight opacity-90">
              {hora}
              {pulsar && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-agenda-em-andamento" />}
            </span>
            <span className={`truncate text-[12px] font-semibold leading-tight ${status === 'faltou' ? 'line-through' : ''}`}>
              {ag.patients?.nome ?? '—'}
            </span>
            <span className="truncate text-[10px] leading-tight opacity-70">{ag.duracao} min · {cfg.label}</span>
          </div>
        )}

        {/* Menu absoluto no canto — não rouba largura do conteúdo */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={atualizarStatus.isPending}
            aria-label="Ações do agendamento"
            className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-current/70 transition-colors hover:bg-black/5 hover:text-current disabled:opacity-50 dark:hover:bg-white/10"
          >
            {atualizarStatus.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MoreVertical className="h-3 w-3" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {/* Monta array de itens visíveis para intercalar separadores corretamente */}
            {(() => {
              const itensVisiveis: React.ReactNode[] = []
              if (temIniciar) {
                itensVisiveis.push(
                  <DropdownMenuItem key="iniciar" onClick={() => setEscolhaAberta(true)}>
                    <Stethoscope className="mr-2 h-4 w-4" />
                    {labelIniciar}
                  </DropdownMenuItem>
                )
              }
              if (temConfirmar) {
                itensVisiveis.push(
                  <DropdownMenuItem key="confirmar" onClick={() => executarAcao('confirmado')}>
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Confirmar
                  </DropdownMenuItem>
                )
              }
              if (temFalta) {
                itensVisiveis.push(
                  <DropdownMenuItem key="falta" onClick={() => setConfirmFalta(true)}>
                    <UserX className="mr-2 h-4 w-4" />
                    Registrar falta
                  </DropdownMenuItem>
                )
              }
              if (temReabrir) {
                itensVisiveis.push(
                  <DropdownMenuItem key="reabrir" onClick={() => executarAcao('agendado')}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reabrir
                  </DropdownMenuItem>
                )
              }
              if (temEditar) {
                itensVisiveis.push(
                  <DropdownMenuItem key="editar" onClick={() => onEditar(ag)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                )
              }
              // Item destrutivo sempre por último
              itensVisiveis.push(
                <DropdownMenuItem key="excluir" onClick={() => setConfirmExcluir(true)} disabled={excluindo} variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir agendamento
                </DropdownMenuItem>
              )
              return itensVisiveis.map((item, i) => (
                <div key={i}>
                  {i > 0 && <DropdownMenuSeparator />}
                  {item}
                </div>
              ))
            })()}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <FluxoEscolhaAtendimento
        open={escolhaAberta}
        onOpenChange={setEscolhaAberta}
        appointmentId={ag.id}
        paciente={{ id: ag.patient_id, nome: ag.patients?.nome ?? 'Paciente' }}
      />
      <ConfirmDialog
        open={confirmFalta}
        onOpenChange={setConfirmFalta}
        titulo="Registrar falta?"
        descricao="O paciente será marcado como falta. Esta ação pode ser revertida depois."
        labelConfirmar="Registrar falta"
        variante="destrutivo"
        carregando={atualizarStatus.isPending}
        onConfirmar={async () => {
          await executarAcao('faltou')
          setConfirmFalta(false)
        }}
      />
      <ConfirmDialog
        open={confirmExcluir}
        onOpenChange={setConfirmExcluir}
        titulo="Excluir agendamento?"
        descricao="O agendamento será removido permanentemente e não poderá ser recuperado."
        labelConfirmar="Excluir"
        variante="destrutivo"
        carregando={excluindo}
        onConfirmar={handleExcluir}
      />
    </>
  )
}

export default function GradeCalendario({ dias, incluirCancelados = false, onEditar, onAgendarVazio }: Props) {
  const isDia = dias.length === 1
  const scrollRef = useRef<HTMLDivElement>(null)

  const diaQuery = useAgendaDia(dias[0], incluirCancelados, isDia)
  const semanaQuery = useAgendaSemana(dias[0], incluirCancelados, !isDia)
  const { data: agendamentos = [], isLoading, error } = isDia ? diaQuery : semanaQuery

  const hoje = new Date()

  // Auto-scroll: hora atual a ~1/3 do topo; antes das 07:00 rola até 07:00.
  // Desktop: o próprio container rola. Mobile: a grade flui e quem rola é o
  // <main>, então rolamos o ancestral scrollável.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const now = new Date()
    const alvoMin = Math.max(now.getHours() * 60 + now.getMinutes(), 7 * 60)
    const y = (alvoMin / 60) * ALTURA_HORA
    const proprioRola = el.scrollHeight > el.clientHeight + 4
    if (proprioRola) {
      el.scrollTop = Math.max(0, y - el.clientHeight / 3)
      return
    }
    const scroller = el.closest('main')
    if (!scroller) return
    const gradeTop = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    scroller.scrollTop = Math.max(0, gradeTop + y - scroller.clientHeight / 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  }
  if (error) {
    return <div className="flex h-64 items-center justify-center text-destructive">Erro ao carregar agenda.</div>
  }

  if (isDia && agendamentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <CalendarPlus className="h-9 w-9 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">Nenhum atendimento neste dia.</p>
        <button onClick={onAgendarVazio} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary-hover">
          Agendar <span aria-hidden>→</span>
        </button>
      </div>
    )
  }

  // Rótulos/linhas só de 01:00 a 23:00 (topo e fim ficam sem número).
  const horas: number[] = []
  for (let h = 1; h <= 23; h++) horas.push(h)

  const porDia = new Map<string, Agendamento[]>()
  for (const ag of agendamentos) {
    const k = formatarDataKey(new Date(ag.data_hora))
    if (!porDia.has(k)) porDia.set(k, [])
    porDia.get(k)!.push(ag)
  }

  const gridCols = `3.5rem repeat(${dias.length}, minmax(0, 1fr))`

  return (
    <div ref={scrollRef} className="md:h-full md:overflow-y-scroll md:[max-height:calc(100dvh-150px)]">
      {/* Cabeçalho de dias (semana) — sticky no MESMO scroll, garante alinhamento das colunas */}
      {!isDia && (
        <div className="sticky top-0 z-20 border-b border-border bg-card">
          <div className="grid" style={{ gridTemplateColumns: gridCols }}>
            <div />
            {dias.map((dia) => {
              const ehHoje = dia.toDateString() === hoje.toDateString()
              return (
                <div key={formatarDataKey(dia)} className="flex flex-col items-center border-l border-border py-2">
                  <span className={`text-[11px] uppercase tracking-wide ${ehHoje ? 'text-primary' : 'text-muted-foreground'}`}>
                    {DIA_SEMANA_LABEL[dia.getDay()]}
                  </span>
                  <span className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${ehHoje ? 'bg-primary text-white' : 'text-foreground'}`}>
                    {dia.getDate()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Corpo da grade */}
      <div className="relative" style={{ height: BODY_H }}>
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: gridCols }}>
          {/* Gutter de horas (01:00–23:00) */}
          <div className="relative border-r border-border">
            {horas.map((h) => (
              <div key={h} className="absolute flex w-full justify-end pr-2" style={{ top: h * ALTURA_HORA - 7 }}>
                <span className="select-none text-[11px] tabular-nums text-muted-foreground">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Colunas dos dias */}
          {dias.map((dia) => {
            const k = formatarDataKey(dia)
            const ehHoje = dia.toDateString() === hoje.toDateString()
            const fimDeSemana = [0, 6].includes(dia.getDay())
            const layout = layoutDia(porDia.get(k) ?? [])
            return (
              <div
                key={k}
                className={`relative border-l border-border ${ehHoje ? 'bg-primary/[0.04]' : fimDeSemana ? 'bg-muted/20' : ''}`}
              >
                {/* Linhas de hora */}
                {horas.map((h) => (
                  <div key={h} className="pointer-events-none absolute left-0 right-0 border-t border-border/70" style={{ top: h * ALTURA_HORA }} />
                ))}

                {/* Eventos (com sobreposição lado a lado) */}
                {layout.map(({ ev, topMin, durMin, col, cols }) => {
                  const top = (topMin / 60) * ALTURA_HORA
                  const height = Math.max((durMin / 60) * ALTURA_HORA - 2, 20)
                  const widthPct = 100 / cols
                  return (
                    <div
                      key={ev.id}
                      className="absolute z-10"
                      style={{ top: top + 1, height, left: `calc(${col * widthPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
                    >
                      <EventoCard ag={ev} altura={height} onEditar={onEditar} />
                    </div>
                  )
                })}

                {/* Linha do agora — só na coluna de hoje */}
                {ehHoje && (
                  <IndicadorHoraAtual modo="dia" alturaHora={ALTURA_HORA} inicioMinutos={0} fimMinutos={GRID_END_H * 60} data={dia} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
