'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListTree,
  Loader2,
  MoreVertical,
  TrendingUp,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { arquivarAtendimento } from '@/app/(app)/agenda/actions'
import { atualizarTituloFicha } from './actions'
import { AutoSaveIndicator } from '@/components/clinical/AutoSaveIndicator'
import { SeletorModelo } from '@/components/clinical/SeletorModelo'
import { IndiceFicha } from '@/components/clinical/IndiceFicha'
import { SecaoWrapper } from '@/components/clinical/SecaoWrapper'
import { SecaoMemo } from '@/components/clinical/SecaoMemo'
import { BotaoCopiarOD, BotaoTudoNormal } from '@/components/clinical/AcoesRapidas'
import { TelaDesfecho } from '@/components/atendimento/TelaDesfecho'
import { useFichaClinica } from '@/hooks/useFichaClinica'
import { EvolucaoGrau } from '@/components/evolucao/EvolucaoGrau'
import { secaoPreenchida } from '@/lib/clinical/secoesFicha'
import { NORMAIS } from '@/lib/clinical/normais'

// Seções compartilhadas (Resumido + Completo)
import { SecaoIdentificacao } from './secoes/SecaoIdentificacao'
import { SecaoAnamnese } from './secoes/SecaoAnamnese'
import { SecaoAnamneseFamiliar } from './secoes/SecaoAnamneseFamiliar'
// SecaoDioptriaAtual: fundida com Lensometria (decisão Etapa 4) — componente preservado mas não renderizado.
import { SecaoNovaPrescricao } from './secoes/SecaoNovaPrescricao'
import { SecaoHistoricoObservacoes } from './secoes/SecaoHistoricoObservacoes'
import { SecaoEncaminhamento } from './secoes/SecaoEncaminhamento'

// Seções exclusivas do Completo
import { SecaoAcuidadeVisualSC } from './secoes/SecaoAcuidadeVisualSC'
import { SecaoAcuidadeVisualCC } from './secoes/SecaoAcuidadeVisualCC'
import { SecaoReflexosPupilares } from './secoes/SecaoReflexosPupilares'
import { SecaoAvaliacaoMotora } from './secoes/SecaoAvaliacaoMotora'
import { SecaoBiomicroscopia } from './secoes/SecaoBiomicroscopia'
import { SecaoOftalmoscopia } from './secoes/SecaoOftalmoscopia'
import { SecaoTonometria } from './secoes/SecaoTonometria'
import { SecaoCeratometria } from './secoes/SecaoCeratometria'
import { SecaoLensometria } from './secoes/SecaoLensometria'
import { SecaoAutorrefrator } from './secoes/SecaoAutorrefrator'
import { SecaoRetinoscopiaEstatica } from './secoes/SecaoRetinoscopiaEstatica'
import { SecaoRetinoscopiaDinamica } from './secoes/SecaoRetinoscopiaDinamica'
import { SecaoSubjetivo } from './secoes/SecaoSubjetivo'
import { SecaoCoverTest } from './secoes/SecaoCoverTest'
import { SecaoTestesMotoresComplementares } from './secoes/SecaoTestesMotoresComplementares'
import { SecaoPPC } from './secoes/SecaoPPC'
import { SecaoReservasFusionais } from './secoes/SecaoReservasFusionais'
import { SecaoTestesAcomodativos } from './secoes/SecaoTestesAcomodativos'
import { SecaoVisaoCores } from './secoes/SecaoVisaoCores'
import { SecaoCamposVisuais } from './secoes/SecaoCamposVisuais'
import { SecaoDiagnostico } from './secoes/SecaoDiagnostico'

import type { FichaClinica } from '@/types/clinical'

type RecordInicial = {
  id: string
  org_id: string
  patient_id: string
  appointment_id: string | null
  modelo: 'resumido' | 'completo'
  clinical_data: FichaClinica
  status: 'em_andamento' | 'finalizado'
  finalizado_em: string | null
  editado: boolean
  editado_em: string | null
}

type Props = {
  recordId: string
  recordInicial: RecordInicial
  paciente: {
    // ID do paciente — usado no botão de voltar para o perfil (Etapa 7 #26)
    id: string
    nome: string
    data_nascimento: string | null
    cpf: string | null
    sexo_biologico: string | null
    whatsapp: string | null
  }
  // REFATORADO: duracao em vez de tipo_consulta (removido)
  // Inclui id e titulo para permitir edição inline do nome da ficha
  agendamento: {
    id: string | null
    data_hora: string | null
    duracao: number | null
    titulo: string | null
  } | null
  // ID da prescrição já gerada (snapshot em prescriptions). null = sem
  // prescrição (ficha não-finalizada ou finalizada sem dados de prescrição).
  prescricaoId: string | null
}

