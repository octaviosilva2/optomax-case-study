'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  TrendingUp,
  FileText,
  CalendarPlus,
  Glasses,
  ClipboardCheck,
  Timer,
  Pencil,
  Archive,
  MoreHorizontal,
  Eye,
  Download,
  Printer,
  MessageCircle,
  Store,
  Loader2,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { excluirAtendimentoAtivo } from '@/app/(app)/agenda/actions'
import { WhatsAppIcon } from '@/components/icons/whatsapp'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/confirm-dialog'
import BotaoNovoAtendimento from '@/components/clinical/BotaoNovoAtendimento'
import ModalNovoAgendamento from '@/app/(app)/agenda/ModalNovoAgendamento'
import FormPaciente from '@/components/FormPaciente'
import { EvolucaoGrau } from '@/components/evolucao/EvolucaoGrau'
import { usePrescricoes, useDeletarPrescricao, type ItemPrescricao } from '@/hooks/usePrescricoes'
import QuickPrescriptionModal from '@/components/receitas/QuickPrescriptionModal'
import { gerarLinkPublicoPrescricao } from '@/app/(app)/ficha/[id]/actions'
import {
  useAtualizarPaciente,
  useExcluirPaciente,
  useContarHistoricoPaciente,
  useHistoricoConsultas,
  useFichasPaciente,
  type PacienteDetalhe,
  type FichaResumo,
} from '@/hooks/usePacientes'
import { calcularIdade } from '@/lib/utils/idade'
import { formatarCPF } from '@/lib/utils/cpf'
import { formatarDataCurta, formatarDataCompacta, formatarHoraBR } from '@/lib/utils/data'
import type { PacienteInput } from '@/lib/validations/paciente'
import { avatarColor, iniciais } from '@/lib/utils/avatar'

type Props = {
  paciente: PacienteDetalhe
  nomeOrigem: string | null
  resumoClinico: string | null
  grauAtual: { od: string | null; oe: string | null }
  ultimaConsultaEm: string | null
}

// Normaliza WhatsApp para formato wa.me
function normalizarNumero(input: string): string | null {
  const digitos = input.replace(/\D/g, '')
  if (!digitos) return null
  return digitos.length <= 11 ? `55${digitos}` : digitos
}

// Formata mensagem com expiração
function formatarMensagemComExpiracao(
  intro: string,
  linkPdf: string,
  expiraEm: Date,
): string {
  const dataFmt = expiraEm.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  return `${intro}\n${linkPdf}\n\nEste link expira em 7 dias (até ${dataFmt}).`
}

