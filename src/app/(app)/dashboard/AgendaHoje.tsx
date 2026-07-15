'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  CalendarX,
  CheckCheck,
  Loader2,
  MoreVertical,
  Pencil,
  RefreshCw,
  Stethoscope,
  Trash2,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAgendaDia, useAtualizarStatus, type Agendamento } from '@/hooks/useAgenda'
import { getStatusConfig, type StatusAgendamento } from '@/lib/utils/status'
import { formatarHoraBR } from '@/lib/utils/data'
import { excluirAgendamento } from '@/app/(app)/agenda/actions'
import ModalNovoAgendamento from '@/app/(app)/agenda/ModalNovoAgendamento'
import FluxoEscolhaAtendimento from '@/components/atendimento/FluxoEscolhaAtendimento'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { avatarColor, iniciais } from '@/lib/utils/avatar'

/* Cor do ponto de servico — cor fixa sem tipo de consulta */
function svcDotColor() {
  return 'bg-primary'
}

// Mantém wrapper local com mesma assinatura usada pelo componente
function formatarHora(iso: string) {
  return formatarHoraBR(iso)
}

/**
 * Menu de ações do agendamento — compartilhado entre desktop (tabela) e mobile (card).
 * Extraído para evitar duplicação de lógica.
 */
function MenuAcoesAgendamento({
  ag,
  onEditar,
  atualizarStatus,
  onIniciar,
  onExecutarAcao,
  onConfirmFalta,
  onConfirmExcluir,
}: {
  ag: Agendamento
  onEditar: (ag: Agendamento) => void
  atualizarStatus: ReturnType<typeof useAtualizarStatus>
  onIniciar: () => void
  onExecutarAcao: (novo: StatusAgendamento) => void
  onConfirmFalta: () => void
  onConfirmExcluir: () => void
}) {
  const status = ag.status as StatusAgendamento

  // Máquina de estados do menu (mesma lógica da agenda):
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

  // Monta array de itens visíveis para intercalar separadores corretamente
  // (evita separadores órfãos quando itens condicionais estão ocultos)
  const itensVisiveis: React.ReactNode[] = []

  if (temIniciar) {
    itensVisiveis.push(
      <DropdownMenuItem key="iniciar" onClick={onIniciar}>
        <Stethoscope className="h-4 w-4 mr-2" />
        {labelIniciar}
      </DropdownMenuItem>
    )
  }
  if (temConfirmar) {
    itensVisiveis.push(
      <DropdownMenuItem key="confirmar" onClick={() => onExecutarAcao('confirmado')}>
        <CheckCheck className="h-4 w-4 mr-2" />
        Confirmar
      </DropdownMenuItem>
    )
  }
  if (temFalta) {
    itensVisiveis.push(
      <DropdownMenuItem key="falta" onClick={onConfirmFalta}>
        <UserX className="h-4 w-4 mr-2" />
        Registrar falta
      </DropdownMenuItem>
    )
  }
  if (temReabrir) {
    itensVisiveis.push(
      <DropdownMenuItem key="reabrir" onClick={() => onExecutarAcao('agendado')}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Reabrir
      </DropdownMenuItem>
    )
  }
  if (temEditar) {
    itensVisiveis.push(
      <DropdownMenuItem key="editar" onClick={() => onEditar(ag)}>
        <Pencil className="h-4 w-4 mr-2" />
        Editar
      </DropdownMenuItem>
    )
  }
  // Item destrutivo sempre por último
  itensVisiveis.push(
    <DropdownMenuItem key="excluir" onClick={onConfirmExcluir} variant="destructive">
      <Trash2 className="h-4 w-4 mr-2" />
      Excluir agendamento
    </DropdownMenuItem>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={atualizarStatus.isPending}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        aria-label="Opcoes do agendamento"
      >
        {atualizarStatus.isPending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <MoreVertical className="h-3.5 w-3.5" />
        }
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {itensVisiveis.map((item, i) => (
          <div key={i}>
            {i > 0 && <DropdownMenuSeparator />}
            {item}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Hook compartilhado para lógica de ações do agendamento.
 */
function useAgendamentoActions(ag: Agendamento) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const atualizarStatus = useAtualizarStatus()
  const [confirmFalta, setConfirmFalta] = useState(false)
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  // Reorganização "Novo Atendimento" (SPEC §5, porta C): "Iniciar atendimento"
  // abre direto o fluxo comum (CA5 + modal Ficha × Receita) via FluxoEscolhaAtendimento.
  const [escolhaAberta, setEscolhaAberta] = useState(false)

  async function executarAcao(novo: StatusAgendamento) {
    try {
      await atualizarStatus.mutateAsync({ id: ag.id, status: novo })
      toast.success(`Status atualizado para "${getStatusConfig(novo).label}"`)
      // Faixa de progresso e header vêm do Server Component — força recálculo.
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
        queryClient.invalidateQueries({ queryKey: ['agenda'] })
        router.refresh()
      }
    } finally {
      setExcluindo(false)
      setConfirmExcluir(false)
    }
  }

  return {
    atualizarStatus,
    confirmFalta,
    setConfirmFalta,
    confirmExcluir,
    setConfirmExcluir,
    excluindo,
    escolhaAberta,
    setEscolhaAberta,
    executarAcao,
    handleExcluir,
  }
}

/**
 * Linha da tabela desktop — mostra horário, paciente, duração, status e menu de ações.
 */
function LinhaAgendamentoDesktop({ ag, onEditar }: { ag: Agendamento; onEditar: (ag: Agendamento) => void }) {
  const cfg = getStatusConfig(ag.status)
  const actions = useAgendamentoActions(ag)

  const inativo = ag.status === 'cancelado' || ag.status === 'faltou' || ag.status === 'concluido'
  const nomeCompleto = ag.patients?.nome ?? '—'
  const dur = ag.duracao ?? null

  return (
    <>
      <tr className={`border-b border-border last:border-0 hover:bg-muted/70 transition-colors ${inativo ? 'opacity-55' : ''}`}>

        {/* Horário + duração */}
        <td className="py-3.5 pl-5 pr-3 whitespace-nowrap">
          <span className="block text-[15px] font-semibold text-foreground tabular-nums leading-tight tracking-[-0.01em]">
            {formatarHora(ag.data_hora)}
          </span>
          {dur && (
            <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">{dur} min</span>
          )}
        </td>

        {/* Paciente: avatar + nome */}
        <td className="py-3.5 px-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-semibold select-none ${avatarColor(nomeCompleto)}`}>
              {iniciais(nomeCompleto)}
            </div>
            <div className="min-w-0">
              <Link
                href={`/pacientes/${ag.patient_id}`}
                className="block text-[14px] font-medium text-foreground hover:text-primary transition-colors truncate leading-tight"
              >
                {nomeCompleto}
              </Link>
            </div>
          </div>
        </td>

        {/* Duracao — oculto em telas pequenas (tipo de consulta removido) */}
        <td className="py-3.5 px-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-sm shrink-0 ${svcDotColor()}`} />
            <span className="text-[13px] text-muted-foreground truncate">{ag.duracao} min</span>
          </div>
        </td>

        {/* Status badge com dot */}
        <td className="py-3.5 px-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.badgeClass}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass} shrink-0`} />
            {cfg.label}
          </span>
        </td>

        {/* Ações */}
        <td className="py-3.5 pr-4 pl-1 text-right">
          <MenuAcoesAgendamento
            ag={ag}
            onEditar={onEditar}
            atualizarStatus={actions.atualizarStatus}
            onIniciar={() => actions.setEscolhaAberta(true)}
            onExecutarAcao={actions.executarAcao}
            onConfirmFalta={() => actions.setConfirmFalta(true)}
            onConfirmExcluir={() => actions.setConfirmExcluir(true)}
          />
        </td>
      </tr>

      <FluxoEscolhaAtendimento
        open={actions.escolhaAberta}
        onOpenChange={actions.setEscolhaAberta}
        appointmentId={ag.id}
        paciente={{ id: ag.patient_id, nome: ag.patients?.nome ?? 'Paciente' }}
      />
      <ConfirmDialog
        open={actions.confirmFalta}
        onOpenChange={actions.setConfirmFalta}
        titulo="Registrar falta?"
        descricao="O paciente será marcado como falta. Esta ação pode ser revertida depois."
        labelConfirmar="Registrar falta"
        variante="destrutivo"
        carregando={actions.atualizarStatus.isPending}
        onConfirmar={async () => {
          await actions.executarAcao('faltou')
          actions.setConfirmFalta(false)
        }}
      />
      <ConfirmDialog
        open={actions.confirmExcluir}
        onOpenChange={actions.setConfirmExcluir}
        titulo="Excluir agendamento?"
        descricao="O agendamento será removido permanentemente e não poderá ser recuperado."
        labelConfirmar="Excluir"
        variante="destrutivo"
        carregando={actions.excluindo}
        onConfirmar={actions.handleExcluir}
      />
    </>
  )
}

/**
 * Card mobile — layout empilhado que cabe em qualquer largura de tela.
 * Mostra horário + paciente na primeira linha, status + menu na segunda.
 */
function CardAgendamentoMobile({ ag, onEditar }: { ag: Agendamento; onEditar: (ag: Agendamento) => void }) {
  const cfg = getStatusConfig(ag.status)
  const actions = useAgendamentoActions(ag)

  const inativo = ag.status === 'cancelado' || ag.status === 'faltou' || ag.status === 'concluido'
  const nomeCompleto = ag.patients?.nome ?? '—'
  const dur = ag.duracao ?? null

  return (
    <>
      <div className={`flex items-center gap-3 p-3 rounded-xl border border-border bg-card transition-colors ${inativo ? 'opacity-55' : ''}`}>
        {/* Horário + duração — coluna fixa à esquerda */}
        <div className="flex flex-col items-center justify-center shrink-0 w-12">
          <span className="text-[15px] font-semibold text-foreground tabular-nums leading-tight">
            {formatarHora(ag.data_hora)}
          </span>
          {dur && (
            <span className="text-[11px] font-normal text-muted-foreground mt-0.5">{dur} min</span>
          )}
        </div>

        {/* Avatar + paciente + status — ocupa o resto */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {/* Avatar do paciente — mesmo estilo do desktop */}
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-semibold select-none ${avatarColor(nomeCompleto)}`}>
            {iniciais(nomeCompleto)}
          </div>
          {/* Nome + status */}
          <div className="min-w-0 flex-1">
            <Link
              href={`/pacientes/${ag.patient_id}`}
              className="block text-[14px] font-medium text-foreground hover:text-primary transition-colors truncate leading-tight"
            >
              {nomeCompleto}
            </Link>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.badgeClass}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass} shrink-0`} />
                {cfg.label}
              </span>
            </div>
          </div>
        </div>

        {/* Menu de ações */}
        <div className="shrink-0">
          <MenuAcoesAgendamento
            ag={ag}
            onEditar={onEditar}
            atualizarStatus={actions.atualizarStatus}
            onIniciar={() => actions.setEscolhaAberta(true)}
            onExecutarAcao={actions.executarAcao}
            onConfirmFalta={() => actions.setConfirmFalta(true)}
            onConfirmExcluir={() => actions.setConfirmExcluir(true)}
          />
        </div>
      </div>

      <FluxoEscolhaAtendimento
        open={actions.escolhaAberta}
        onOpenChange={actions.setEscolhaAberta}
        appointmentId={ag.id}
        paciente={{ id: ag.patient_id, nome: ag.patients?.nome ?? 'Paciente' }}
      />
      <ConfirmDialog
        open={actions.confirmFalta}
        onOpenChange={actions.setConfirmFalta}
        titulo="Registrar falta?"
        descricao="O paciente será marcado como falta. Esta ação pode ser revertida depois."
        labelConfirmar="Registrar falta"
        variante="destrutivo"
        carregando={actions.atualizarStatus.isPending}
        onConfirmar={async () => {
          await actions.executarAcao('faltou')
          actions.setConfirmFalta(false)
        }}
      />
      <ConfirmDialog
        open={actions.confirmExcluir}
        onOpenChange={actions.setConfirmExcluir}
        titulo="Excluir agendamento?"
        descricao="O agendamento será removido permanentemente e não poderá ser recuperado."
        labelConfirmar="Excluir"
        variante="destrutivo"
        carregando={actions.excluindo}
        onConfirmar={actions.handleExcluir}
      />
    </>
  )
}

export function AgendaHoje({ orgId }: { orgId: string }) {
  const [hoje, setHoje] = useState<Date>(() => new Date())
  // Modal de edição (mesmo da agenda) — abre ao clicar "Editar" numa linha.
  const [agendamentoEditar, setAgendamentoEditar] = useState<{
    id: string
    patientId: string
    patientNome: string
    dataHora: string
    duracao: number
    observacao: string | null
  } | undefined>(undefined)

  function abrirEditar(ag: Agendamento) {
    setAgendamentoEditar({
      id: ag.id,
      patientId: ag.patient_id,
      patientNome: ag.patients?.nome ?? 'Paciente',
      dataHora: ag.data_hora,
      duracao: ag.duracao,
      observacao: ag.observacao,
    })
  }

  useEffect(() => {
    const id = setInterval(() => {
      const agora = new Date()
      setHoje(atual => atual.toDateString() === agora.toDateString() ? atual : agora)
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const { data: agendamentos, isLoading, isError } = useAgendaDia(hoje, true)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return <p className="py-6 text-center text-sm text-destructive">Erro ao carregar agenda do dia.</p>
  }

  const itens = agendamentos ?? []

  if (itens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
        <CalendarX className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Sem agendamentos hoje.</p>
      </div>
    )
  }

  return (
    <>
      <ModalNovoAgendamento
        open={!!agendamentoEditar}
        onOpenChange={(o) => { if (!o) setAgendamentoEditar(undefined) }}
        orgId={orgId}
        dataSelecionada={hoje}
        agendamentoEditar={agendamentoEditar}
      />

      {/* Tabela desktop — oculta no mobile */}
      <div className="hidden md:block">
        <table className="w-full table-fixed">
          <colgroup>
            {/* Horário | Paciente | Duração | Status | Ações */}
            <col className="w-[15%]" />
            <col className="w-[35%]" />
            <col className="w-[15%]" />
            <col className="w-[25%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted/60">
              <th className="py-2.5 pl-5 pr-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.07em]">
                Horário
              </th>
              <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.07em]">
                Paciente
              </th>
              <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.07em]">
                Duração
              </th>
              <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.07em]">
                Status
              </th>
              <th className="py-2.5 pr-4" />
            </tr>
          </thead>
          <tbody>
            {itens.map(ag => <LinhaAgendamentoDesktop key={ag.id} ag={ag} onEditar={abrirEditar} />)}
          </tbody>
        </table>
      </div>

      {/* Cards mobile — visível apenas em telas pequenas */}
      <div className="md:hidden flex flex-col gap-2 p-3">
        {itens.map(ag => <CardAgendamentoMobile key={ag.id} ag={ag} onEditar={abrirEditar} />)}
      </div>
    </>
  )
}
