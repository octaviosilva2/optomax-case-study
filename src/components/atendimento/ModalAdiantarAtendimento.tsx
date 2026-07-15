'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarClock, X, Loader2, Play, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'

import { useAgendaDia, useAgendaSemana, type Agendamento } from '@/hooks/useAgenda'
import { avatarColor, iniciais } from '@/lib/utils/avatar'
import { formatarHoraBR } from '@/lib/utils/data'
import FluxoEscolhaAtendimento from './FluxoEscolhaAtendimento'
import QuickPrescriptionModal from '@/components/receitas/QuickPrescriptionModal'
import { iniciarAtendimento, iniciarReceitaDeAgendamento } from '@/app/(app)/agenda/actions'

// Retorna a "chave do dia" YYYY-MM-DD em horário de Brasília — usada para
// comparar duas datas sem ambiguidade de fuso (substitui `toDateString()`).
function chaveDiaBR(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // 'escolha' (default, Painel): mostra o modal Ficha×Receita.
  // 'ficha' (aba "Nova Ficha", S4/CA6): pula a escolha, cria a ficha direto.
  // 'receita' (aba "Nova Receita", S4/CA6): pula a escolha, vincula a receita
  // ao agendamento (iniciarReceitaDeAgendamento) e abre o formulário de grau.
  destino?: 'escolha' | 'ficha' | 'receita'
}

// Formata "HH:MM" em horário Brasília
function formatarHora(iso: string) {
  return formatarHoraBR(iso)
}

// Formata "12 MAI" em horário Brasília — usado pra etiqueta de dia diferente do atual
function formatarDataCurta(iso: string) {
  return new Date(iso)
    .toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: 'short',
    })
    .replace('.', '')
    .toUpperCase()
}