// Máscara WhatsApp para input
function mascaraWhatsApp(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

export default function PacienteProfile({
  paciente,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nomeOrigem,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resumoClinico,
  grauAtual,
  ultimaConsultaEm,
}: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"geral" | "dados" | "atendimentos" | "receitas" | "evolucao">("geral")
  const [editMode, setEditMode] = useState(false)
  const [agendarAberto, setAgendarAberto] = useState(false)
  const [confirmExcluirAberto, setConfirmExcluirAberto] = useState(false)
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [filterFichas, setFilterFichas] = useState<"todas" | "finalizadas" | "em_andamento">("todas")
  // Exclusão de ficha — só fichas EM ANDAMENTO (finalizadas têm dados legais, bloqueadas no server)
  const [fichaParaArquivar, setFichaParaArquivar] = useState<string | null>(null)
  const [arquivandoFicha, setArquivandoFicha] = useState(false)

  // Estados para WhatsApp da receita (dropdown e modal ótica)
  const [waMenuId, setWaMenuId] = useState<string | null>(null)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [oticaModal, setOticaModal] = useState<{ id: string } | null>(null)
  const [numeroOtica, setNumeroOtica] = useState('')
  const [enviandoOtica, setEnviandoOtica] = useState(false)
  const numeroOticaValido = numeroOtica.replace(/\D/g, '').length >= 10

  // Prescrição para arquivar (do card de receitas)
  const [prescricaoParaArquivar, setPrescricaoParaArquivar] = useState<string | null>(null)
  // Reorganização "Novo Atendimento" (CA7): receita quick/standalone sendo
  // editada (reabre QuickPrescriptionModal em modo edição).
  const [prescricaoEditando, setPrescricaoEditando] = useState<ItemPrescricao | null>(null)

  const atualizarPaciente = useAtualizarPaciente()
  const excluirPaciente = useExcluirPaciente()
  const contarHistorico = useContarHistoricoPaciente()
  const { data: historico = [] } = useHistoricoConsultas(paciente.id)
  const { data: fichas = [] } = useFichasPaciente(paciente.id)
  const { data: prescricoes = [], isLoading: loadingPrescricoes } = usePrescricoes(paciente.id, paciente.org_id)
  const deletarPrescricao = useDeletarPrescricao()
  // Contagens reais de clinical_records + prescriptions — buscadas on-demand antes de arquivar
  const [contagensExclusao, setContagensExclusao] = useState<{ atendimentos: number; receitas: number } | null>(null)

  // Pluraliza substantivos simples ("1 atendimento" vs "3 atendimentos")
  function pluralizar(n: number, singular: string, plural: string) {
    return `${n} ${n === 1 ? singular : plural}`
  }

  // Abre o modal de arquivamento buscando contagens primeiro
  async function handleAbrirConfirmExcluir() {
    try {
      const contagens = await contarHistorico.mutateAsync(paciente.id)
      setContagensExclusao(contagens)
      setConfirmExcluirAberto(true)
    } catch {
      toast.error('Não foi possível verificar o histórico do paciente.')
    }
  }

  const idade = paciente.data_nascimento
    ? (() => {
        try { return calcularIdade(paciente.data_nascimento!) }
        catch { return null }
      })()
    : null

  const defaultValues: Partial<PacienteInput> = {
    nome: paciente.nome,
    cpf: paciente.cpf ? formatarCPF(paciente.cpf) : '',
    whatsapp: paciente.whatsapp ?? '',
    data_nascimento: paciente.data_nascimento ?? '',
    email: paciente.email ?? '',
    endereco: paciente.endereco ?? '',
    sexo_biologico: paciente.sexo_biologico,
    responsavel_legal: paciente.responsavel_legal ?? '',
    observacoes: paciente.observacoes ?? '',
    origem_id: paciente.origem_id ?? null,
  }

  async function handleSalvarDados(data: PacienteInput) {
    setSalvandoDados(true)
    try {
      await atualizarPaciente.mutateAsync({ id: paciente.id, input: data })
      toast.success('Dados atualizados com sucesso!')
      setEditMode(false)
    } catch {
      toast.error('Erro ao salvar dados. Tente novamente.')
    } finally {
      setSalvandoDados(false)
    }
  }

  // Arquiva a ficha (clinical_record) em andamento. Server bloqueia se finalizada.
  async function handleArquivarFicha() {
    if (!fichaParaArquivar) return
    setArquivandoFicha(true)
    try {
      const res = await excluirAtendimentoAtivo(fichaParaArquivar)
      if (res.error) {
        toast.error(
          res.error === 'AGENDAMENTO_FINALIZADO'
            ? 'Fichas finalizadas não podem ser arquivadas.'
            : 'Erro ao arquivar ficha.',
        )
        return
      }
      toast.success('Ficha arquivada.')
      queryClient.invalidateQueries({ queryKey: ['fichas_paciente'] })
      router.refresh()
    } finally {
      setArquivandoFicha(false)
      setFichaParaArquivar(null)
    }
  }

  // Arquiva prescrição (soft delete)
  async function handleArquivarPrescricao() {
    if (!prescricaoParaArquivar) return
    try {
      await deletarPrescricao.mutateAsync(prescricaoParaArquivar)
      toast.success('Receita arquivada.')
    } catch {
      toast.error('Erro ao arquivar receita.')
    } finally {
      setPrescricaoParaArquivar(null)
    }
  }

  // Normaliza WhatsApp do paciente
  function normalizarWhatsappPaciente(): string | null {
    if (!paciente.whatsapp) return null
    return normalizarNumero(paciente.whatsapp)
  }

  // Enviar receita via WhatsApp para o cliente
  async function handleEnviarReceitaCliente(prescricaoId: string) {
    const numero = normalizarWhatsappPaciente()
    if (!numero) {
      toast.error('Paciente sem WhatsApp cadastrado.')
      return
    }
    setEnviandoId(prescricaoId)
    try {
      const { token, expiraEm, error } = await gerarLinkPublicoPrescricao(prescricaoId)
      if (error || !token) {
        toast.error('Falha ao gerar link público: ' + (error ?? 'desconhecido'))
        return
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const linkPdf = `${origin}/p/${token}`
      const mensagem = formatarMensagemComExpiracao(
        'Olá! Aqui está sua prescrição:',
        linkPdf,
        expiraEm,
      )
      window.open(
        `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`,
        '_blank',
      )
    } finally {
      setEnviandoId(null)
      setWaMenuId(null)
    }
  }

  // Abre modal para enviar para ótica
  function abrirModalOtica(prescricaoId: string) {
    setOticaModal({ id: prescricaoId })
    setNumeroOtica('')
    setWaMenuId(null)
  }

  // Enviar receita via WhatsApp para a ótica
  async function handleEnviarReceitaOtica() {
    if (!oticaModal || !numeroOticaValido) return
    const numero = normalizarNumero(numeroOtica)
    if (!numero) {
      toast.error('Número da ótica inválido.')
      return
    }
    setEnviandoOtica(true)
    try {
      const { token, expiraEm, error } = await gerarLinkPublicoPrescricao(oticaModal.id)
      if (error || !token) {
        toast.error('Falha ao gerar link público: ' + (error ?? 'desconhecido'))
        return
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const linkPdf = `${origin}/p/${token}`
      const mensagem = formatarMensagemComExpiracao(
        `Olá, segue prescrição do paciente ${paciente.nome}:`,
        linkPdf,
        expiraEm,
      )
      window.open(
        `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`,
        '_blank',
      )
      setOticaModal(null)
    } finally {
      setEnviandoOtica(false)
    }
  }

  async function handleExcluirPaciente() {
    try {
      await excluirPaciente.mutateAsync(paciente.id)
      toast.success('Paciente arquivado.')
      router.push('/pacientes')
    } catch {
      toast.error('Erro ao arquivar paciente.')
      setConfirmExcluirAberto(false)
    }
  }

  const whatsappUrl = paciente.whatsapp
    ? (() => {
        const digitos = paciente.whatsapp!.replace(/\D/g, '')
        const completo = digitos.length <= 11 ? `55${digitos}` : digitos
        return `https://wa.me/${completo}`
      })()
    : null

  // Título da ficha: usa o título customizado quando houver, senão fallback pro modelo.
  const fichaLabel = (f: FichaResumo) => {
    const t = f.titulo?.trim()
    if (t) return t
    return f.modelo === 'completo' ? 'Ficha completa' : 'Ficha resumida'
  }

  // Status badge da ficha — padrão compacto da Central de Atendimento.
  function StatusBadgeFicha({ status }: { status: FichaResumo['status'] }) {
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
        <ClipboardCheck className="h-3 w-3" />
        Finalizada
      </span>
    )
  }

  // Renderiza uma ficha clínica no padrão compacto (linha fina, igual à Central de Atendimento).
  // Usado na Visão Geral (Últimas fichas) e na aba Fichas.
  const renderFichaCard = (f: FichaResumo) => {
    const finalizada = f.status === 'finalizado'
    return (
      <div
        key={f.id}
        className={`group flex items-center gap-3 rounded-xl border p-3 transition-colors ${
          !finalizada ? 'border-primary/40 bg-primary/[0.05]' : 'border-border bg-card hover:bg-muted/50'
        }`}
      >
        <div className="flex-1 min-w-0">
          {/* Título: nome customizado da ficha ou modelo */}
          <div className="text-[14px] font-medium text-foreground truncate">
            {fichaLabel(f)}
          </div>
          {/* Status badge + data/hora. flex-wrap evita que a linha estoure por
              baixo do botão de ação em telas estreitas (mobile): quebra a data
              para a linha de baixo em vez de sobrepor. */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-muted-foreground mt-1">
            <StatusBadgeFicha status={f.status} />
            <span className="tabular-nums whitespace-nowrap">
              {formatarDataCompacta(f.data)} · {formatarHoraBR(f.data)}
            </span>
          </div>
        </div>
        {/* Ações */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Botão principal: Continuar (em andamento) ou Ver (finalizada) */}
          {finalizada ? (
            <button
              onClick={() => router.push(`/ficha/${f.id}`)}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[12px] font-semibold border border-primary/40 text-primary bg-card hover:bg-primary/10 transition-colors whitespace-nowrap"
            >
              Ver
            </button>
          ) : (
            <button
              onClick={() => router.push(`/ficha/${f.id}`)}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[12px] font-semibold bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover transition-colors whitespace-nowrap"
            >
              Continuar
            </button>
          )}
          {/* Menu ⋮ com ações secundárias */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Mais ações"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {/* Ficha finalizada: Ver receita + Arquivar */}
              {finalizada && f.prescricaoId && (
                <>
                  <DropdownMenuItem
                    onClick={() => window.open(`/api/prescricao/${f.prescricaoId}`, '_blank')}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Ver receita
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {/* Arquivar — só fichas em andamento (finalizadas têm dados legais, mantidos) */}
              {!finalizada && (
                <DropdownMenuItem
                  onClick={() => setFichaParaArquivar(f.id)}
                  variant="destructive"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Arquivar
                </DropdownMenuItem>
              )}
              {/* Ficha finalizada: Arquivar como ação secundária */}
              {finalizada && (
                <DropdownMenuItem
                  onClick={() => setFichaParaArquivar(f.id)}
                  variant="destructive"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Arquivar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }

  // Indica se o paciente tem WhatsApp cadastrado
  const temWhatsappPaciente = !!normalizarWhatsappPaciente()

  // Renderiza uma receita no padrão compacto (para Visão Geral).
  // Botão: "Ver ficha"/"Editar" (CA7) + "Ver" + menu ⋮ com Baixar, Imprimir,
  // Enviar no WhatsApp, Arquivar. OBS: "Ver perfil" é omitido porque já
  // estamos no perfil (redundante).
  const renderReceitaCompacta = (p: ItemPrescricao) => (
    <div
      key={p.id}
      className="group flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted/50 transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-primary-subtle text-primary flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-foreground truncate">
          Prescrição
        </div>
        <div className="text-[12px] text-muted-foreground mt-0.5 tabular-nums">
          {formatarDataCompacta(p.dataReferencia)}
        </div>
      </div>
      {/* Ações */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Ver ficha (nasceu de uma ficha) ou Editar (quick/standalone) — CA7 */}
        {p.clinical_record_id ? (
          <button
            onClick={() => router.push(`/ficha/${p.clinical_record_id}`)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover transition-colors whitespace-nowrap"
          >
            Ver ficha
          </button>
        ) : (
          <button
            onClick={() => setPrescricaoEditando(p)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold border border-border bg-card hover:bg-muted transition-colors whitespace-nowrap"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        )}
        {/* Botão Ver */}
        <button
          onClick={() => window.open(`/api/prescricao/${p.id}`, '_blank')}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold border border-primary/40 text-primary bg-card hover:bg-primary/10 transition-colors whitespace-nowrap"
        >
          <Eye className="h-3.5 w-3.5" />
          Ver
        </button>
        {/* Menu ⋮ — Baixar, Imprimir, Enviar no WhatsApp, Arquivar */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Mais ações"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onClick={() => window.open(`/api/prescricao/${p.id}?download=1`, '_blank')}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const win = window.open(`/api/prescricao/${p.id}`, '_blank')
                if (win) win.onload = () => win.print()
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Enviar no WhatsApp — submenu expandido inline */}
            <DropdownMenuItem
              onClick={() => handleEnviarReceitaCliente(p.id)}
              disabled={!temWhatsappPaciente}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Enviar para cliente
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => abrirModalOtica(p.id)}>
              <Store className="mr-2 h-4 w-4" />
              Enviar para ótica
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setPrescricaoParaArquivar(p.id)}
              variant="destructive"
            >
              <Archive className="mr-2 h-4 w-4" />
              Arquivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  const renderVisaoGeral = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Coluna principal — Evolução do grau (herói) */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-card rounded-2xl border border-border shadow-[0_2px_12px_rgba(0,0,0,0.01)] p-6 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary-subtle text-primary flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h2 className="text-[16px] font-bold text-foreground">
              Evolução do grau
            </h2>
          </div>
          <EvolucaoGrau patientId={paciente.id} variante="completa" />
        </div>
      </div>

      {/* Coluna lateral — Últimas fichas + Últimas receitas */}
      <div className="lg:col-span-5 space-y-6">
        {/* Card Últimas fichas — padrão compacto da Central de Atendimento */}
        <div className="bg-card rounded-2xl border border-border shadow-[0_2px_12px_rgba(0,0,0,0.01)] p-6 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-[16px] font-bold text-foreground">
              Últimas fichas
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold">
              {fichas.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {fichas.slice(0, 3).map(renderFichaCard)}
            {fichas.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-[13px] font-medium">
                Nenhuma ficha registrada.
              </div>
            )}
          </div>

          {fichas.length > 3 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setActiveTab("atendimentos")}
                className="inline-flex items-center h-7 px-3 rounded-lg text-[13px] font-medium text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                Ver todas
              </button>
            </div>
          )}
        </div>

        {/* Card Últimas receitas — padrão compacto igual à tela de Receitas */}
        <div className="bg-card rounded-2xl border border-border shadow-[0_2px_12px_rgba(0,0,0,0.01)] p-6 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary-subtle text-primary flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="text-[16px] font-bold text-foreground">
              Últimas receitas
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold">
              {prescricoes.length}
            </span>
          </div>

          {loadingPrescricoes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : prescricoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground border border-dashed border-border">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-[13px] text-muted-foreground font-medium">Nenhuma receita emitida.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {prescricoes.slice(0, 3).map(renderReceitaCompacta)}
            </div>
          )}

          {prescricoes.length > 3 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setActiveTab("receitas")}
                className="inline-flex items-center h-7 px-3 rounded-lg text-[13px] font-medium text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                Ver todas
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderFichas = () => {
    const filtros = [
      { v: 'todas', label: 'Todas' },
      { v: 'finalizadas', label: 'Finalizadas' },
      { v: 'em_andamento', label: 'Em andamento' },
    ] as const
    const lista = fichas.filter((f) =>
      filterFichas === 'todas'
        ? true
        : filterFichas === 'finalizadas'
          ? f.status === 'finalizado'
          : f.status === 'em_andamento',
    )

    return (
      <div className="bg-card rounded-2xl border border-border shadow-[0_2px_12px_rgba(0,0,0,0.01)] p-6">
        {/* Chips com scroll-x no mobile (não quebram linha) */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1 md:flex-wrap">
          {filtros.map((f) => (
            <button
              key={f.v}
              onClick={() => setFilterFichas(f.v)}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all ${
                filterFichas === f.v
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {lista.map(renderFichaCard)}
          {lista.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-[14px] font-medium">
              Nenhuma ficha encontrada.
            </div>
          )}
        </div>
      </div>
    )
  };

  const renderEvolucao = () => (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <EvolucaoGrau patientId={paciente.id} variante="completa" />
      </div>
    </div>
  );

  const renderDadosPessoais = () => {
    // Valores derivados — null = vazio (renderiza "Não informado" em muted)
    const dataNascimento = paciente.data_nascimento
      ? new Date(paciente.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
      : null
    const nascimentoLabel = dataNascimento
      ? (idade !== null ? `${dataNascimento} · ${idade} anos` : dataNascimento)
      : null
    const sexoLabel =
      paciente.sexo_biologico === 'M' ? 'Masculino'
        : paciente.sexo_biologico === 'F' ? 'Feminino'
        : null
    const pacienteDesde = new Date(paciente.created_at).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric',
    })

    // Render de um campo label/valor; fullWidth ocupa as 2 colunas (ex: observações)
    const campo = (label: string, value: string | null, fullWidth = false) => (
      <div key={label} className={fullWidth ? 'md:col-span-2' : undefined}>
        <div className="text-[13px] text-muted-foreground font-semibold mb-1.5">
          {label}
        </div>
        <div className={`text-[14px] font-semibold ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {value ?? 'Não informado'}
        </div>
      </div>
    )

    const tituloSecao = 'text-xs uppercase tracking-wide text-muted-foreground font-semibold pb-2 mb-4 border-b border-border'
    const gridSecao = 'grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6'

    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8 relative">
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="absolute top-6 right-6 md:top-8 md:right-8 h-9 px-4 text-[13px] font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" /> Editar dados
          </button>
        )}

        <h2 className="text-[18px] font-bold text-foreground mb-8">
          Dados Pessoais
        </h2>

        {editMode ? (
          <div className="max-w-3xl">
            <FormPaciente
              defaultValues={defaultValues}
              onSubmit={handleSalvarDados}
              submitLabel="Salvar alterações"
              loading={salvandoDados}
              onCancel={() => setEditMode(false)}
            />
          </div>
        ) : (
          <div className="space-y-8 max-w-3xl">
            <section>
              <h3 className={tituloSecao}>Identificação</h3>
              <div className={gridSecao}>
                {campo('Nome completo', paciente.nome)}
                {campo('Data de nascimento', nascimentoLabel)}
                {campo('CPF', paciente.cpf ? formatarCPF(paciente.cpf) : null)}
                {campo('Sexo biológico', sexoLabel)}
              </div>
            </section>

            <section>
              <h3 className={tituloSecao}>Contato</h3>
              <div className={gridSecao}>
                {campo('WhatsApp', paciente.whatsapp || null)}
                {campo('E-mail', paciente.email || null)}
                {campo('Endereço', paciente.endereco || null, true)}
              </div>
            </section>

            <section>
              <h3 className={tituloSecao}>Outros</h3>
              <div className={gridSecao}>
                {campo('Paciente desde', pacienteDesde)}
                {campo('Observações', paciente.observacoes || null, true)}
              </div>
            </section>
          </div>
        )}

        {!editMode && (
          <div className="mt-12 pt-6 border-t border-border">
            <button
              onClick={handleAbrirConfirmExcluir}
              disabled={contarHistorico.isPending}
              className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Archive className="w-4 h-4" />
              {contarHistorico.isPending ? 'Verificando...' : 'Arquivar paciente'}
            </button>
            <p className="text-[12px] text-muted-foreground mt-2">
              Pacientes arquivados saem das listas, mas o histórico é mantido.
            </p>
          </div>
        )}
      </div>
    )
  };

  // Renderiza uma receita no padrão completo (para aba Receitas).
  // Mesmo layout visual da tela de Receitas (ReceitasView.tsx):
  // Ver + WhatsApp (verde) + ⋮ com Baixar, Imprimir, Arquivar
  // OBS: "Ver perfil" é omitido porque já estamos no perfil (redundante).
  const renderReceitaCompleta = (p: ItemPrescricao) => (
    <div
      key={p.id}
      className="group relative rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:border-primary/15 hover:shadow-sm hover:bg-muted/50 transition-all duration-300"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-primary-subtle text-primary flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
          <FileText className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-foreground transition-colors duration-200 group-hover:text-primary flex items-center gap-2">
            Prescrição
            {p.prescription_type === 'quick' ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-status-warning/10 text-status-warning shrink-0 border border-status-warning/30">
                Rápida
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary-subtle text-primary shrink-0 border border-primary/20">
                Completa
              </span>
            )}
          </div>
          <div className="text-[13px] text-muted-foreground mt-0.5 tabular-nums">{formatarDataCurta(p.dataReferencia)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end sm:ml-auto">
        {/* Ver ficha (nasceu de uma ficha) ou Editar (quick/standalone) — CA7 */}
        {p.clinical_record_id ? (
          <button
            onClick={() => router.push(`/ficha/${p.clinical_record_id}`)}
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary-hover flex items-center gap-1.5 transition-all duration-200 active:scale-[0.97] shadow-sm"
          >
            Ver ficha
          </button>
        ) : (
          <button
            onClick={() => setPrescricaoEditando(p)}
            className="h-8 px-3 rounded-md border border-border bg-card text-foreground text-[13px] font-semibold hover:bg-muted hover:border-primary/20 hover:text-primary flex items-center gap-1.5 transition-all duration-200 active:scale-[0.97] shadow-sm"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
        )}
        {/* Ver PDF */}
        <button
          onClick={() => window.open(`/api/prescricao/${p.id}`, '_blank')}
          className="h-8 px-3 rounded-md border border-border bg-card text-foreground text-[13px] font-semibold hover:bg-muted hover:border-primary/20 hover:text-primary flex items-center gap-1.5 transition-all duration-200 active:scale-[0.97] shadow-sm"
        >
          <Eye className="w-4 h-4" />
          Ver PDF
        </button>

        {/* WhatsApp dropdown — botão verde com submenu de opções */}
        <div className="relative" data-wa-menu>
          <button
            onClick={() => setWaMenuId(waMenuId === p.id ? null : p.id)}
            disabled={enviandoId === p.id}
            className="h-8 px-3.5 rounded-md bg-status-ok text-white text-[13px] font-semibold hover:bg-status-ok/90 flex items-center gap-1.5 transition-all duration-200 active:scale-[0.97] shadow-sm disabled:opacity-50"
            title="Enviar no WhatsApp"
          >
            {enviandoId === p.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <WhatsAppIcon className="h-4 w-4" />
            )}
            Enviar no WhatsApp
          </button>
          {waMenuId === p.id && (
            <div
              data-wa-menu
              className="absolute right-0 top-full mt-1 z-30 w-52 rounded-xl bg-popover border border-border shadow-lg p-1.5"
            >
              <button
                type="button"
                onClick={() => handleEnviarReceitaCliente(p.id)}
                disabled={!temWhatsappPaciente}
                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px] text-foreground">Enviar para cliente</span>
              </button>
              <button
                type="button"
                onClick={() => abrirModalOtica(p.id)}
                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Store className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px] text-foreground">Enviar para ótica</span>
              </button>
            </div>
          )}
        </div>

        {/* Menu ⋮ — Baixar, Imprimir, Arquivar */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Mais ações"
            className="absolute top-3 right-3 sm:static w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() => window.open(`/api/prescricao/${p.id}?download=1`, '_blank')}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const win = window.open(`/api/prescricao/${p.id}`, '_blank')
                if (win) win.onload = () => win.print()
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setPrescricaoParaArquivar(p.id)}
              variant="destructive"
            >
              <Archive className="mr-2 h-4 w-4" />
              Arquivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  const renderReceitas = () => (
    <div className="bg-card rounded-2xl border border-border shadow-[0_2px_12px_rgba(0,0,0,0.01)] p-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-primary-subtle text-primary flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4" />
        </div>
        <h2 className="text-[16px] font-bold text-foreground">
          Receitas
        </h2>
      </div>

      {loadingPrescricoes ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : prescricoes.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border shadow-[0_2px_12px_rgba(0,0,0,0.01)] p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-subtle text-primary flex items-center justify-center mx-auto mb-4 shadow-inner">
            <FileText className="w-6 h-6" />
          </div>
          <div className="text-[14px] font-bold text-foreground">
            Nenhuma receita emitida ainda
          </div>
          <div className="text-[13px] text-muted-foreground mt-1 max-w-[280px] mx-auto">
            As receitas aparecem aqui após finalizar um atendimento.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {prescricoes.map(renderReceitaCompleta)}
        </div>
      )}
    </div>
  );

  const agendados = historico.filter(h => h.status === 'agendado' || h.status === 'confirmado')

  // Formato curto dd/mm/aa em horário Brasília — caber no mobile sem cortar
  function formatarDataStat(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  }

  const proximoAtendimento = agendados.length > 0
    ? formatarDataStat(Math.min(...agendados.map(h => new Date(h.data_hora).getTime())))
    : '—'

  const temProximoRetorno = proximoAtendimento !== '—'

  // Subtítulo do cockpit: APENAS a última consulta (conforme ANEXO 4).
  // Removidos: "usa óculos", "bifocal", etc.
  const subtituloUltimaConsulta = ultimaConsultaEm
    ? `Última consulta em ${formatarDataCurta(ultimaConsultaEm)}`
    : 'Sem consultas ainda'

  // Grau atual formatado: "OD x / OE y" — esconde o olho sem valor; "—" se ambos vazios
  const grauAtualLabel = (() => {
    const partes: string[] = []
    if (grauAtual.od) partes.push(`OD ${grauAtual.od}`)
    if (grauAtual.oe) partes.push(`OE ${grauAtual.oe}`)
    return partes.length > 0 ? partes.join(' / ') : '—'
  })()

  return (
    // Sessão 7.2: container max-w-6xl conforme DESIGN.md
    <div className="flex flex-col h-full bg-background overflow-auto">
      <div className="w-full max-w-6xl mx-auto px-4 py-6 md:p-8">
        {/* Navegação de volta — seta + breadcrumb clicável (desktop e mobile) */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-eyebrow font-mono mb-6"
        >
          <button
            onClick={() => router.push('/pacientes')}
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Pacientes
          </button>
        </nav>

        {/* Cockpit — identidade + ações + sinal clínico num único bloco */}
        <div className="bg-card rounded-2xl border border-border shadow-[0_2px_12px_rgba(0,0,0,0.01)] mb-8 overflow-hidden">
          {/* Topo: identidade + ações */}
          <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-start justify-between gap-5">
            <div className="flex items-start gap-3 md:gap-4 min-w-0">
              <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full ${avatarColor(paciente.nome)} text-white text-base md:text-xl font-bold flex items-center justify-center shrink-0 shadow-md ring-2 ring-primary/15`}>
                {iniciais(paciente.nome)}
              </div>
              <div className="min-w-0">
                {/* Nome em serifa display — tipografia consistente com títulos das telas */}
                <h1 className="text-page-title break-words">
                  {paciente.nome}
                </h1>
                {/* Subtítulo: APENAS última consulta (ANEXO 4) */}
                <p className="text-[14px] text-muted-foreground mt-1">
                  {subtituloUltimaConsulta}
                </p>
              </div>
            </div>

            {/* Ações com hierarquia: Iniciar (primário cheio) + WhatsApp/Agendar (ícones) */}
            <div className="flex items-center gap-2 md:gap-2.5 shrink-0">
              <BotaoNovoAtendimento
                pacienteFixo={{ id: paciente.id, nome: paciente.nome }}
                className="flex-1 md:flex-none h-10 px-4 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primary-hover transition shadow-md flex items-center justify-center"
              >
                <Glasses className="w-4 h-4 mr-2" />
                Iniciar atendimento
              </BotaoNovoAtendimento>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir WhatsApp"
                  title="WhatsApp"
                  className={buttonVariants({ variant: 'outline', size: 'icon-lg' })}
                >
                  <WhatsAppIcon className="w-4 h-4" />
                </a>
              )}
              <Button
                variant="outline"
                size="icon-lg"
                onClick={() => setAgendarAberto(true)}
                aria-label="Agendar"
                title="Agendar"
              >
                <CalendarPlus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Faixa clínica: Grau atual / Última consulta / Próximo retorno (sem "Total") */}
          <div className="border-t border-border grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
            <div className="px-5 md:px-6 py-4">
              <div className="text-eyebrow mb-1">Grau atual</div>
              <div className="text-[15px] font-semibold text-foreground tabular-nums">
                {grauAtualLabel}
              </div>
            </div>
            <div className="px-5 md:px-6 py-4">
              <div className="text-eyebrow mb-1">Última consulta</div>
              <div className="text-[15px] font-semibold text-foreground tabular-nums">
                {ultimaConsultaEm ? formatarDataCurta(ultimaConsultaEm) : '—'}
              </div>
            </div>
            <div className="px-5 md:px-6 py-4">
              <div className="text-eyebrow mb-1">Próximo retorno</div>
              <div className="text-[15px] font-semibold text-foreground">
                {temProximoRetorno ? (
                  <span className="tabular-nums">{proximoAtendimento}</span>
                ) : (
                  <button
                    onClick={() => setAgendarAberto(true)}
                    className="text-primary hover:text-primary-hover transition-colors"
                  >
                    Agendar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ORDEM DAS ABAS: 1) Visão geral, 2) Dados pessoais, 3) Fichas, 4) Receitas, 5) Evolução do grau */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as typeof activeTab)}
        >
          <TabsList
            variant="line"
            className="w-full max-w-full justify-between sm:justify-start gap-1 sm:gap-6 h-auto rounded-none border-b border-border overflow-x-auto overflow-y-hidden pb-2.5 mb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {/* Labels curtos no mobile para caber sem corte */}
            <TabsTrigger value="geral">
              <span className="sm:hidden">Geral</span>
              <span className="hidden sm:inline">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="dados">
              <span className="sm:hidden">Dados</span>
              <span className="hidden sm:inline">Dados pessoais</span>
            </TabsTrigger>
            <TabsTrigger value="atendimentos">Fichas</TabsTrigger>
            <TabsTrigger value="receitas">Receitas</TabsTrigger>
            <TabsTrigger value="evolucao">
              <span className="sm:hidden">Evolução</span>
              <span className="hidden sm:inline">Evolução do grau</span>
            </TabsTrigger>
          </TabsList>

          <div className="pb-12">
            <TabsContent value="geral">{renderVisaoGeral()}</TabsContent>
            <TabsContent value="dados">{renderDadosPessoais()}</TabsContent>
            <TabsContent value="atendimentos">{renderFichas()}</TabsContent>
            <TabsContent value="receitas">{renderReceitas()}</TabsContent>
            <TabsContent value="evolucao">{renderEvolucao()}</TabsContent>
          </div>
        </Tabs>
      </div>
      
      <ModalNovoAgendamento
        open={agendarAberto}
        onOpenChange={setAgendarAberto}
        orgId={paciente.org_id}
        dataSelecionada={new Date()}
        pacienteInicial={{ id: paciente.id, nome: paciente.nome }}
      />

      <ConfirmDialog
        open={confirmExcluirAberto}
        onOpenChange={(open) => {
          setConfirmExcluirAberto(open)
          if (!open) setContagensExclusao(null)
        }}
        titulo="Arquivar paciente"
        descricao={
          contagensExclusao
            ? `"${paciente.nome}" sairá das listagens, mas o histórico — ${pluralizar(contagensExclusao.atendimentos, 'atendimento', 'atendimentos')} e ${pluralizar(contagensExclusao.receitas, 'receita', 'receitas')} — é preservado. Você pode restaurá-lo depois em "Arquivados".`
            : `"${paciente.nome}" sairá das listagens, mas o histórico é preservado. Você pode restaurá-lo depois em "Arquivados".`
        }
        labelConfirmar="Arquivar"
        variante="normal"
        carregando={excluirPaciente.isPending}
        onConfirmar={handleExcluirPaciente}
      />

      {/* Arquivar ficha */}
      <ConfirmDialog
        open={!!fichaParaArquivar}
        onOpenChange={(open) => !open && setFichaParaArquivar(null)}
        titulo="Arquivar ficha?"
        descricao="A ficha será arquivada — sai da lista, mas os dados são preservados."
        labelConfirmar="Arquivar"
        variante="destrutivo"
        carregando={arquivandoFicha}
        onConfirmar={handleArquivarFicha}
      />

      {/* Arquivar receita */}
      <ConfirmDialog
        open={!!prescricaoParaArquivar}
        onOpenChange={(open) => !open && setPrescricaoParaArquivar(null)}
        titulo="Arquivar receita?"
        descricao="A receita será arquivada. Você pode restaurá-la depois na tela de Receitas."
        labelConfirmar="Arquivar"
        variante="destrutivo"
        carregando={deletarPrescricao.isPending}
        onConfirmar={handleArquivarPrescricao}
      />

      {/* Editar receita quick/standalone (CA7) — reabre o formulário de grau */}
      <QuickPrescriptionModal
        open={!!prescricaoEditando}
        onOpenChange={(open) => !open && setPrescricaoEditando(null)}
        pacienteFixo={{ id: paciente.id, nome: paciente.nome }}
        prescricaoEdicao={
          prescricaoEditando
            ? { id: prescricaoEditando.id, dados_prescricao: prescricaoEditando.dados_prescricao }
            : undefined
        }
      />

      {/* Modal para enviar receita para ótica (WhatsApp) */}
      {oticaModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !enviandoOtica && setOticaModal(null)}
        >
          <div
            className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-warning/10 text-status-warning shrink-0">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-foreground">Enviar para ótica</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Prescrição de {paciente.nome}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">
                Número da ótica
              </label>
              <input
                type="tel"
                inputMode="numeric"
                autoFocus
                placeholder="(00) 00000-0000"
                value={numeroOtica}
                onChange={(e) => setNumeroOtica(mascaraWhatsApp(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && numeroOticaValido && !enviandoOtica) {
                    handleEnviarReceitaOtica()
                  }
                }}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Envia o PDF da prescrição (sem dados clínicos sensíveis).
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOticaModal(null)}
                disabled={enviandoOtica}
                className="h-8 px-3 rounded-md border border-border bg-card text-[13px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEnviarReceitaOtica}
                disabled={!numeroOticaValido || enviandoOtica}
                className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {enviandoOtica ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                )}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