export function AtendimentoView({
  recordId,
  recordInicial,
  paciente,
  agendamento,
  prescricaoId,
}: Props) {
  const {
    record,
    ficha,
    setFicha,
    atualizarSecao,
    substituirSecao,
    saveStatus,
    ultimaSalvaEm,
    finalizar,
    reabrir,
    trocarModelo,
    finalizado,
    errosPorCampo,
  } = useFichaClinica(recordId, {
    initialRecord: recordInicial,
    initialFicha: recordInicial.clinical_data,
  })

  const [confirmFinalizar, setConfirmFinalizar] = useState(false)
  // Dashboard V2 FASE F: retorno previsto (YYYY-MM-DD) escolhido na finalização.
  const [retornoEm, setRetornoEm] = useState<string | null>(null)
  const [confirmTrocarModelo, setConfirmTrocarModelo] = useState<
    'resumido' | 'completo' | null
  >(null)
  const [reabrindo, setReabrindo] = useState(false)
  const [trocandoModelo, setTrocandoModelo] = useState(false)
  // Loading state da finalização — bloqueia botão durante o flush + finalize +
  // invalidações para evitar duplo-clique e dar feedback claro ao usuário.
  const [finalizando, setFinalizando] = useState(false)
  // Menu kebab do header (arquivar) e diálogo de confirmação
  const [menuHeaderAberto, setMenuHeaderAberto] = useState(false)
  const [confirmArquivar, setConfirmArquivar] = useState(false)
  const [arquivando, setArquivando] = useState(false)
  // Tela de desfecho (takeover) ao finalizar + índice mobile (drawer).
  // Ficha finalizada SEMPRE cai no desfecho por padrão (mesmo já editada) — a
  // edição é um modo temporário acessado por "Editar ficha".
  const [mostrarDesfecho, setMostrarDesfecho] = useState(
    recordInicial.status === 'finalizado',
  )
  const [indiceMobileAberto, setIndiceMobileAberto] = useState(false)
  // Estado local do título da ficha (editável no header)
  const [tituloFicha, setTituloFicha] = useState(agendamento?.titulo ?? '')
  const [salvandoTitulo, setSalvandoTitulo] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()

  // Fecha o menu quando clica fora dele (mesma estratégia do PacienteProfile)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuHeaderAberto(false)
      }
    }
    if (menuHeaderAberto) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuHeaderAberto])

  // Painel "Evolução do grau" — fechado por padrão para não poluir.
  // Aparece logo acima da Refração Final / Nova Prescrição.
  const [mostrarEvolucao, setMostrarEvolucao] = useState(false)

  // Modo readonly: ficha finalizada e que ainda não foi reaberta para edição.
  const readonly = finalizado && !record?.editado
  const modeloAtual = record?.modelo ?? recordInicial.modelo
  const isCompleto = modeloAtual === 'completo'

  // Helper: seção com algum dado preenchido (bolinha + recolher no mobile).
  const cheia = (...chaves: (keyof FichaClinica)[]) => secaoPreenchida(ficha, chaves)

  // Copia os valores do olho direito (OD) para o esquerdo (OE) numa seção
  // bilateral. Funciona com texto livre — `od` pode ser objeto ou string.
  function copiarODparaOE<K extends keyof FichaClinica>(chave: K) {
    const secao = (ficha[chave] ?? {}) as Record<string, unknown>
    if (secao.od === undefined) return
    const od = secao.od
    const oe = od !== null && typeof od === 'object' ? { ...(od as Record<string, unknown>) } : od
    substituirSecao(chave, { ...secao, oe } as unknown as NonNullable<FichaClinica[K]>)
  }

  // Preenche a seção com os valores "normais" padrão (NORMAIS) — preserva o que
  // já existe (ex.: observações) e sobrepõe só os campos de normalidade.
  function preencherNormal<K extends keyof FichaClinica>(chave: K) {
    const normal = NORMAIS[chave]
    if (!normal) return
    const secao = (ficha[chave] ?? {}) as Record<string, unknown>
    substituirSecao(chave, { ...secao, ...normal } as unknown as NonNullable<FichaClinica[K]>)
  }

  // Persiste o título da ficha onBlur (mesmo fluxo de save discreto)
  async function salvarTitulo() {
    // Não tenta salvar se não há appointment vinculado
    if (!agendamento?.id) return
    // Não salva se não mudou (evita request desnecessário)
    const valorAtual = agendamento.titulo ?? ''
    if (tituloFicha.trim() === valorAtual.trim()) return

    setSalvandoTitulo(true)
    const res = await atualizarTituloFicha(recordId, tituloFicha)
    setSalvandoTitulo(false)
    if (res.error) {
      toast.error(res.error)
      // Reverte para o valor anterior em caso de erro
      setTituloFicha(valorAtual)
    }
    // Sucesso silencioso — sem toast para não poluir (mesmo padrão do autosave)
  }

  // Validação mínima para finalização (espelha o critério do servidor)
  function podeFinalizar(): { ok: boolean; mensagem?: string } {
    const queixa = ficha.anamnese?.queixa_principal?.trim()
    const presc = ficha.nova_prescricao
    const temPresc =
      !!presc?.tipo_lente ||
      hasAnyEyeData(presc) ||
      (presc?.tratamentos?.length ?? 0) > 0
    const temDiagnostico = !!ficha.diagnostico?.hipoteses?.trim()
    if (!queixa && !temPresc && !temDiagnostico) {
      return {
        ok: false,
        mensagem:
          'Preencha a queixa principal, uma prescrição ou um diagnóstico antes de finalizar.',
      }
    }
    return { ok: true }
  }

  // Calcula uma data YYYY-MM-DD a N meses de hoje (presets do retorno previsto).
  function presetRetorno(meses: number): string {
    const d = new Date()
    d.setMonth(d.getMonth() + meses)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dia = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dia}`
  }

  async function handleFinalizar() {
    const v = podeFinalizar()
    if (!v.ok) {
      toast.error(v.mensagem!, { duration: 8000 })
      setConfirmFinalizar(false)
      return
    }
    setFinalizando(true)
    try {
      const res = await finalizar(retornoEm)
      if (res.error) {
        toast.error('Falha ao finalizar: ' + res.error, { duration: 8000 })
        return
      }
      toast.success('Ficha finalizada. Receita disponível abaixo.')
      setConfirmFinalizar(false)
      setRetornoEm(null)
      // Abre a tela de desfecho (takeover).
      setMostrarDesfecho(true)
    } finally {
      setFinalizando(false)
    }
  }

  async function handleReabrir() {
    setReabrindo(true)
    const res = await reabrir()
    setReabrindo(false)
    if (res.error) {
      toast.error('Falha ao reabrir: ' + res.error)
      return
    }
    // Sai do desfecho e vai para a ficha em modo edição.
    setMostrarDesfecho(false)
    toast.info('Modo edição ativado. Alterações ficam marcadas como editadas.')
  }

  // Arquiva o atendimento (soft delete reversível — ficha + receita). Diferente
  // do excluir, funciona também em ficha finalizada (é recuperável depois).
  async function handleArquivar() {
    setArquivando(true)
    try {
      const res = await arquivarAtendimento(recordId)
      if (res.error) {
        toast.error('Erro ao arquivar: ' + res.error)
        return
      }
      toast.success('Ficha arquivada. Você pode restaurar depois.')
      setConfirmArquivar(false)
      router.push(`/pacientes/${paciente.id}`)
    } finally {
      setArquivando(false)
    }
  }

  // Confirma a troca de modelo (mostra dialog avisando que dados são preservados)
  function handleSelecionarModelo(novo: 'resumido' | 'completo') {
    if (novo === modeloAtual) return
    if (readonly) {
      toast.error('Reabra a ficha para edição antes de trocar o modelo.')
      return
    }
    setConfirmTrocarModelo(novo)
  }

  async function handleConfirmarTroca() {
    if (!confirmTrocarModelo) return
    setTrocandoModelo(true)
    const res = await trocarModelo(confirmTrocarModelo)
    setTrocandoModelo(false)
    if (res.error) {
      toast.error('Falha ao trocar modelo: ' + res.error)
      setConfirmTrocarModelo(null)
      return
    }
    toast.success(
      `Modelo alterado para ${confirmTrocarModelo === 'resumido' ? 'Resumido' : 'Completo'}.`,
    )
    setConfirmTrocarModelo(null)
  }

  const finalizadoEmStr = record?.finalizado_em
    ? new Date(record.finalizado_em).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null

  // Formata data do agendamento para subtitulo
  const dataAgendamentoStr = agendamento?.data_hora
    ? new Date(agendamento.data_hora).toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  // ═══ Tela de desfecho (takeover) ════════════════════════════════════════
  // Surface padrão de uma ficha finalizada. "Editar ficha" reabre (vai à ficha
  // editável); "Voltar à ficha" só esconde o desfecho.
  if (finalizado && mostrarDesfecho) {
    return (
      <div className="mx-auto max-w-6xl">
        <TelaDesfecho
          recordId={recordId}
          prescricaoId={prescricaoId}
          modelo={modeloAtual}
          paciente={{ id: paciente.id, nome: paciente.nome, whatsapp: paciente.whatsapp }}
          finalizadoEmStr={finalizadoEmStr}
          reabrindo={reabrindo}
          onVoltar={() => setMostrarDesfecho(false)}
          onEditar={handleReabrir}
          dadosPrescricao={ficha.nova_prescricao ?? null}
          // Sincroniza o estado local (fonte do prefill) sem marcar dirty —
          // o dado já foi persistido pela action (atualizarReceitaRapida);
          // isto só evita que uma 2a edição na mesma sessão pré-preencha com
          // o grau antigo. Ver comentário de dirtyRef em useFichaClinica.
          onReceitaAtualizada={(dados) =>
            setFicha((prev) => ({ ...prev, nova_prescricao: dados }))
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Índice mobile (drawer) — aberto pelo botão "Seções" no header */}
      <Sheet open={indiceMobileAberto} onOpenChange={setIndiceMobileAberto}>
        <SheetContent side="left" className="w-72 overflow-y-auto p-4">
          <IndiceFicha
            modo={modeloAtual}
            ficha={ficha}
            onNavegar={() => setIndiceMobileAberto(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Botão voltar (volta para a tela anterior — agenda, central ou perfil) */}
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar
      </button>

      {/* Cabecalho canonico (DESIGN.md secao 4) — nome em serifa, breadcrumb mono */}
      <PageHeader
        breadcrumb={[
          { label: 'Ficha', href: '/ficha' },
        ]}
        title={paciente.nome}
        subtitle={
          <div className="space-y-1.5">
            {/* Input editável para título/nome da ficha */}
            {agendamento?.id && (
              <input
                type="text"
                value={tituloFicha}
                onChange={(e) => setTituloFicha(e.target.value)}
                onBlur={salvarTitulo}
                placeholder="Nome da ficha (opcional)"
                disabled={readonly || salvandoTitulo}
                className="w-full max-w-xs bg-transparent border-0 border-b border-transparent hover:border-border focus:border-primary focus:outline-none text-sm text-foreground placeholder:text-muted-foreground/60 py-0.5 px-0 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Nome da ficha"
              />
            )}
            {/* Linha de status: duração, data, badges */}
            <div className="flex items-center flex-wrap gap-x-1">
              {/* Mostra duracao em vez do tipo de consulta (removido) */}
              {agendamento?.duracao ? `${agendamento.duracao} min` : 'Ficha'}
              {dataAgendamentoStr && (
                <span className="tabular-nums font-mono"> · {dataAgendamentoStr}</span>
              )}
              {finalizado && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-status-ok-bg px-2 py-0.5 text-status-ok text-xs">
                  Finalizado{finalizadoEmStr && (
                    <span className="tabular-nums font-mono"> em {finalizadoEmStr}</span>
                  )}
                </span>
              )}
              {record?.editado && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-status-warning-bg px-2 py-0.5 text-status-warning text-xs">
                  Editado
                </span>
              )}
            </div>
          </div>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Atalho do índice no mobile/tablet (drawer) — no desktop a sidebar
                fixa já mostra o índice. */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 lg:hidden"
              onClick={() => setIndiceMobileAberto(true)}
            >
              <ListTree className="h-3.5 w-3.5" />
              Seções
            </Button>
            <SeletorModelo
              value={modeloAtual}
              onChange={handleSelecionarModelo}
              disabled={trocandoModelo || readonly}
            />
            {/* Menu kebab — Arquivar (sempre, reversível). O atendimento nunca
                é deletado permanentemente pela UI; apenas arquivado. */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuHeaderAberto((v) => !v)}
                aria-label="Mais opções"
                className="w-9 h-9 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuHeaderAberto && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-[0_12px_30px_rgba(0,0,0,0.08)] z-30 py-1.5 px-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={() => {
                      setMenuHeaderAberto(false)
                      setConfirmArquivar(true)
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-foreground hover:bg-muted rounded-lg text-left transition-colors"
                  >
                    <Archive className="w-4 h-4" />
                    Arquivar ficha
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* Layout: índice fixo (desktop) + coluna de conteúdo */}
      <div className="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-8 lg:items-start">
        <aside className="hidden lg:block lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <IndiceFicha modo={modeloAtual} ficha={ficha} />
        </aside>

        <div className="min-w-0 space-y-5">
          {/* ===== Identificação (sempre visível) ===== */}
          <SecaoWrapper id="sec-ident" label="Identificação" preenchida defaultAberto>
            <SecaoIdentificacao paciente={paciente} agendamento={agendamento} />
          </SecaoWrapper>

          {/* ===== Anamnese (compartilhada) ===== */}
          <SecaoWrapper id="sec-anamnese" label="Anamnese" preenchida={cheia('anamnese')}>
            <SecaoMemo deps={[ficha.anamnese, readonly, errosPorCampo]}>
              <SecaoAnamnese
                value={ficha.anamnese ?? {}}
                onChange={(p) => atualizarSecao('anamnese', p)}
                disabled={readonly}
                erros={Object.fromEntries(
                  Object.entries(errosPorCampo)
                    .filter(([k]) => k.startsWith('anamnese.'))
                    .map(([k, v]) => [k.replace('anamnese.', ''), v])
                )}
              />
            </SecaoMemo>
          </SecaoWrapper>

          <SecaoWrapper
            id="sec-anamnese-familiar"
            label="Anamnese familiar"
            preenchida={cheia('anamnese_familiar')}
          >
            <SecaoMemo deps={[ficha.anamnese_familiar, readonly]}>
              <SecaoAnamneseFamiliar
                value={ficha.anamnese_familiar ?? {}}
                onChange={(p) => atualizarSecao('anamnese_familiar', p)}
                disabled={readonly}
              />
            </SecaoMemo>
          </SecaoWrapper>

          {/* ===== Seções exclusivas do Completo (Exame Externo) ===== */}
          {isCompleto && (
            <>
              <SecaoWrapper id="sec-av-sc" label="AV sem correção" preenchida={cheia('acuidade_visual_sc')}>
                <SecaoMemo deps={[ficha.acuidade_visual_sc, readonly]}>
                  <SecaoAcuidadeVisualSC
                    value={ficha.acuidade_visual_sc ?? {}}
                    onChange={(p) => atualizarSecao('acuidade_visual_sc', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              <SecaoWrapper id="sec-av-cc" label="AV com correção" preenchida={cheia('acuidade_visual_cc')}>
                <SecaoMemo deps={[ficha.acuidade_visual_cc, readonly]}>
                  <SecaoAcuidadeVisualCC
                    value={ficha.acuidade_visual_cc ?? {}}
                    onChange={(p) => atualizarSecao('acuidade_visual_cc', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              <SecaoWrapper
                id="sec-reflexos"
                label="Reflexos pupilares"
                preenchida={cheia('reflexos_pupilares')}
                escondeAcao={readonly}
                acao={
                  <>
                    <BotaoCopiarOD onClick={() => copiarODparaOE('reflexos_pupilares')} />
                    <BotaoTudoNormal onClick={() => preencherNormal('reflexos_pupilares')} />
                  </>
                }
              >
                <SecaoMemo deps={[ficha.reflexos_pupilares, readonly]}>
                  <SecaoReflexosPupilares
                    value={ficha.reflexos_pupilares ?? {}}
                    onChange={(p) => atualizarSecao('reflexos_pupilares', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              <SecaoWrapper
                id="sec-motora"
                label="Avaliação motora"
                preenchida={cheia('avaliacao_motora')}
                escondeAcao={readonly}
                acao={<BotaoTudoNormal onClick={() => preencherNormal('avaliacao_motora')} />}
              >
                <SecaoMemo deps={[ficha.avaliacao_motora, readonly]}>
                  <SecaoAvaliacaoMotora
                    value={ficha.avaliacao_motora ?? {}}
                    onChange={(p) => atualizarSecao('avaliacao_motora', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              <SecaoWrapper
                id="sec-biomicroscopia"
                label="Biomicroscopia"
                preenchida={cheia('biomicroscopia')}
                escondeAcao={readonly}
                acao={
                  <>
                    <BotaoCopiarOD onClick={() => copiarODparaOE('biomicroscopia')} />
                    <BotaoTudoNormal onClick={() => preencherNormal('biomicroscopia')} />
                  </>
                }
              >
                <SecaoMemo deps={[ficha.biomicroscopia, readonly]}>
                  <SecaoBiomicroscopia
                    value={ficha.biomicroscopia ?? {}}
                    onChange={(p) => atualizarSecao('biomicroscopia', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              <SecaoWrapper
                id="sec-oftalmoscopia"
                label="Oftalmoscopia"
                preenchida={cheia('oftalmoscopia')}
                escondeAcao={readonly}
                acao={
                  <>
                    <BotaoCopiarOD onClick={() => copiarODparaOE('oftalmoscopia')} />
                    <BotaoTudoNormal onClick={() => preencherNormal('oftalmoscopia')} />
                  </>
                }
              >
                <SecaoMemo deps={[ficha.oftalmoscopia, readonly]}>
                  <SecaoOftalmoscopia
                    value={ficha.oftalmoscopia ?? {}}
                    onChange={(p) => atualizarSecao('oftalmoscopia', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              <SecaoWrapper id="sec-tonometria" label="Tonometria" preenchida={cheia('tonometria')}>
                <SecaoMemo deps={[ficha.tonometria, readonly]}>
                  <SecaoTonometria
                    value={ficha.tonometria ?? {}}
                    onChange={(p) => atualizarSecao('tonometria', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              <SecaoWrapper
                id="sec-ceratometria"
                label="Ceratometria"
                preenchida={cheia('ceratometria')}
                escondeAcao={readonly}
                acao={<BotaoCopiarOD onClick={() => copiarODparaOE('ceratometria')} />}
              >
                <SecaoMemo deps={[ficha.ceratometria, readonly]}>
                  <SecaoCeratometria
                    value={ficha.ceratometria ?? {}}
                    onChange={(p) => atualizarSecao('ceratometria', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>
            </>
          )}

          {/* ===== Lensometria / Dioptria atual (fundida — visível em Resumido e Completo) ===== */}
          <SecaoWrapper
            id="sec-lensometria"
            label="Lensometria / Dioptria atual"
            preenchida={cheia('lensometria')}
            escondeAcao={readonly}
            acao={<BotaoCopiarOD onClick={() => copiarODparaOE('lensometria')} />}
          >
            <SecaoMemo deps={[ficha.lensometria, readonly]}>
              <SecaoLensometria
                value={ficha.lensometria ?? {}}
                onChange={(p) => atualizarSecao('lensometria', p)}
                disabled={readonly}
              />
            </SecaoMemo>
          </SecaoWrapper>

          {/* ===== Refração objetiva (Completo) ===== */}
          {isCompleto && (
            <>
              <SecaoWrapper
                id="sec-autorrefrator"
                label="Autorrefrator"
                preenchida={cheia('autorrefrator')}
                escondeAcao={readonly}
                acao={<BotaoCopiarOD onClick={() => copiarODparaOE('autorrefrator')} />}
              >
                <SecaoMemo deps={[ficha.autorrefrator, readonly]}>
                  <SecaoAutorrefrator
                    value={ficha.autorrefrator ?? {}}
                    onChange={(p) => atualizarSecao('autorrefrator', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              <SecaoWrapper
                id="sec-retino-est"
                label="Retinoscopia estática"
                preenchida={cheia('retinoscopia_estatica')}
                escondeAcao={readonly}
                acao={<BotaoCopiarOD onClick={() => copiarODparaOE('retinoscopia_estatica')} />}
              >
                <SecaoMemo deps={[ficha.retinoscopia_estatica, readonly]}>
                  <SecaoRetinoscopiaEstatica
                    value={ficha.retinoscopia_estatica ?? {}}
                    onChange={(p) => atualizarSecao('retinoscopia_estatica', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              <SecaoWrapper
                id="sec-retino-din"
                label="Retinoscopia dinâmica"
                preenchida={cheia('retinoscopia_dinamica')}
              >
                <SecaoMemo deps={[ficha.retinoscopia_dinamica, readonly]}>
                  <SecaoRetinoscopiaDinamica
                    value={ficha.retinoscopia_dinamica ?? {}}
                    onChange={(p) => atualizarSecao('retinoscopia_dinamica', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              <SecaoWrapper
                id="sec-subjetivo"
                label="Subjetivo"
                preenchida={cheia('subjetivo')}
                escondeAcao={readonly}
                acao={<BotaoCopiarOD onClick={() => copiarODparaOE('subjetivo')} />}
              >
                <SecaoMemo deps={[ficha.subjetivo, readonly]}>
                  <SecaoSubjetivo
                    value={ficha.subjetivo ?? {}}
                    onChange={(p) => atualizarSecao('subjetivo', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>
            </>
          )}

          {/* ===== Avaliação binocular (Completo) ===== */}
          {isCompleto && (
            <>
              <SecaoWrapper id="sec-cover" label="Cover test" preenchida={cheia('cover_test')}>
                <SecaoMemo deps={[ficha.cover_test, readonly]}>
                  <SecaoCoverTest
                    value={ficha.cover_test ?? {}}
                    onChange={(p) => atualizarSecao('cover_test', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              {/* Testes motores complementares (Etapa 5) — entre Cover test e PPC */}
              <SecaoWrapper
                id="sec-testes-motores-comp"
                label="Testes motores compl."
                preenchida={cheia('testes_motores_complementares')}
              >
                <SecaoMemo deps={[ficha.testes_motores_complementares, readonly]}>
                  <SecaoTestesMotoresComplementares
                    value={ficha.testes_motores_complementares ?? {}}
                    onChange={(p) => atualizarSecao('testes_motores_complementares', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              {/* PPC + PPA fundidos na mesma seção (Etapa 5) */}
              <SecaoWrapper id="sec-ppc" label="PPC / PPA" preenchida={cheia('ppc', 'ppa')}>
                <SecaoMemo deps={[ficha.ppc, ficha.ppa, readonly]}>
                  <SecaoPPC
                    valuePpc={ficha.ppc ?? {}}
                    valuePpa={ficha.ppa ?? {}}
                    onChangePpc={(p) => atualizarSecao('ppc', p)}
                    onChangePpa={(p) => atualizarSecao('ppa', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              <SecaoWrapper
                id="sec-reservas"
                label="Reservas fusionais"
                preenchida={cheia('reservas_fusionais')}
              >
                <SecaoMemo deps={[ficha.reservas_fusionais, readonly]}>
                  <SecaoReservasFusionais
                    value={ficha.reservas_fusionais ?? {}}
                    onChange={(p) => atualizarSecao('reservas_fusionais', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              <SecaoWrapper
                id="sec-acomodativos"
                label="Testes acomodativos"
                preenchida={cheia('testes_acomodativos')}
              >
                <SecaoMemo deps={[ficha.testes_acomodativos, readonly]}>
                  <SecaoTestesAcomodativos
                    value={ficha.testes_acomodativos ?? {}}
                    onChange={(p) => atualizarSecao('testes_acomodativos', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>
            </>
          )}

          {/* ===== Outros exames (Completo) ===== */}
          {isCompleto && (
            <>
              <SecaoWrapper id="sec-cores" label="Visão de cores" preenchida={cheia('visao_cores')}>
                <SecaoMemo deps={[ficha.visao_cores, readonly]}>
                  <SecaoVisaoCores
                    value={ficha.visao_cores ?? {}}
                    onChange={(p) => atualizarSecao('visao_cores', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>

              <SecaoWrapper
                id="sec-campos"
                label="Campos visuais"
                preenchida={cheia('campos_visuais')}
                escondeAcao={readonly}
                acao={
                  <>
                    <BotaoCopiarOD onClick={() => copiarODparaOE('campos_visuais')} />
                    <BotaoTudoNormal onClick={() => preencherNormal('campos_visuais')} />
                  </>
                }
              >
                <SecaoMemo deps={[ficha.campos_visuais, readonly]}>
                  <SecaoCamposVisuais
                    value={ficha.campos_visuais ?? {}}
                    onChange={(p) => atualizarSecao('campos_visuais', p)}
                    disabled={readonly}
                  />
                </SecaoMemo>
              </SecaoWrapper>
            </>
          )}

          {/* ===== Evolução do grau (referência visual durante prescrição) ===== */}
          <section
            id="sec-evolucao"
            className="scroll-mt-20 rounded-xl border bg-card shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setMostrarEvolucao((v) => !v)}
              className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-muted transition-colors"
              aria-expanded={mostrarEvolucao}
              aria-controls="painel-evolucao"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-base font-semibold text-foreground">Evolução da Dioptria</span>
                <span className="text-xs text-muted-foreground ml-2">
                  Histórico de prescrições deste paciente
                </span>
              </div>
              {mostrarEvolucao ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {mostrarEvolucao && (
              <div id="painel-evolucao" className="px-6 pb-6 pt-2 border-t border-border">
                <EvolucaoGrau
                  patientId={recordInicial.patient_id}
                  variante="compacta"
                />
              </div>
            )}
          </section>

          {/* ===== Refração final / Nova prescrição (compartilhada — título muda no Completo) ===== */}
          <SecaoWrapper
            id="sec-prescricao"
            label={isCompleto ? 'Refração final' : 'Nova prescrição'}
            preenchida={cheia('nova_prescricao')}
            escondeAcao={readonly}
            acao={<BotaoCopiarOD onClick={() => copiarODparaOE('nova_prescricao')} />}
          >
            <SecaoMemo deps={[ficha.nova_prescricao, readonly, errosPorCampo, isCompleto]}>
              <SecaoNovaPrescricao
                value={ficha.nova_prescricao ?? {}}
                onChange={(p) => atualizarSecao('nova_prescricao', p)}
                disabled={readonly}
                titulo={isCompleto ? 'Refração final' : undefined}
                descricao={
                  isCompleto
                    ? 'Refração subjetiva final prescrita ao paciente.'
                    : undefined
                }
                erros={Object.fromEntries(
                  Object.entries(errosPorCampo)
                    .filter(([k]) => k.startsWith('nova_prescricao.'))
                    .map(([k, v]) => [k.replace('nova_prescricao.', ''), v])
                )}
              />
            </SecaoMemo>
          </SecaoWrapper>

          {/* ===== Diagnóstico (Completo) ===== */}
          {isCompleto && (
            <SecaoWrapper id="sec-diagnostico" label="Diagnóstico" preenchida={cheia('diagnostico')}>
              <SecaoMemo deps={[ficha.diagnostico, readonly]}>
                <SecaoDiagnostico
                  value={ficha.diagnostico ?? {}}
                  onChange={(p) => atualizarSecao('diagnostico', p)}
                  disabled={readonly}
                />
              </SecaoMemo>
            </SecaoWrapper>
          )}

          {/* ===== Conduta + Encaminhamento (compartilhadas) ===== */}
          <SecaoWrapper id="sec-conduta" label="Conduta" preenchida={cheia('historico_observacoes')}>
            <SecaoMemo deps={[ficha.historico_observacoes, readonly]}>
              <SecaoHistoricoObservacoes
                value={ficha.historico_observacoes ?? {}}
                onChange={(p) => atualizarSecao('historico_observacoes', p)}
                disabled={readonly}
              />
            </SecaoMemo>
          </SecaoWrapper>

          <SecaoWrapper
            id="sec-encaminhamento"
            label="Encaminhamento"
            preenchida={cheia('encaminhamento')}
          >
            <SecaoMemo deps={[ficha.encaminhamento, readonly]}>
              <SecaoEncaminhamento
                value={ficha.encaminhamento ?? {}}
                onChange={(p) => atualizarSecao('encaminhamento', p)}
                disabled={readonly}
              />
            </SecaoMemo>
          </SecaoWrapper>

          {/* Rodapé sticky:
              - Esquerda: AutoSaveIndicator
              - Direita (em andamento): Finalizar ficha
              - Direita (finalizado): Ver finalização (reabre o desfecho) + Editar ficha */}
          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-card/95 backdrop-blur border-t border-border flex items-center justify-between gap-2 lg:mx-0 lg:px-0">
            <AutoSaveIndicator status={saveStatus} ultimaSalvaEm={ultimaSalvaEm} />

            <div className="flex items-center gap-2">
              {finalizado ? (
                <>
                  <Button variant="outline" onClick={() => setMostrarDesfecho(true)}>
                    Ver finalização
                  </Button>
                  <Button onClick={handleReabrir} variant="outline" disabled={reabrindo}>
                    {reabrindo ? 'Abrindo...' : 'Editar ficha'}
                  </Button>
                </>
              ) : (
                <Button
                  className="bg-primary hover:bg-primary-hover text-primary-foreground"
                  onClick={() => setConfirmFinalizar(true)}
                  disabled={finalizando}
                >
                  {finalizando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Finalizando...
                    </>
                  ) : (
                    'Finalizar ficha'
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmFinalizar}
        onOpenChange={setConfirmFinalizar}
        titulo="Finalizar ficha?"
        descricao="A ficha será marcada como concluída e uma prescrição será gerada (se houver). Você ainda poderá reabrir para edição depois."
        labelConfirmar="Finalizar"
        variante="normal"
        carregando={finalizando}
        onConfirmar={handleFinalizar}
      >
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[13px] font-medium text-foreground">Agendar retorno (opcional)</p>
          <div className="flex flex-wrap gap-1.5">
            {[3, 6, 12].map((meses) => {
              const val = presetRetorno(meses)
              const ativo = retornoEm === val
              return (
                <button
                  key={meses}
                  type="button"
                  onClick={() => setRetornoEm(ativo ? null : val)}
                  className={`px-2.5 py-1 rounded-md text-[12px] border transition-colors ${
                    ativo
                      ? 'bg-primary text-white border-primary'
                      : 'border-border text-foreground hover:bg-muted'
                  }`}
                >
                  {meses} meses
                </button>
              )
            })}
          </div>
          <input
            type="date"
            value={retornoEm ?? ''}
            min={presetRetorno(0)}
            onChange={(e) => setRetornoEm(e.target.value || null)}
            className="h-9 w-full rounded-lg border border-border bg-card text-[13px] px-3"
          />
          <p className="text-meta-xs">
            Aparece no bloco &ldquo;Retornos do mês&rdquo; do painel quando chegar o período.
          </p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!confirmTrocarModelo}
        onOpenChange={(o) => !o && setConfirmTrocarModelo(null)}
        titulo={`Trocar para ficha ${confirmTrocarModelo === 'resumido' ? 'Resumida' : 'Completa'}?`}
        descricao={
          confirmTrocarModelo === 'completo'
            ? 'A ficha completa exibirá todas as seções de exame optométrico. Os dados já preenchidos serão preservados.'
            : 'A ficha resumida ocultará as seções específicas do modelo completo, mas os dados não serão apagados — eles voltam a aparecer se você retornar ao modo Completo.'
        }
        labelConfirmar="Trocar"
        variante="normal"
        onConfirmar={handleConfirmarTroca}
      />

      <ConfirmDialog
        open={confirmArquivar}
        onOpenChange={setConfirmArquivar}
        titulo="Arquivar ficha?"
        descricao="A ficha e a receita vinculada saem das listagens ativas. Esta ação é reversível — você pode restaurar a ficha depois."
        labelConfirmar="Arquivar"
        variante="normal"
        carregando={arquivando}
        onConfirmar={handleArquivar}
      />
    </div>
  )
}

// ----- helpers -----

function hasAnyEyeData(p: { od?: unknown; oe?: unknown } | undefined): boolean {
  if (!p) return false
  const valores: unknown[] = []
  for (const olho of ['od', 'oe'] as const) {
    const o = (p as Record<string, unknown>)[olho] as Record<string, unknown> | undefined
    if (o) valores.push(...Object.values(o))
  }
  return valores.some((v) => v !== null && v !== undefined && v !== '')
}