export default function ModalAdiantarAtendimento({ open, onOpenChange, destino = 'escolha' }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const overlayRef = useRef<HTMLDivElement>(null)

  const [hoje] = useState(() => new Date())
  const [escopo, setEscopo] = useState<'dia' | 'semana'>('dia')
  // Reorganização "Novo Atendimento" (SPEC §5, porta A2): agendamento escolhido
  // na lista → fia o padrão comum (CA5 + modal Ficha × Receita) via componente
  // compartilhado. onVoltar retorna pra esta lista, preservando escopo/hoje.
  // Só usado quando destino === 'escolha'.
  const [agendamentoEscolha, setAgendamentoEscolha] = useState<Agendamento | null>(null)
  // destino === 'ficha' | 'receita' (S4/CA6): pula a escolha — guarda o
  // agendamento em processamento (loader no botão) e, no caso da receita, o
  // paciente resolvido pra abrir o formulário de grau.
  const [processandoId, setProcessandoId] = useState<string | null>(null)
  const [receitaAlvo, setReceitaAlvo] = useState<{ paciente: { id: string; nome: string }; appointmentId: string } | null>(null)

  const { data: agendaDia, isLoading: loadingDia } = useAgendaDia(hoje)
  const { data: agendaSemana, isLoading: loadingSemana } = useAgendaSemana(hoje)

  // Filtra agendamentos pendentes (agendado/confirmado) e ainda "adiantáveis":
  // some quem já passou mais de 30 min do horário marcado (atrasos antigos não
  // fazem sentido adiantar — só do horário até 30 min depois, e futuros).
  const TOLERANCIA_ATRASO_MS = 30 * 60 * 1000
  const candidatos = useMemo(() => {
    const base = (escopo === 'dia' ? agendaDia : agendaSemana) ?? []
    // Ancorado em `hoje` (capturado 1x no mount) em vez de Date.now() — mantém
    // o useMemo puro (react-hooks/purity).
    const limite = hoje.getTime() - TOLERANCIA_ATRASO_MS
    return base.filter(
      (a) =>
        ['agendado', 'confirmado'].includes(a.status) &&
        new Date(a.data_hora).getTime() >= limite
    )
  }, [agendaDia, agendaSemana, escopo, hoje, TOLERANCIA_ATRASO_MS])

  // Fecha com Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onOpenChange])

  // Bloqueia scroll do body
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onOpenChange(false)
  }

  async function handleAdiantar(ag: Agendamento) {
    if (destino === 'escolha') {
      setAgendamentoEscolha(ag)
      return
    }

    // 'ficha' | 'receita' (S4/CA6): pula a escolha — age direto.
    if (processandoId) return
    setProcessandoId(ag.id)
    try {
      if (destino === 'ficha') {
        const result = await iniciarAtendimento(ag.id)
        if (result.error) throw new Error(result.error)
        queryClient.invalidateQueries({ queryKey: ['atendimentos_ativos'] })
        queryClient.invalidateQueries({ queryKey: ['atendimentos_lista'] })
        queryClient.invalidateQueries({ queryKey: ['agenda'] })
        onOpenChange(false)
        if (result.recordId) router.push(`/ficha/${result.recordId}`)
      } else {
        const result = await iniciarReceitaDeAgendamento(ag.id)
        if (result.error || !result.patient) throw new Error(result.error ?? 'Falha ao iniciar receita.')
        queryClient.invalidateQueries({ queryKey: ['agenda'] })
        setReceitaAlvo({ paciente: result.patient, appointmentId: ag.id })
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao iniciar atendimento.')
    } finally {
      setProcessandoId(null)
    }
  }

  if (!open) return null

  // Receita vinculada ao agendamento (destino === 'receita') → formulário de
  // grau direto, com o paciente já fixado.
  if (receitaAlvo) {
    return (
      <QuickPrescriptionModal
        open
        onOpenChange={(o) => { if (!o) { setReceitaAlvo(null); onOpenChange(false) } }}
        pacienteFixo={receitaAlvo.paciente}
        appointmentId={receitaAlvo.appointmentId}
      />
    )
  }

  // Agendamento escolhido (destino === 'escolha') → passa pro fluxo comum
  // (verifica CA5, mostra o modal Ficha × Receita). Substitui a lista inteira
  // (sem stack de overlays).
  if (agendamentoEscolha) {
    return (
      <FluxoEscolhaAtendimento
        open
        onOpenChange={(o) => { if (!o) { setAgendamentoEscolha(null); onOpenChange(false) } }}
        appointmentId={agendamentoEscolha.id}
        paciente={{ id: agendamentoEscolha.patient_id, nome: agendamentoEscolha.patients?.nome ?? 'Paciente' }}
        onVoltar={() => setAgendamentoEscolha(null)}
      />
    )
  }

  const loading = escopo === 'dia' ? loadingDia : loadingSemana
  // Chave do dia em BR — independe do fuso do browser
  const hojeStr = chaveDiaBR(hoje)

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-[640px] max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl bg-background shadow-2xl ring-1 ring-border overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Adiantar atendimento</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Escolha um paciente já agendado para iniciar agora
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs de escopo (Dia / Semana) */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setEscopo('dia')}
            className={`inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-medium border transition ${
              escopo === 'dia'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setEscopo('semana')}
            className={`inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-medium border transition ${
              escopo === 'semana'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Esta semana
          </button>
        </div>

        {/* Lista */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : candidatos.length === 0 ? (
            <div className="text-center py-10 text-[13px] text-muted-foreground">
              {escopo === 'dia'
                ? 'Nenhum agendamento pendente para hoje.'
                : 'Nenhum agendamento pendente nesta semana.'}
            </div>
          ) : (
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {candidatos.map((ag) => {
                const ehHoje = chaveDiaBR(new Date(ag.data_hora)) === hojeStr
                return (
                  <div
                    key={ag.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[14px] font-semibold tabular-nums text-foreground">
                          {formatarHora(ag.data_hora)}
                        </span>
                        <span className="text-[9px] uppercase bg-primary/10 text-primary rounded px-1.5 py-0.5 font-medium">
                          {ehHoje ? 'HOJE' : formatarDataCurta(ag.data_hora)}
                        </span>
                      </div>
                      <div className="w-px h-7 bg-border shrink-0" />
                      <div className={`w-8 h-8 rounded-full ${avatarColor(ag.patients?.nome ?? 'A')} text-white text-[11px] font-semibold grid place-items-center shrink-0`}>
                        {iniciais(ag.patients?.nome ?? 'A')}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-medium text-foreground truncate">
                          {ag.patients?.nome}
                        </span>
                        {/* Mostra duracao em vez do nome do tipo (removido) */}
                        <span className="text-[11px] text-muted-foreground truncate">
                          {ag.duracao} min
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdiantar(ag)}
                      disabled={processandoId === ag.id}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {processandoId === ag.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Play className="w-3.5 h-3.5" fill="currentColor" />}
                      Adiantar
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
