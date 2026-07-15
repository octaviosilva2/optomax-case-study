'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { parseISO, isToday, isThisWeek, isThisMonth } from 'date-fns'
import {
  Search,
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
  Play,
  Check,
  ClipboardList,
  User,
  Trash2,
  Timer,
  CheckCircle2,
  FileText,
  ArrowRight,
  Archive,
  ArchiveRestore,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmDialog } from '@/components/confirm-dialog'
import NovoAtendimentoMenu from '@/components/atendimento/NovoAtendimentoMenu'
import { BarraSelecaoMassa } from '@/components/arquivados/BarraSelecaoMassa'

import { useAtendimentos, type AtendimentoItem } from '@/hooks/useAtendimentos'
import { useSelecaoMultipla } from '@/hooks/useSelecaoMultipla'
import {
  arquivarAtendimento,
  restaurarAtendimento,
  restaurarAtendimentosEmMassa,
  excluirAtendimentoCompleto,
  excluirAtendimentosEmMassa,
} from '@/app/(app)/agenda/actions'
import { avatarColor, iniciais } from '@/lib/utils/avatar'
import { formatarHoraBR, formatarDataCompacta } from '@/lib/utils/data'

// ── Ordenação ───────────────────────────────────────────────────────────────
// Mesmas opções da tela de Pacientes (sem "Última consulta").
type Ordenacao = 'az' | 'za' | 'recente' | 'antigo'
const ORDENACOES: Ordenacao[] = ['az', 'za', 'recente', 'antigo']
const SORT_LABEL: Record<Ordenacao, string> = {
  az: 'Nome (A–Z)',
  za: 'Nome (Z–A)',
  recente: 'Mais recentes',
  antigo: 'Mais antigos',
}

// ── Período (sobre data_evento) ───────────────────────────────────────────────
type Periodo = 'todos' | 'hoje' | 'semana' | 'mes'
const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mês' },
]

// ── Filtro de status da ficha ─────────────────────────────────────────────────
type StatusFiltro = 'todos' | 'em_andamento' | 'finalizado'
const STATUS_FILTROS: { key: StatusFiltro; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'finalizado', label: 'Finalizados' },
]

function dentroPeriodo(periodo: Periodo, iso: string): boolean {
  if (periodo === 'todos') return true
  const d = parseISO(iso)
  if (periodo === 'hoje') return isToday(d)
  if (periodo === 'semana') return isThisWeek(d, { weekStartsOn: 0 })
  if (periodo === 'mes') return isThisMonth(d)
  return true
}

// "Tipo" da ficha: em andamento ainda não tem tipo definido (só é decidido ao
// finalizar); finalizada deriva do modelo (Resumida/Completa). O título editável
// deixa de ocupar a coluna Tipo — continua existindo na tela da ficha.
function tipoLabel(item: AtendimentoItem): string {
  if (item.status === 'em_andamento') return 'Ficha em andamento'
  return item.modelo === 'completo' ? 'Completa' : 'Resumida'
}

const nomeDe = (item: AtendimentoItem) => item.patients?.nome ?? 'Paciente'

