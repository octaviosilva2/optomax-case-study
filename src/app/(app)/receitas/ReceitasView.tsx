'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  Search,
  FileText,
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  Archive,
  ArchiveRestore,
  Trash2,
  Check,
  Loader2,
  MoreVertical,
  User,
  Play,
  Timer,
  CheckCircle2,
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
import { BarraSelecaoMassa } from '@/components/arquivados/BarraSelecaoMassa'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/EmptyState'
import QuickPrescriptionModal from '@/components/receitas/QuickPrescriptionModal'
import { useReceitas, useReceitasArquivadas } from '@/hooks/useReceitas'
import { useSelecaoMultipla } from '@/hooks/useSelecaoMultipla'
import {
  restaurarReceita,
  restaurarPrescricoesEmMassa,
  excluirPrescricaoDefinitiva,
  excluirPrescricoesEmMassa,
} from '@/app/(app)/receitas/actions'
import { obterGrauEstruturado, type DadosPrescricaoGrau } from '@/lib/utils/grau'
import { avatarColor, iniciais } from '@/lib/utils/avatar'
import { formatarDataCompacta, formatarHoraBR } from '@/lib/utils/data'
import NovaReceitaMenu from '@/components/receitas/NovaReceitaMenu'
import { parseISO, isToday, isThisWeek, isThisMonth } from 'date-fns'

// Estrutura mínima dos dados de prescrição relevantes para a UI da lista.
type DadosPrescricaoLista = {
  od?: { esf?: string | number | null; cil?: string | number | null } | null
  oe?: { esf?: string | number | null; cil?: string | number | null } | null
}

// Item exportado: a page faz o cast no boundary server→client.
export type ReceitaListaItem = {
  id: string
  tipo: string
  prescription_type: string
  created_at: string
  patient_id: string
  dados_prescricao: DadosPrescricaoLista | null
  // Reorganização "Novo Atendimento" (CA7): presente = receita nasceu de uma
  // ficha (botão "Ver ficha"); ausente = quick/standalone (botão "Editar").
  clinical_record_id: string | null
  // B3 (CA20): rascunho avulso ainda em preenchimento — sem PDF/WhatsApp
  // (edge case 4); vinculada nunca é rascunho (CA24), sempre 'finalizada'.
  status: 'rascunho' | 'finalizada'
  patients: { id: string; nome: string; whatsapp: string | null } | null
}

type Props = {
  initialData: ReceitaListaItem[]
}

// ── Ordenação ───────────────────────────────────────────────────────────────
type Ordenacao = 'recent' | 'old' | 'az'
const ORDENACOES: Ordenacao[] = ['recent', 'old', 'az']
const SORT_LABEL: Record<Ordenacao, string> = {
  recent: 'Mais recentes',
  old: 'Mais antigas',
  az: 'Por paciente',
}
const SORT_KEY = 'optomax_receitas_sort'

// ── Filtro de período ────────────────────────────────────────────────────────
type FiltroPeriodo = 'todas' | 'hoje' | 'semana' | 'mes'


