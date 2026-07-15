'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Search,
  Plus,
  Users,
  MoreHorizontal,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Archive,
  ArchiveRestore,
  Calendar,
  MessageCircle,
  Pencil,
  Check,
  Trash2,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { BarraSelecaoMassa } from '@/components/arquivados/BarraSelecaoMassa'
import { useSelecaoMultipla } from '@/hooks/useSelecaoMultipla'
import {
  excluirPacienteDefinitivo,
  excluirPacientesEmMassa,
  restaurarPacientesEmMassa,
} from '@/app/(app)/pacientes/actions'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  usePacientes,
  useExcluirPaciente,
  useRestaurarPaciente,
  useContarHistoricoPaciente,
  type PacienteSimples,
} from '@/hooks/usePacientes'
import { formatarDataCurta, formatarDataRelativa } from '@/lib/utils/data'
import ModalNovoPaciente from './ModalNovoPaciente'
import ModalNovoAgendamento from '@/app/(app)/agenda/ModalNovoAgendamento'
import { avatarColor, iniciais } from '@/lib/utils/avatar'

// Extrai ano/mês/dia em horário Brasília para comparação determinística.
function partesBR(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0')
  return { year: get('year'), month: get('month'), day: get('day') }
}

// Verifica se uma data ISO está dentro de um período relativo a hoje (em BR).
function isDentro(periodo: string, isoDate: string): boolean {
  const d = new Date(isoDate)
  const agora = new Date()
  if (periodo === 'hoje') {
    const a = partesBR(d)
    const b = partesBR(agora)
    return a.year === b.year && a.month === b.month && a.day === b.day
  }
  if (periodo === 'semana') {
    const diffDias = (agora.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    return diffDias >= 0 && diffDias < 7
  }
  if (periodo === 'mes') {
    const a = partesBR(d)
    const b = partesBR(agora)
    return a.month === b.month && a.year === b.year
  }
  return true
}

type Props = {
  initialData: PacienteSimples[]
  orgId: string
}

// ── Ordenação ───────────────────────────────────────────────────────────────
type Ordenacao = 'az' | 'za' | 'recent' | 'old'
const ORDENACOES: Ordenacao[] = ['az', 'za', 'recent', 'old']
const SORT_LABEL: Record<Ordenacao, string> = {
  az: 'Nome (A–Z)',
  za: 'Nome (Z–A)',
  recent: 'Mais recentes',
  old: 'Mais antigos',
}
const SORT_KEY = 'optomax_pacientes_sort'

// Link wa.me a partir do WhatsApp (só dígitos, com DDI 55 se faltar).
function linkWhatsApp(whatsapp: string): string {
  let digitos = whatsapp.replace(/\D/g, '')
  if (!digitos.startsWith('55')) digitos = `55${digitos}`
  return `https://wa.me/${digitos}`
}

export default function PacientesView({ initialData, orgId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [modalAberto, setModalAberto] = useState(false)
  // Exclusão definitiva (hard delete) de um paciente arquivado.
  const [pacienteExcluirDef, setPacienteExcluirDef] = useState<{ id: string; nome: string } | null>(null)
  const [excluindoDef, setExcluindoDef] = useState(false)
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState<'todos' | 'hoje' | 'semana' | 'mes'>('todos')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('az')
  const [verArquivados, setVerArquivados] = useState(false)
  // Data estável p/ o modal de agendamento (evita refetch a cada render).
  const [hoje] = useState(() => new Date())

  // Ações da linha: agendar (modal) e editar (modal de edição)
  const [pacienteAgendar, setPacienteAgendar] = useState<{ id: string; nome: string } | null>(null)
  const [pacienteEditarId, setPacienteEditarId] = useState<string | null>(null)

  // Arquivar (soft delete) e restaurar
  const arquivarPaciente = useExcluirPaciente()
  const restaurarPaciente = useRestaurarPaciente()
  const contarHistorico = useContarHistoricoPaciente()
  const [pacienteParaArquivar, setPacienteParaArquivar] = useState<{
    id: string
    nome: string
    atendimentos: number
    receitas: number
  } | null>(null)

  function pluralizar(n: number, singular: string, plural: string) {
    return `${n} ${n === 1 ? singular : plural}`
  }

  async function handleAbrirConfirmArquivar(id: string, nome: string) {
    try {
      const contagens = await contarHistorico.mutateAsync(id)
      setPacienteParaArquivar({ id, nome, atendimentos: contagens.atendimentos, receitas: contagens.receitas })
    } catch {
      toast.error('Não foi possível verificar o histórico do paciente.')
    }
  }

  async function handleConfirmarArquivar() {
    if (!pacienteParaArquivar) return
    try {
      await arquivarPaciente.mutateAsync(pacienteParaArquivar.id)
      toast.success('Paciente arquivado.')
      setPacienteParaArquivar(null)
    } catch {
      toast.error('Erro ao arquivar paciente.')
    }
  }

  async function handleRestaurar(id: string) {
    try {
      await restaurarPaciente.mutateAsync(id)
      toast.success('Paciente restaurado.')
    } catch {
      toast.error('Erro ao restaurar paciente.')
    }
  }

  function abrirWhatsApp(whatsapp: string | null) {
    if (!whatsapp) return
    window.open(linkWhatsApp(whatsapp), '_blank', 'noopener,noreferrer')
  }

  function mudarOrdenacao(o: Ordenacao) {
    setOrdenacao(o)
    try { localStorage.setItem(SORT_KEY, o) } catch { /* ignore */ }
  }

  function irParaFicha(id: string) {
    if (verArquivados) return // arquivado não abre ficha (some das listagens)
    router.push(`/pacientes/${id}`)
  }

  // Lê a ordenação salva (client-only, evita mismatch de hidratação).
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(SORT_KEY)
      if (salvo && (ORDENACOES as string[]).includes(salvo)) setOrdenacao(salvo as Ordenacao)
    } catch { /* ignore */ }
  }, [])

  // Abre modal quando ?novo=1 está na URL
  useEffect(() => {
    if (searchParams.get('novo') === '1') setModalAberto(true)
  }, [searchParams])

  // Debounce de 300ms
  useEffect(() => {
    const timer = setTimeout(() => setTermo(busca), 300)
    return () => clearTimeout(timer)
  }, [busca])

  const { data: pacientesRaw = [], isLoading } = usePacientes(termo, initialData, verArquivados)

  // Filtro (período de cadastro) + ordenação são independentes e combináveis.
  const pacientes = [...pacientesRaw]
    .filter((p) => (filtroPeriodo === 'todos' ? true : isDentro(filtroPeriodo, p.created_at)))
    .sort((a, b) => {
      switch (ordenacao) {
        case 'az': return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
        case 'za': return b.nome.localeCompare(a.nome, 'pt-BR', { sensitivity: 'base' })
        case 'recent': return b.created_at.localeCompare(a.created_at)
        case 'old': return a.created_at.localeCompare(b.created_at)
        default: return 0
      }
    })

  const total = pacientes.length
  const filtrando = !!termo || filtroPeriodo !== 'todos'
  const rotuloContagem = verArquivados
    ? pluralizar(total, 'arquivado', 'arquivados')
    : pluralizar(total, 'cadastrado', 'cadastrados')

  // Seleção múltipla — só na visão "Arquivados" (exclusão em massa).
  const idsArquivados = useMemo(
    () => (verArquivados ? pacientes.map((p) => p.id) : []),
    [verArquivados, pacientes],
  )
  const selecao = useSelecaoMultipla(idsArquivados)

  function invalidarPacientes() {
    queryClient.invalidateQueries({ queryKey: ['pacientes'] })
    queryClient.invalidateQueries({ queryKey: ['atendimentos'] })
    queryClient.invalidateQueries({ queryKey: ['receitas'] })
  }

  // Exclusão definitiva (hard delete) — apaga paciente + prontuário + receitas.
  async function handleConfirmarExcluirDef() {
    if (!pacienteExcluirDef) return
    setExcluindoDef(true)
    try {
      const res = await excluirPacienteDefinitivo(pacienteExcluirDef.id)
      if (res.error) {
        toast.error('Erro ao excluir.')
      } else {
        invalidarPacientes()
        toast.success('Paciente excluído definitivamente.')
      }
    } finally {
      setExcluindoDef(false)
      setPacienteExcluirDef(null)
    }
  }

  async function handleExcluirSelecionados() {
    const res = await excluirPacientesEmMassa([...selecao.selecionados])
    if (res.error) {
      toast.error('Erro ao excluir.')
      return
    }
    selecao.limpar()
    invalidarPacientes()
    toast.success(`${res.total} ${res.total === 1 ? 'paciente excluído' : 'pacientes excluídos'}.`)
  }

  async function handleRestaurarSelecionados() {
    const res = await restaurarPacientesEmMassa([...selecao.selecionados])
    if (res.error) {
      toast.error('Erro ao restaurar.')
      return
    }
    selecao.limpar()
    invalidarPacientes()
    toast.success(`${res.total} ${res.total === 1 ? 'paciente restaurado' : 'pacientes restaurados'}.`)
  }

  // Chip de filtro (estilo compartilhado)
  const chipClass = (ativo: boolean) =>
    `h-8 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
      ativo
        ? 'bg-primary text-primary-foreground'
        : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
    }`

  return (
    <div>
      {/* Header solto no fundo (sem card), no padrão do dashboard:
          título em serifa + contagem embaixo em text-meta. */}
      <PageHeader
        hero
        title="Pacientes"
        subtitle={total > 0 ? rotuloContagem : undefined}
        actions={
          <button
            className="hidden md:inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground shadow-md hover:bg-primary-hover transition-colors"
            onClick={() => setModalAberto(true)}
          >
            <Plus className="h-4 w-4" />
            Novo paciente
          </button>
        }
        className="mb-1 md:mb-6"
      />

      {/* Toolbar — 2 linhas que não quebram no mobile:
          (1) busca + ordenar · (2) chips de período + alternar arquivados */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              placeholder="Buscar por nome, CPF ou WhatsApp..."
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
            <DropdownMenuContent align="end" className="w-48">
              {ORDENACOES.map((o) => (
                <DropdownMenuItem key={o} onClick={() => mudarOrdenacao(o)} className="justify-between">
                  {SORT_LABEL[o]}
                  {ordenacao === o && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0">
            <span className="text-xs text-muted-foreground shrink-0 mr-0.5">Cadastro:</span>
            {([
              { key: 'todos', label: 'Todos' },
              { key: 'hoje', label: 'Hoje' },
              { key: 'semana', label: 'Esta semana' },
              { key: 'mes', label: 'Este mês' },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setFiltroPeriodo(key)} className={chipClass(filtroPeriodo === key)}>
                {label}
              </button>
            ))}
          </div>
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
      </div>

      {/* Conteúdo — espaço maior aqui cria a hierarquia entre controles e lista */}
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
        ) : pacientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">
                {verArquivados
                  ? 'Nenhum paciente arquivado.'
                  : filtrando
                    ? 'Nenhum paciente encontrado.'
                    : 'Nenhum paciente cadastrado ainda.'}
              </p>
              {!verArquivados && (
                <p className="text-[13px] text-muted-foreground mt-1">
                  {filtrando ? 'Ajuste a busca ou o filtro de período.' : 'Comece cadastrando o primeiro paciente da sua clínica.'}
                </p>
              )}
            </div>
            {!verArquivados && !filtrando && (
              <button
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground shadow-md hover:bg-primary-hover transition-colors mt-2"
                onClick={() => setModalAberto(true)}
              >
                <Plus className="h-4 w-4" />
                Cadastrar primeiro paciente
              </button>
            )}
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
                entidadeSingular="paciente"
                entidadePlural="pacientes"
              />
            )}

            {/* Tabela — desktop (table-fixed = colunas com distâncias uniformes) */}
            <div className="hidden md:block bg-card rounded-xl border border-border shadow-xs overflow-hidden">
              <table className="w-full table-fixed text-left">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[20%]" />
                  <col className="w-[17%]" />
                  <col className="w-[17%]" />
                  <col className="w-[16%]" />
                </colgroup>
                <thead>
                  <tr className="text-eyebrow border-b border-border bg-muted/30">
                    <th className="px-5 py-2.5 font-medium text-left">Nome</th>
                    <th className="px-5 py-2.5 font-medium text-left">WhatsApp</th>
                    <th className="px-5 py-2.5 font-medium text-left">Cadastrado em</th>
                    <th className="px-5 py-2.5 font-medium text-left">Última consulta</th>
                    <th className="px-5 py-2.5 text-right">{verArquivados ? 'Ações' : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {pacientes.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-b border-border last:border-b-0 transition-colors ${
                        verArquivados ? 'opacity-70' : 'hover:bg-muted/50 cursor-pointer'
                      }`}
                      onClick={() => irParaFicha(p.id)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {verArquivados && (
                            <input
                              type="checkbox"
                              checked={selecao.estaSelecionado(p.id)}
                              onChange={() => selecao.toggle(p.id)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Selecionar ${p.nome}`}
                              className="h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
                            />
                          )}
                          <div className={`w-8 h-8 rounded-full ${avatarColor(p.nome)} text-white text-[11px] grid place-items-center font-semibold shrink-0`}>
                            {iniciais(p.nome)}
                          </div>
                          <span className="text-sm font-medium text-foreground truncate">{p.nome}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 tabular-nums text-[13px] text-muted-foreground truncate">
                        {p.whatsapp ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-muted-foreground truncate">
                        {formatarDataCurta(p.created_at)}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-muted-foreground truncate">
                        {formatarDataCurta(p.ultima_consulta)}
                      </td>
                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {verArquivados ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleRestaurar(p.id)}
                              disabled={restaurarPaciente.isPending}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium border border-border bg-card hover:bg-muted transition-colors whitespace-nowrap"
                            >
                              <ArchiveRestore className="h-3.5 w-3.5" />
                              Restaurar
                            </button>
                            <button
                              onClick={() => setPacienteExcluirDef({ id: p.id, nome: p.nome })}
                              title="Excluir definitivamente"
                              aria-label="Excluir definitivamente"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => router.push(`/pacientes/${p.id}`)}
                              className="inline-flex items-center h-8 px-3 rounded-md text-[13px] font-medium border border-border bg-card hover:bg-muted transition-colors whitespace-nowrap"
                            >
                              Ver perfil
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                aria-label="Mais ações"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => setPacienteAgendar({ id: p.id, nome: p.nome })}>
                                  <Calendar className="mr-2 h-4 w-4" />
                                  Agendar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => abrirWhatsApp(p.whatsapp)} disabled={!p.whatsapp}>
                                  <MessageCircle className="mr-2 h-4 w-4" />
                                  WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setPacienteEditarId(p.id)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleAbrirConfirmArquivar(p.id, p.nome)}
                                  disabled={contarHistorico.isPending}
                                  variant="destructive"
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  Arquivar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartões — mobile */}
            <div className="md:hidden flex flex-col gap-2.5">
              {pacientes.map((p) => (
                <div
                  key={p.id}
                  onClick={() => irParaFicha(p.id)}
                  className={`flex items-center gap-3 rounded-xl border border-border bg-card p-3 ${
                    verArquivados ? 'opacity-80' : 'active:bg-muted/60 cursor-pointer'
                  } transition-colors`}
                >
                  {verArquivados && (
                    <input
                      type="checkbox"
                      checked={selecao.estaSelecionado(p.id)}
                      onChange={() => selecao.toggle(p.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Selecionar ${p.nome}`}
                      className="h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
                    />
                  )}
                  <div className={`w-9 h-9 rounded-full ${avatarColor(p.nome)} text-white text-[12px] grid place-items-center font-semibold shrink-0`}>
                    {iniciais(p.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-foreground truncate">{p.nome}</div>
                    <div className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                      {p.whatsapp ?? 'Sem WhatsApp'}
                      {` · ${p.ultima_consulta ? formatarDataRelativa(p.ultima_consulta) : 'Sem consultas'}`}
                    </div>
                  </div>
                  {verArquivados ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestaurar(p.id) }}
                        disabled={restaurarPaciente.isPending}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium border border-border bg-card active:bg-muted transition-colors"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                        Restaurar
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setPacienteExcluirDef({ id: p.id, nome: p.nome }) }}
                        aria-label="Excluir definitivamente"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive active:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* FAB — mobile */}
      <button
        onClick={() => setModalAberto(true)}
        aria-label="Novo paciente"
        className="fixed bottom-20 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      <ModalNovoPaciente open={modalAberto} onOpenChange={setModalAberto} />

      {/* Editar paciente (mesmo modal, modo edição) */}
      <ModalNovoPaciente
        open={!!pacienteEditarId}
        onOpenChange={(o) => { if (!o) setPacienteEditarId(null) }}
        pacienteEditarId={pacienteEditarId ?? undefined}
      />

      {/* Agendar a partir do paciente */}
      <ModalNovoAgendamento
        open={!!pacienteAgendar}
        onOpenChange={(o) => { if (!o) setPacienteAgendar(null) }}
        orgId={orgId}
        dataSelecionada={hoje}
        pacienteInicial={pacienteAgendar ?? undefined}
      />

      <ConfirmDialog
        open={!!pacienteParaArquivar}
        onOpenChange={(open) => !open && setPacienteParaArquivar(null)}
        titulo="Arquivar paciente"
        descricao={
          pacienteParaArquivar
            ? `"${pacienteParaArquivar.nome}" sairá das listagens, mas o cadastro e ${pluralizar(pacienteParaArquivar.atendimentos, 'atendimento', 'atendimentos')} e ${pluralizar(pacienteParaArquivar.receitas, 'receita', 'receitas')} ficam preservados. É reversível em "Arquivados".`
            : ''
        }
        labelConfirmar="Arquivar"
        variante="destrutivo"
        carregando={arquivarPaciente.isPending}
        onConfirmar={handleConfirmarArquivar}
      />

      {/* Exclusão definitiva (hard delete) de um paciente arquivado */}
      <ConfirmDialog
        open={!!pacienteExcluirDef}
        onOpenChange={(open) => !open && setPacienteExcluirDef(null)}
        titulo="Excluir paciente definitivamente?"
        descricao={
          pacienteExcluirDef
            ? `"${pacienteExcluirDef.nome}" e todo o histórico vinculado (atendimentos, fichas e receitas) serão apagados para sempre. Esta ação não pode ser desfeita.`
            : ''
        }
        labelConfirmar="Excluir tudo"
        variante="destrutivo"
        carregando={excluindoDef}
        onConfirmar={handleConfirmarExcluirDef}
      />
    </div>
  )
}