export function AtendimentoCentral() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Estado da UI
  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('todos')
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('recente')
  const [verArquivados, setVerArquivados] = useState(false)

  // Confirmações
  const [arquivarAlvo, setArquivarAlvo] = useState<AtendimentoItem | null>(null)
  const [arquivando, setArquivando] = useState(false)
  const [excluirAlvo, setExcluirAlvo] = useState<AtendimentoItem | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const { data: atendimentos = [], isLoading } = useAtendimentos(verArquivados)

  // Busca (nome) + filtro de status + filtro de período + ordenação em tiers.
  // O período vale para TODOS os status (em andamento também respeita o filtro);
  // a prioridade visual de "em andamento" fica só na ordenação, não no filtro.
  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return [...atendimentos]
      .filter((a) => {
        if (termo && !nomeDe(a).toLowerCase().includes(termo)) return false
        if (statusFiltro !== 'todos' && a.status !== statusFiltro) return false
        return dentroPeriodo(periodo, a.data_evento)
      })
      .sort((a, b) => {
        // Em andamento sempre no topo (o que estou atendendo agora).
        const t = (a.status === 'em_andamento' ? 0 : 1) - (b.status === 'em_andamento' ? 0 : 1)
        if (t !== 0) return t
        if (ordenacao === 'az') return nomeDe(a).localeCompare(nomeDe(b), 'pt-BR', { sensitivity: 'base' })
        if (ordenacao === 'za') return nomeDe(b).localeCompare(nomeDe(a), 'pt-BR', { sensitivity: 'base' })
        if (ordenacao === 'antigo') return a.data_evento.localeCompare(b.data_evento)
        return b.data_evento.localeCompare(a.data_evento) // recente (default)
      })
  }, [atendimentos, busca, statusFiltro, periodo, ordenacao])

  // Seleção múltipla — só relevante na visão "Arquivados" (exclusão em massa).
  const idsArquivados = useMemo(
    () => (verArquivados ? lista.map((l) => l.id) : []),
    [verArquivados, lista],
  )
  const selecao = useSelecaoMultipla(idsArquivados)

  const emAndamentoN = lista.filter((a) => a.status === 'em_andamento').length
  const finalizadosN = lista.filter((a) => a.status === 'finalizado').length
  const subtitle = verArquivados
    ? `${lista.length} ${lista.length === 1 ? 'arquivado' : 'arquivados'}`
    : `${emAndamentoN} em andamento · ${finalizadosN} ${finalizadosN === 1 ? 'finalizado' : 'finalizados'}`

  function abrirFicha(item: AtendimentoItem) {
    // item.id é o id do clinical_record — a ficha já existe.
    startTransition(() => router.push(`/ficha/${item.id}`))
  }

  function invalidarListas() {
    queryClient.invalidateQueries({ queryKey: ['atendimentos_lista'] })
    queryClient.invalidateQueries({ queryKey: ['agenda'] })
    queryClient.invalidateQueries({ queryKey: ['atendimentos_ativos'] })
    queryClient.invalidateQueries({ queryKey: ['receitas'] })
  }

  // Arquiva (soft delete) — ficha + receita vão para "Arquivados".
  async function confirmarArquivar() {
    if (!arquivarAlvo) return
    const tinhaReceita = !!arquivarAlvo.prescription_id
    setArquivando(true)
    try {
      const res = await arquivarAtendimento(arquivarAlvo.id)
      if (res.error) {
        toast.error('Erro ao arquivar.')
      } else {
        invalidarListas()
        toast.success(tinhaReceita ? 'Ficha e receita arquivadas.' : 'Ficha arquivada.')
      }
    } finally {
      setArquivando(false)
      setArquivarAlvo(null)
    }
  }

  // Restaura — traz ficha + receita de volta às listas ativas.
  async function handleRestaurar(item: AtendimentoItem) {
    setRestaurandoId(item.id)
    try {
      const res = await restaurarAtendimento(item.id)
      if (res.error) {
        toast.error('Erro ao restaurar.')
      } else {
        invalidarListas()
        toast.success('Ficha restaurada.')
      }
    } finally {
      setRestaurandoId(null)
    }
  }

  // Exclusão definitiva (hard delete) — só a partir de "Arquivados".
  async function confirmarExcluirDefinitivo() {
    if (!excluirAlvo) return
    setExcluindo(true)
    try {
      const res = await excluirAtendimentoCompleto(excluirAlvo.id)
      if (res.error) {
        toast.error('Erro ao excluir.')
      } else {
        invalidarListas()
        toast.success('Ficha excluída definitivamente.')
      }
    } finally {
      setExcluindo(false)
      setExcluirAlvo(null)
    }
  }

  // Exclusão em massa (visão Arquivados).
  async function handleExcluirSelecionados() {
    const res = await excluirAtendimentosEmMassa([...selecao.selecionados])
    if (res.error) {
      toast.error('Erro ao excluir.')
      return
    }
    selecao.limpar()
    invalidarListas()
    toast.success(`${res.total} ${res.total === 1 ? 'ficha excluída' : 'fichas excluídas'}.`)
  }

  async function handleRestaurarSelecionados() {
    const res = await restaurarAtendimentosEmMassa([...selecao.selecionados])
    if (res.error) {
      toast.error('Erro ao restaurar.')
      return
    }
    selecao.limpar()
    invalidarListas()
    toast.success(`${res.total} ${res.total === 1 ? 'ficha restaurada' : 'fichas restauradas'}.`)
  }

  // Botão de ação principal por estado.
  function AcaoPrincipal({ item }: { item: AtendimentoItem }) {
    // Em "Arquivados", a ação principal é restaurar (não abrir a ficha).
    if (verArquivados) {
      return (
        <button
          onClick={() => handleRestaurar(item)}
          disabled={restaurandoId === item.id}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[12px] font-semibold border border-border bg-card hover:bg-muted transition-colors whitespace-nowrap disabled:opacity-60"
        >
          <ArchiveRestore className="h-3.5 w-3.5" />
          {restaurandoId === item.id ? 'Restaurando…' : 'Restaurar'}
        </button>
      )
    }
    if (item.status === 'em_andamento') {
      return (
        <button
          onClick={() => abrirFicha(item)}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[12px] font-semibold bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover transition-colors whitespace-nowrap"
        >
          <Play className="h-3.5 w-3.5" />
          Retomar
        </button>
      )
    }
    return (
      <button
        onClick={() => abrirFicha(item)}
        className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[12px] font-semibold border border-primary/40 text-primary bg-card hover:bg-primary/10 transition-colors whitespace-nowrap"
      >
        Ver ficha
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    )
  }

  // Acesso direto à receita gerada (só ficha finalizada com prescrição).
  // Escondido em "Arquivados" (a receita também está arquivada).
  // CA11: abre a tela de receita dedicada (/receitas/[id]), não mais o PDF cru.
  function ReceitaLink({ item }: { item: AtendimentoItem }) {
    if (verArquivados || !item.prescription_id) return null
    return (
      <button
        type="button"
        onClick={() => router.push(`/receitas/${item.prescription_id}`)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium border border-border bg-card text-status-ok hover:bg-status-ok-bg transition-colors whitespace-nowrap"
        title="Ver a receita gerada"
      >
        <FileText className="h-3.5 w-3.5" />
        Receita
      </button>
    )
  }

  // Menu de ações secundárias.
  function AcoesMenu({ item }: { item: AtendimentoItem }) {
    // Monta array de itens visíveis para intercalar separadores corretamente
    // (evita separadores órfãos quando itens condicionais estão ocultos)
    const itensVisiveis: React.ReactNode[] = []

    // Ver perfil — sempre presente
    itensVisiveis.push(
      <DropdownMenuItem key="perfil" onClick={() => router.push(`/pacientes/${item.patient_id}`)}>
        <User className="mr-2 h-4 w-4" />
        Ver perfil
      </DropdownMenuItem>
    )

    // Receita — só em ativos com prescrição
    if (!verArquivados && item.prescription_id) {
      itensVisiveis.push(
        <DropdownMenuItem
          key="receita"
          onClick={() => router.push(`/receitas/${item.prescription_id}`)}
        >
          <FileText className="mr-2 h-4 w-4" />
          Receita
        </DropdownMenuItem>
      )
    }

    // Item destrutivo por último (Arquivar ou Excluir definitivamente)
    if (verArquivados) {
      itensVisiveis.push(
        <DropdownMenuItem key="excluir" onClick={() => setExcluirAlvo(item)} variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir definitivamente
        </DropdownMenuItem>
      )
    } else {
      itensVisiveis.push(
        <DropdownMenuItem key="arquivar" onClick={() => setArquivarAlvo(item)} variant="destructive">
          <Archive className="mr-2 h-4 w-4" />
          Arquivar ficha
        </DropdownMenuItem>
      )
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Mais ações"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
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

  // Pílula de status da ficha.
  function StatusPill({ status }: { status: AtendimentoItem['status'] }) {
    if (status === 'em_andamento') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary whitespace-nowrap">
          <Timer className="h-3 w-3" />
          Em andamento
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-status-ok-bg text-status-ok whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3" />
        Finalizado
      </span>
    )
  }

  const chipClass = (ativo: boolean) =>
    `h-8 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
      ativo
        ? 'bg-primary text-primary-foreground'
        : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
    }`

  // Chips de status — reutilizados no desktop (ao lado do período) e no mobile (linha abaixo).
  const statusChips = (
    <>
      <span className="text-xs text-muted-foreground mr-0.5">Status:</span>
      {STATUS_FILTROS.map(({ key, label }) => (
        <button key={key} onClick={() => setStatusFiltro(key)} className={chipClass(statusFiltro === key)}>
          {label}
        </button>
      ))}
    </>
  )

  return (
    <div>
      {/* Cabeçalho — mesma moldura do Pacientes */}
      <PageHeader
        hero
        title="Ficha Clínica"
        subtitle={subtitle}
        actions={<div className="hidden md:block"><NovoAtendimentoMenu variant="compact" pularEscolha /></div>}
        className="mb-1 md:mb-6"
      />

      {/* Toolbar — busca + ordenar · chips de período */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              placeholder="Buscar por paciente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted text-sm placeholder:text-muted-foreground border border-border focus:bg-card focus:outline-none focus:ring-1 focus:ring-border"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">{SORT_LABEL[ordenacao]}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {ORDENACOES.map((o) => (
                <DropdownMenuItem key={o} onClick={() => setOrdenacao(o)} className="justify-between">
                  {SORT_LABEL[o]}
                  {ordenacao === o && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-4 overflow-x-auto flex-1 min-w-0">
            {/* Período */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-muted-foreground mr-0.5">Período:</span>
              {PERIODOS.map(({ key, label }) => (
                <button key={key} onClick={() => setPeriodo(key)} className={chipClass(periodo === key)}>
                  {label}
                </button>
              ))}
            </div>
            {/* Status — ao lado do período no desktop; no mobile vai pra linha de baixo */}
            <div className="hidden md:flex items-center gap-1.5 shrink-0">
              {statusChips}
            </div>
          </div>
          {/* Alterna entre fichas ativas e arquivadas (mesmo padrão de Pacientes). */}
          <button
            onClick={() => setVerArquivados((v) => !v)}
            className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              verArquivados
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }`}
            aria-pressed={verArquivados}
          >
            <Archive className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Arquivados</span>
          </button>
        </div>

        {/* Status — só no mobile, abaixo do período */}
        <div className="flex md:hidden items-center gap-1.5 overflow-x-auto">
          {statusChips}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="mt-5 md:mt-8">
        {isLoading ? (
          <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-b-0">
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                <div className="h-4 w-28 rounded bg-muted animate-pulse ml-auto" />
              </div>
            ))}
          </div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">
                {verArquivados
                  ? 'Nenhuma ficha arquivada.'
                  : busca.trim()
                    ? 'Nenhuma ficha encontrada.'
                    : 'Nenhuma ficha ainda.'}
              </p>
              {!verArquivados && (
                <p className="text-[13px] text-muted-foreground mt-1">
                  {busca.trim()
                    ? 'Ajuste a busca ou o período.'
                    : 'Use "Nova Ficha" para um encaixe ou para agendar.'}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Barra de exclusão em massa — só nos Arquivados */}
            {verArquivados && (
              <BarraSelecaoMassa
                qtdSelecionada={selecao.qtd}
                todosSelecionados={selecao.todosSelecionados}
                onAlternarTodos={selecao.alternarTodos}
                onExcluirSelecionados={handleExcluirSelecionados}
                onRestaurarSelecionados={handleRestaurarSelecionados}
                entidadeSingular="ficha"
                entidadePlural="fichas"
              />
            )}

            {/* Tabela — desktop */}
            <div className="hidden md:block bg-card rounded-xl border border-border shadow-xs overflow-hidden">
              <table className="w-full table-fixed text-left">
                <colgroup>
                  <col className="w-[23%]" />
                  <col className="w-[17%]" />
                  <col className="w-[18%]" />
                  <col className="w-[16%]" />
                  <col className="w-[26%]" />
                </colgroup>
                <thead>
                  <tr className="text-eyebrow border-b border-border bg-muted/30">
                    <th className="px-5 py-2.5 font-medium text-left">Paciente</th>
                    <th className="px-5 py-2.5 font-medium text-left">Tipo</th>
                    <th className="px-5 py-2.5 font-medium text-left">Data</th>
                    <th className="px-5 py-2.5 font-medium text-left">Status</th>
                    <th className="px-5 py-2.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((item) => {
                    const live = item.status === 'em_andamento'
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-border last:border-b-0 transition-colors ${
                          live ? 'bg-primary/[0.05] hover:bg-primary/10' : 'hover:bg-muted/50'
                        }`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {verArquivados && (
                              <input
                                type="checkbox"
                                checked={selecao.estaSelecionado(item.id)}
                                onChange={() => selecao.toggle(item.id)}
                                aria-label={`Selecionar ${nomeDe(item)}`}
                                className="h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
                              />
                            )}
                            <div className={`w-8 h-8 rounded-full ${avatarColor(nomeDe(item))} text-white text-[11px] grid place-items-center font-semibold shrink-0`}>
                              {iniciais(nomeDe(item))}
                            </div>
                            <span className="text-sm font-medium text-foreground truncate">{nomeDe(item)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-[13px] text-muted-foreground truncate">
                          {tipoLabel(item)}
                        </td>
                        <td className="px-5 py-3 text-[13px] text-muted-foreground">
                          <div className="flex flex-col leading-tight">
                            <span className="whitespace-nowrap">{formatarDataCompacta(item.data_evento)}</span>
                            <span className="text-[11px] text-muted-foreground/70 tabular-nums">{formatarHoraBR(item.data_evento)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <StatusPill status={item.status} />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <ReceitaLink item={item} />
                            <AcaoPrincipal item={item} />
                            <AcoesMenu item={item} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Cartões — mobile */}
            <div className="md:hidden flex flex-col gap-2.5">
              {lista.map((item) => {
                const live = item.status === 'em_andamento'
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                      live ? 'border-primary/40 bg-primary/[0.05]' : 'border-border bg-card'
                    }`}
                  >
                    {verArquivados && (
                      <input
                        type="checkbox"
                        checked={selecao.estaSelecionado(item.id)}
                        onChange={() => selecao.toggle(item.id)}
                        aria-label={`Selecionar ${nomeDe(item)}`}
                        className="h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
                      />
                    )}
                    <div className={`w-9 h-9 rounded-full ${avatarColor(nomeDe(item))} text-white text-[12px] grid place-items-center font-semibold shrink-0`}>
                      {iniciais(nomeDe(item))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-foreground truncate">{nomeDe(item)}</div>
                      <div className="text-[11.5px] text-muted-foreground truncate mt-1 flex items-center gap-1.5">
                        <StatusPill status={item.status} />
                        <span className="tabular-nums">· {formatarDataCompacta(item.data_evento)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <AcaoPrincipal item={item} />
                      <AcoesMenu item={item} />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* FAB — mobile: abre o menu com as 3 opções (Atender agora · Adiantar · Agendar) */}
      <div className="fixed bottom-20 right-5 z-30 md:hidden">
        <NovoAtendimentoMenu variant="fab" pularEscolha />
      </div>

      {/* Arquivar (reversível) — leva ficha + receita para "Arquivados". */}
      <ConfirmDialog
        open={!!arquivarAlvo}
        onOpenChange={(open) => !open && setArquivarAlvo(null)}
        titulo="Arquivar ficha?"
        descricao={
          arquivarAlvo?.prescription_id
            ? `A ficha de ${nomeDe(arquivarAlvo)} e a receita gerada serão arquivadas — saem da lista de fichas e de receitas, mas ficam preservadas. É reversível em "Arquivados".`
            : `A ficha de ${arquivarAlvo ? nomeDe(arquivarAlvo) : 'paciente'} será arquivada — sai da lista de fichas, mas fica preservada. É reversível em "Arquivados".`
        }
        labelConfirmar="Arquivar"
        variante="destrutivo"
        carregando={arquivando}
        onConfirmar={confirmarArquivar}
      />

      {/* Exclusão definitiva (hard delete) — disparada a partir de "Arquivados". */}
      <ConfirmDialog
        open={!!excluirAlvo}
        onOpenChange={(open) => !open && setExcluirAlvo(null)}
        titulo="Excluir definitivamente?"
        descricao={`A ficha de ${excluirAlvo ? nomeDe(excluirAlvo) : 'paciente'} e a receita gerada serão apagadas para sempre. Esta ação não pode ser desfeita.`}
        labelConfirmar="Excluir tudo"
        variante="destrutivo"
        carregando={excluindo}
        onConfirmar={confirmarExcluirDefinitivo}
      />
    </div>
  )
}