// Pílula de status da receita (espelha StatusPill de AtendimentoCentral.tsx —
// mesmo padrão visual da lista de fichas, CA27).
function StatusPill({ status }: { status: ReceitaListaItem['status'] }) {
  if (status === 'rascunho') {
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

// Texto da coluna Tipo — deriva de clinical_record_id (CA26).
// Exportada (B4-S3, testes): função pura top-level, sem estado/JSX — é o alvo
// direto do teste unitário de derivação de Tipo (evita contrato espelhado).
export function tipoReceitaLabel(rx: Pick<ReceitaListaItem, 'clinical_record_id'>): string {
  return rx.clinical_record_id ? 'Receita (com ficha)' : 'Receita (sem ficha)'
}

/**
 * Componente auxiliar para exibir grau estruturado — compartilhado desktop + mobile.
 * Formato inline compacto numa linha só: "OD ESF +0,50 | OE ESF +0,50" (só esférico — CIL não aparece na lista).
 * Mantém a linha do paciente fina (sem o mini-grid de 3 linhas).
 */
function GrauInline({ dados }: { dados: DadosPrescricaoLista | null }) {
  const grau = obterGrauEstruturado(dados as DadosPrescricaoGrau)

  if (grau.ambosVazios) {
    return <span className="text-muted-foreground">—</span>
  }

  // Uma linha por olho, com colunas de largura fixa para OD e OE ficarem alinhados entre si.
  const Olho = ({ label, olho }: { label: string; olho: typeof grau.od }) => {
    if (olho.vazio) return null
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-6 text-[10px] font-semibold text-muted-foreground">{label}</span>
        <span className="text-[9px] text-muted-foreground/70 uppercase">ESF</span>
        <span className="w-12 text-right text-[12px] tabular-nums font-mono">{olho.esf}</span>
      </div>
    )
  }

  const temOD = !grau.od.vazio
  const temOE = !grau.oe.vazio

  // flex justify-center centraliza o bloco na coluna; o bloco interno encolhe ao
  // conteúdo, mantendo OD e OE alinhados entre si pelas larguras fixas das colunas.
  return (
    <div className="flex justify-center text-foreground">
      <div className="flex flex-col gap-0.5">
        {temOD && <Olho label="OD" olho={grau.od} />}
        {temOE && <Olho label="OE" olho={grau.oe} />}
      </div>
    </div>
  )
}

export default function ReceitasView({ initialData }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  // Estados de UI
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('todas')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('recent')
  const [verArquivadas, setVerArquivadas] = useState(false)
  const [isQuickOpen, setIsQuickOpen] = useState(false)

  // Estados para arquivar/restaurar
  // B2 (CA16): clinicalRecordId decide o aviso da ConfirmDialog (vinculada
  // cascateia p/ a ficha; avulsa arquiva só a receita).
  const [rxParaArquivar, setRxParaArquivar] = useState<{ id: string; nome: string; clinicalRecordId: string | null } | null>(null)
  const [arquivando, setArquivando] = useState(false)
  const [rxExcluirDef, setRxExcluirDef] = useState<string | null>(null)
  const [excluindoDef, setExcluindoDef] = useState(false)

  // Abre modal quando ?nova=1 está na URL
  useEffect(() => {
    if (searchParams.get('nova') === '1') {
      setIsQuickOpen(true)
    }
  }, [searchParams])

  // Lê ordenação salva (client-only)
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(SORT_KEY)
      if (salvo && (ORDENACOES as string[]).includes(salvo)) {
        setOrdenacao(salvo as Ordenacao)
      }
    } catch { /* ignore */ }
  }, [])

  // Debounce de busca
  useEffect(() => {
    const timer = setTimeout(() => setTermo(busca), 300)
    return () => clearTimeout(timer)
  }, [busca])

  // Dados das receitas
  const { receitas: receitasRaw = initialData, isLoading, arquivarReceita } = useReceitas()
  const { data: arquivadasRaw = [], isLoading: loadingArquivadas } = useReceitasArquivadas(verArquivadas)

  // Fonte conforme visão
  const fonteRaw = (verArquivadas ? arquivadasRaw : receitasRaw) as ReceitaListaItem[]

  // Filtro + ordenação
  const receitas = useMemo(() => {
    // Filtro por busca (nome do paciente)
    let filtered = fonteRaw.filter((rx) => {
      const name = rx.patients?.nome || 'Paciente'
      return !termo.trim() || name.toLowerCase().includes(termo.toLowerCase())
    })

    // Filtro por período
    if (filtroPeriodo !== 'todas') {
      filtered = filtered.filter((rx) => {
        const date = parseISO(rx.created_at)
        switch (filtroPeriodo) {
          case 'hoje':
            return isToday(date)
          case 'semana':
            return isThisWeek(date, { weekStartsOn: 0 })
          case 'mes':
            return isThisMonth(date)
          default:
            return true
        }
      })
    }

    // Ordenação
    return filtered.sort((a, b) => {
      switch (ordenacao) {
        case 'recent':
          return b.created_at.localeCompare(a.created_at)
        case 'old':
          return a.created_at.localeCompare(b.created_at)
        case 'az':
          return (a.patients?.nome || '').localeCompare(b.patients?.nome || '', 'pt-BR', { sensitivity: 'base' })
        default:
          return 0
      }
    })
  }, [fonteRaw, termo, filtroPeriodo, ordenacao])

  const total = receitas.length
  const filtrando = !!termo || filtroPeriodo !== 'todas'

  // Seleção múltipla (só Arquivadas)
  const idsArquivadas = useMemo(
    () => (verArquivadas ? receitas.map((r) => r.id) : []),
    [verArquivadas, receitas],
  )
  const selecao = useSelecaoMultipla(idsArquivadas)

  function mudarOrdenacao(o: Ordenacao) {
    setOrdenacao(o)
    try { localStorage.setItem(SORT_KEY, o) } catch { /* ignore */ }
  }

  function invalidarReceitas() {
    queryClient.invalidateQueries({ queryKey: ['receitas'] })
    queryClient.invalidateQueries({ queryKey: ['receitas_arquivadas'] })
  }

  // Arquivar receita — vinculada cascateia p/ a ficha, avulsa só a receita
  // (decisão já centralizada em arquivarReceita, receitas/actions.ts).
  async function handleArquivar() {
    if (!rxParaArquivar) return
    setArquivando(true)
    try {
      await arquivarReceita(rxParaArquivar.id)
      toast.success('Receita arquivada')
    } catch {
      toast.error('Erro ao arquivar receita')
    } finally {
      setArquivando(false)
      setRxParaArquivar(null)
    }
  }

  // Restaurar receita — simétrico ao arquivar (CA17): vinculada traz a ficha
  // junto, avulsa restaura só a receita.
  async function handleRestaurar(id: string) {
    const res = await restaurarReceita(id)
    if (res.error) {
      toast.error('Erro ao restaurar.')
      return
    }
    invalidarReceitas()
    toast.success('Receita restaurada.')
  }

  // Excluir definitivamente
  async function handleConfirmarExcluirDef() {
    if (!rxExcluirDef) return
    setExcluindoDef(true)
    try {
      const res = await excluirPrescricaoDefinitiva(rxExcluirDef)
      if (res.error) {
        toast.error('Erro ao excluir.')
      } else {
        invalidarReceitas()
        toast.success('Receita excluída definitivamente.')
      }
    } finally {
      setExcluindoDef(false)
      setRxExcluirDef(null)
    }
  }

  // Ações em massa
  async function handleExcluirSelecionados() {
    const res = await excluirPrescricoesEmMassa([...selecao.selecionados])
    if (res.error) {
      toast.error('Erro ao excluir.')
      return
    }
    selecao.limpar()
    invalidarReceitas()
    toast.success(`${res.total} ${res.total === 1 ? 'receita excluída' : 'receitas excluídas'}.`)
  }

  async function handleRestaurarSelecionados() {
    const res = await restaurarPrescricoesEmMassa([...selecao.selecionados])
    if (res.error) {
      toast.error('Erro ao restaurar.')
      return
    }
    selecao.limpar()
    invalidarReceitas()
    toast.success(`${res.total} ${res.total === 1 ? 'receita restaurada' : 'receitas restauradas'}.`)
  }

  // Chip class
  const chipClass = (ativo: boolean) =>
    `h-8 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
      ativo
        ? 'bg-primary text-primary-foreground'
        : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
    }`

  // Loading state
  if (isLoading || (verArquivadas && loadingArquivadas)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <PageHeader
        hero
        title="Receitas e prescrições"
        subtitle={total > 0 ? `${total} receita${total !== 1 ? 's' : ''}` : undefined}
        actions={
          <div className="hidden md:block">
            <NovaReceitaMenu variant="button" />
          </div>
        }
        className="mb-1 md:mb-6"
      />

      {/* Toolbar */}
      <div className="space-y-3">
        {/* Linha 1: busca + ordenação */}
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

        {/* Linha 2: chips de período + arquivadas */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {([
              { key: 'todas', label: 'Todas' },
              { key: 'hoje', label: 'Hoje' },
              { key: 'semana', label: 'Esta semana' },
              { key: 'mes', label: 'Este mês' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFiltroPeriodo(key)}
                className={chipClass(filtroPeriodo === key)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setVerArquivadas((v) => !v); selecao.limpar() }}
            aria-pressed={verArquivadas}
            className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              verArquivadas
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Arquivadas</span>
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="mt-5 md:mt-8">
        {receitas.length === 0 ? (
          <EmptyState
            icon={verArquivadas ? Archive : FileText}
            title={
              verArquivadas
                ? 'Nenhuma receita arquivada'
                : fonteRaw.length === 0
                  ? 'Nenhuma receita'
                  : 'Nenhuma receita encontrada'
            }
            description={
              verArquivadas
                ? 'As receitas arquivadas aparecem aqui.'
                : fonteRaw.length === 0
                  ? 'As receitas são geradas ao finalizar uma ficha.'
                  : 'Ajuste a busca ou os filtros.'
            }
            hint={
              !verArquivadas && fonteRaw.length === 0
                ? "Dica: Ao salvar uma ficha, clique em 'Salvar e ver Receita'."
                : undefined
            }
          />
        ) : (
          <>
            {/* Barra de seleção em massa (só Arquivadas) */}
            {verArquivadas && (
              <BarraSelecaoMassa
                qtdSelecionada={selecao.qtd}
                todosSelecionados={selecao.todosSelecionados}
                onAlternarTodos={selecao.alternarTodos}
                onExcluirSelecionados={handleExcluirSelecionados}
                onRestaurarSelecionados={handleRestaurarSelecionados}
                entidadeSingular="receita"
                entidadePlural="receitas"
              />
            )}

            {/* Tabela desktop */}
            <div className="hidden md:block bg-card rounded-xl border border-border shadow-xs overflow-hidden">
              <table className="w-full table-fixed text-left">
                <colgroup>
                  {/* Paciente | Grau | Tipo | Data | Status | Ação (B4/CA25) */}
                  <col className="w-[19%]" />
                  <col className="w-[17%]" />
                  <col className="w-[16%]" />
                  <col className="w-[11%]" />
                  <col className="w-[16%]" />
                  <col className="w-[21%]" />
                </colgroup>
                <thead>
                  <tr className="text-eyebrow border-b border-border bg-muted/30">
                    <th className="px-5 py-2.5 font-medium text-left">Paciente</th>
                    <th className="px-5 py-2.5 font-medium text-center">Grau</th>
                    <th className="px-5 py-2.5 font-medium text-left">Tipo</th>
                    <th className="px-5 py-2.5 font-medium text-left">Data</th>
                    <th className="px-5 py-2.5 font-medium text-left">Status</th>
                    <th className="px-5 py-2.5 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {receitas.map((rx) => {
                    const nome = rx.patients?.nome || 'Paciente'

                    return (
                      <tr
                        key={rx.id}
                        className={`border-b border-border last:border-b-0 transition-colors ${
                          verArquivadas ? 'opacity-70' : 'hover:bg-muted/50'
                        }`}
                      >
                        {/* Paciente */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {verArquivadas && (
                              <input
                                type="checkbox"
                                checked={selecao.estaSelecionado(rx.id)}
                                onChange={() => selecao.toggle(rx.id)}
                                aria-label={`Selecionar receita de ${nome}`}
                                className="h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
                              />
                            )}
                            <div className={`w-8 h-8 rounded-full ${avatarColor(nome)} text-white text-[11px] grid place-items-center font-semibold shrink-0`}>
                              {iniciais(nome)}
                            </div>
                            <span className="text-sm font-medium text-foreground truncate">{nome}</span>
                          </div>
                        </td>
                        {/* Grau — formato inline compacto (1 linha) com ESF/CIL rotulados */}
                        <td className="px-5 py-3 text-center">
                          <GrauInline dados={rx.dados_prescricao} />
                        </td>
                        {/* Tipo — com/sem ficha vinculada (CA26) */}
                        <td className="px-5 py-3 text-[13px] text-muted-foreground truncate">
                          {tipoReceitaLabel(rx)}
                        </td>
                        {/* Data + Hora — mesmo formato da tela de Atendimento */}
                        <td className="px-5 py-3 text-[13px] text-muted-foreground">
                          <div className="flex flex-col leading-tight">
                            <span className="whitespace-nowrap">{formatarDataCompacta(rx.created_at)}</span>
                            <span className="text-[11px] text-muted-foreground/70 tabular-nums">{formatarHoraBR(rx.created_at)}</span>
                          </div>
                        </td>
                        {/* Status — Finalizado/Em andamento (CA27) */}
                        <td className="px-5 py-3">
                          <StatusPill status={rx.status} />
                        </td>
                        {/* Ação */}
                        <td className="px-5 py-3">
                          {verArquivadas ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleRestaurar(rx.id)}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium border border-border bg-card hover:bg-muted transition-colors whitespace-nowrap"
                              >
                                <ArchiveRestore className="h-3.5 w-3.5" />
                                Restaurar
                              </button>
                              <button
                                onClick={() => setRxExcluirDef(rx.id)}
                                title="Excluir definitivamente"
                                aria-label="Excluir definitivamente"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Botão(ões) por estado (CA28): Retomar (rascunho) · Ficha + Ver receita (vinculada, mesmo padrão da tela de ficha, invertido) · Ver receita (avulsa finalizada) */}
                              {rx.status === 'rascunho' ? (
                                <button
                                  onClick={() => router.push(`/receitas/${rx.id}/editar`)}
                                  className="h-8 px-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover flex items-center gap-1.5 transition-colors text-[12px] font-semibold whitespace-nowrap"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                  <span>Retomar</span>
                                </button>
                              ) : rx.clinical_record_id ? (
                                <>
                                  <button
                                    onClick={() => router.push(`/ficha/${rx.clinical_record_id}`)}
                                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium border border-border bg-card text-status-ok hover:bg-status-ok-bg transition-colors whitespace-nowrap"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    Ficha
                                  </button>
                                  <button
                                    onClick={() => router.push(`/receitas/${rx.id}`)}
                                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold border border-primary/40 text-primary bg-card hover:bg-primary/10 transition-colors whitespace-nowrap"
                                  >
                                    <span className="hidden lg:inline">Ver receita</span>
                                    <span className="lg:hidden">Receita</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => router.push(`/receitas/${rx.id}`)}
                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold border border-primary/40 text-primary bg-card hover:bg-primary/10 transition-colors whitespace-nowrap"
                                >
                                  <span className="hidden lg:inline">Ver receita</span>
                                  <span className="lg:hidden">Receita</span>
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {/* Menu ⋮ enxuto (CA28): só Ver perfil + Arquivar — Baixar/Imprimir/Editar/WhatsApp vivem na tela de destino */}
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                                  aria-label="Mais opções"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/pacientes/${rx.patient_id}`)}
                                  >
                                    <User className="mr-2 h-4 w-4" />
                                    Ver perfil
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setRxParaArquivar({ id: rx.id, nome, clinicalRecordId: rx.clinical_record_id })}
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
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Cartoes mobile */}
            <div className="md:hidden flex flex-col gap-2.5">
              {receitas.map((rx) => {
                const nome = rx.patients?.nome || 'Paciente'

                return (
                  <div
                    key={rx.id}
                    className={`rounded-xl border border-border bg-card p-4 space-y-3 ${
                      verArquivadas ? 'opacity-80' : ''
                    }`}
                  >
                    {/* Topo: nome + data/hora */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {verArquivadas && (
                          <input
                            type="checkbox"
                            checked={selecao.estaSelecionado(rx.id)}
                            onChange={() => selecao.toggle(rx.id)}
                            aria-label={`Selecionar receita de ${nome}`}
                            className="h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
                          />
                        )}
                        <div className={`w-9 h-9 rounded-full ${avatarColor(nome)} text-white text-[12px] grid place-items-center font-semibold shrink-0`}>
                          {iniciais(nome)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium text-foreground truncate">{nome}</div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                            <span className="truncate">{tipoReceitaLabel(rx)}</span>
                            <StatusPill status={rx.status} />
                          </div>
                          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mt-0.5">
                            <span>{formatarDataCompacta(rx.created_at)}</span>
                            <span className="text-muted-foreground/60">·</span>
                            <span className="tabular-nums">{formatarHoraBR(rx.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Grau — formato inline compacto com ESF/CIL rotulados */}
                    <div className="px-3 py-2 rounded-lg bg-muted/50">
                      <GrauInline dados={rx.dados_prescricao} />
                    </div>

                    {/* Acoes */}
                    {verArquivadas ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestaurar(rx.id)}
                          className="flex-1 h-9 rounded-md border border-border bg-card text-[13px] font-medium hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                        >
                          <ArchiveRestore className="h-4 w-4" />
                          Restaurar
                        </button>
                        <button
                          onClick={() => setRxExcluirDef(rx.id)}
                          aria-label="Excluir definitivamente"
                          className="h-9 w-9 rounded-md text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {/* Botão(ões) por estado (CA28): Retomar (rascunho) · Ficha + Ver receita (vinculada, mesmo padrão da tela de ficha, invertido) · Ver receita (avulsa finalizada) */}
                        {rx.status === 'rascunho' ? (
                          <button
                            onClick={() => router.push(`/receitas/${rx.id}/editar`)}
                            className="flex-1 h-9 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover flex items-center justify-center gap-1.5 transition-colors text-[13px] font-semibold whitespace-nowrap"
                          >
                            <Play className="h-4 w-4" />
                            <span>Retomar</span>
                          </button>
                        ) : rx.clinical_record_id ? (
                          <>
                            <button
                              onClick={() => router.push(`/ficha/${rx.clinical_record_id}`)}
                              className="flex-1 h-9 rounded-md border border-border bg-card text-status-ok hover:bg-status-ok-bg flex items-center justify-center gap-1.5 transition-colors text-[13px] font-medium whitespace-nowrap"
                            >
                              <FileText className="h-4 w-4" />
                              Ficha
                            </button>
                            <button
                              onClick={() => router.push(`/receitas/${rx.id}`)}
                              className="flex-1 h-9 rounded-md border border-primary/40 text-primary bg-card hover:bg-primary/10 flex items-center justify-center gap-1.5 transition-colors text-[13px] font-semibold whitespace-nowrap"
                            >
                              Ver receita
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => router.push(`/receitas/${rx.id}`)}
                            className="flex-1 h-9 rounded-md border border-primary/40 text-primary bg-card hover:bg-primary/10 flex items-center justify-center gap-1.5 transition-colors text-[13px] font-semibold whitespace-nowrap"
                          >
                            Ver receita
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        )}
                        {/* Menu ⋮ enxuto (CA28): só Ver perfil + Arquivar — Baixar/Imprimir/Editar/WhatsApp vivem na tela de destino */}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="h-9 w-9 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Mais opcoes"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => router.push(`/pacientes/${rx.patient_id}`)}
                            >
                              <User className="mr-2 h-4 w-4" />
                              Ver perfil
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setRxParaArquivar({ id: rx.id, nome, clinicalRecordId: rx.clinical_record_id })}
                              variant="destructive"
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Arquivar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* FAB mobile — abre menu estilo NovoAtendimentoMenu com 2 opcoes */}
      <div className="fixed bottom-20 right-5 z-30 md:hidden">
        <NovaReceitaMenu variant="fab" />
      </div>

      {/* Modal receita rápida */}
      <QuickPrescriptionModal open={isQuickOpen} onOpenChange={setIsQuickOpen} />

      {/* Confirm arquivar — B2 (CA16): aviso condicional quando a receita é
          vinculada a uma ficha (arquivar cascateia para a ficha também). */}
      <ConfirmDialog
        open={!!rxParaArquivar}
        onOpenChange={(open) => !open && setRxParaArquivar(null)}
        titulo="Arquivar receita?"
        descricao={
          rxParaArquivar?.clinicalRecordId
            ? `A receita e a ficha vinculada de ${rxParaArquivar?.nome || 'Paciente'} serão arquivadas. Reversível em "Arquivadas".`
            : `A receita de ${rxParaArquivar?.nome || 'Paciente'} será arquivada. Você pode restaurá-la depois em "Arquivadas".`
        }
        labelConfirmar="Arquivar"
        variante="destrutivo"
        carregando={arquivando}
        onConfirmar={handleArquivar}
      />

      {/* Confirm excluir definitivo */}
      <ConfirmDialog
        open={!!rxExcluirDef}
        onOpenChange={(open) => !open && setRxExcluirDef(null)}
        titulo="Excluir receita definitivamente?"
        descricao="A receita será apagada para sempre. Esta ação não pode ser desfeita."
        labelConfirmar="Excluir"
        variante="destrutivo"
        carregando={excluindoDef}
        onConfirmar={handleConfirmarExcluirDef}
      />
    </div>
  )
}
