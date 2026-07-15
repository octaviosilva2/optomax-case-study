'use client'

// Modal "Nova receita rápida".
// Fase 10.5: adicionada aba "Cadastrar novo" replicando exatamente a UX do
// ModalEncaixeRapido (consistência). Aba 1 = selecionar paciente existente,
// Aba 2 = cadastrar paciente novo inline e já emitir receita. A receita só
// é gerada DEPOIS de criar o paciente com sucesso na aba "novo".

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Eye, X, AlertCircle, Loader2, UserCheck, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { receitaRapidaSchema, type ReceitaRapidaInput } from '@/lib/validations/receitas'
import { useReceitas } from '@/hooks/useReceitas'
import { usePacientes } from '@/hooks/usePacientes'
import { criarPaciente } from '@/app/(app)/pacientes/actions'
import { atualizarReceitaRapida } from '@/app/(app)/receitas/actions'
// Utilitários compartilhados com ModalEncaixeRapido — validação e cálculo de idade
import { validarCPF, limparCPF } from '@/lib/utils/cpf'
import { calcularIdade } from '@/lib/utils/idade'
import { DioptriasGrid } from '@/components/clinical/DioptriasGrid'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
// RadioGroup removido — receita unificada (sem distinção óculos/lente)

type PacienteFixo = { id: string; nome: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Reorganização "Novo Atendimento" (SPEC §5): quando presente, pré-seleciona
  // e esconde as abas de busca/cadastro — usado quando o paciente já veio de
  // uma porta de entrada (walk-in, agendamento, perfil).
  pacienteFixo?: PacienteFixo
  // Quando a receita nasce de um agendamento: liga appointment_id e permite o
  // flip de status (ver SPEC §3.3). Repassado a criarReceitaRapida.
  appointmentId?: string
  // Modo edição (CA4b): quando presente, o form abre pré-preenchido e o
  // submit chama atualizarReceitaRapida (não cria linha nova).
  prescricaoEdicao?: { id: string; dados_prescricao: ReceitaRapidaInput['dados_prescricao'] }
  // B2 (stale-prefill fix): chamado com os dados novos após uma edição bem-
  // sucedida (prescricaoEdicao). Permite o pai atualizar seu próprio estado
  // local de prefill (ex.: `ficha.nova_prescricao` em AtendimentoView) — sem
  // isso, reabrir o modal duas vezes seguidas sem reload da página mostra o
  // grau antigo na 2ª edição.
  onEditado?: (dados: ReceitaRapidaInput['dados_prescricao']) => void
}

type Aba = 'existente' | 'novo'

// ─── Máscaras de input (copiadas inline do ModalEncaixeRapido) ──────────────
// Decisão Fase 10.5: copiei inline pra manter o modal autônomo e a UX 100%
// idêntica ao encaixe rápido. Extrair pra utilitário compartilhado fica pra
// um refator futuro.

// Máscara de CPF: XXX.XXX.XXX-XX
function mascaraCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

// Máscara de WhatsApp: (XX) XXXXX-XXXX
function mascaraWhatsApp(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

// Máscara de data: dd/mm/aaaa (apenas formatação visual)
function mascaraData(v: string) {
  return v.replace(/\D/g, '').slice(0, 8)
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})(\d)/, '$1/$2')
}

// Converte dd/mm/aaaa → YYYY-MM-DD (retorna null se incompleto/inválido)
function dataParaIso(dataBr: string): string | null {
  const m = dataBr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, dia, mes, ano] = m
  return `${ano}-${mes}-${dia}`
}

export default function QuickPrescriptionModal({
  open,
  onOpenChange,
  pacienteFixo,
  appointmentId,
  prescricaoEdicao,
  onEditado,
}: Props) {
  const { criarReceitaRapida, isCreating } = useReceitas()
  const queryClient = useQueryClient()
  const router = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)

  // Aba ativa (Fase 10.5) — replicando ModalEncaixeRapido
  const [aba, setAba] = useState<Aba>('existente')

  // ── Aba "existente" — busca de paciente com debounce
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [termo, setTermo] = useState('')
  const [pacienteSelecionado, setPacienteSelecionado] = useState<{ id: string; nome: string } | null>(null)
  const [mostrarLista, setMostrarLista] = useState(false)

  // ── Aba "novo" — campos do cadastro inline (alinhado com ModalEncaixeRapido)
  const [novoNome, setNovoNome] = useState('')
  const [novoCpf, setNovoCpf] = useState('')
  const [novoWhatsapp, setNovoWhatsapp] = useState('')
  const [novoDataBr, setNovoDataBr] = useState('')
  // Responsável legal — só aparece/obrigatório quando o paciente é menor de 18
  const [novoRespNome, setNovoRespNome] = useState('')
  const [novoRespCpf, setNovoRespCpf] = useState('')
  // Campos opcionais — mesmos do form completo (aba Pacientes).
  const [novoEmail, setNovoEmail] = useState('')
  const [novoEndereco, setNovoEndereco] = useState('')
  const [novoSexo, setNovoSexo] = useState<'M' | 'F' | ''>('')
  const [novoObservacoesPaciente, setNovoObservacoesPaciente] = useState('')

  // Estado adicional para etapa de criação do paciente (antes da receita)
  const [criandoPaciente, setCriandoPaciente] = useState(false)
  // Loading do caminho de edição (CA4b) — atualizarReceitaRapida não passa por useReceitas
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [erroAba, setErroAba] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setTermo(buscaPaciente), 300)
    return () => clearTimeout(t)
  }, [buscaPaciente])

  const { data: pacientes = [], isLoading: loadingPacientes } = usePacientes(termo)

  // Idade do novo paciente — quando menor de 18, exige dados do responsável (igual encaixe)
  const dataIsoNovo = dataParaIso(novoDataBr)
  const idadeNovo = dataIsoNovo
    ? (() => {
        try { return calcularIdade(dataIsoNovo) }
        catch { return null }
      })()
    : null
  const ehMenorNovo = idadeNovo !== null && idadeNovo < 18

  // Fecha com Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onOpenChange])

  // Bloqueia scroll do body enquanto modal está aberto
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const {
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<z.output<typeof receitaRapidaSchema>>({
    resolver: zodResolver(receitaRapidaSchema) as never,
    defaultValues: {
      patient_id: '',
      // Receita unificada — tipo fixo 'oculos' para compatibilidade com o banco
      // (coluna NOT NULL). A UI não expõe mais essa escolha.
      tipo: 'oculos',
      dados_prescricao: {
        od: { esf: '', cil: '', eixo: '', add: '' },
        oe: { esf: '', cil: '', eixo: '', add: '' },
        tipo_lente: null,
        tratamentos: [],
        observacoes: '',
      },
    },
  })

  // Re-seeda o form a cada abertura: modo edição pré-preenche dados_prescricao
  // da receita existente; pacienteFixo pré-seleciona o paciente. O componente
  // fica montado entre aberturas (padrão dos outros modais), então defaultValues
  // sozinho (avaliado só no mount) não basta.
  useEffect(() => {
    if (!open) return
    reset({
      patient_id: pacienteFixo?.id ?? '',
      tipo: 'oculos',
      dados_prescricao: prescricaoEdicao?.dados_prescricao ?? {
        od: { esf: '', cil: '', eixo: '', add: '' },
        oe: { esf: '', cil: '', eixo: '', add: '' },
        tipo_lente: null,
        tratamentos: [],
        observacoes: '',
      },
    })
    if (pacienteFixo) {
      setPacienteSelecionado(pacienteFixo)
      setAba('existente')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prescricaoEdicao, pacienteFixo])

  function handleFechar() {
    reset()
    setAba('existente')
    setBuscaPaciente('')
    setTermo('')
    setPacienteSelecionado(null)
    setMostrarLista(false)
    setNovoNome('')
    setNovoCpf('')
    setNovoWhatsapp('')
    setNovoDataBr('')
    setNovoRespNome('')
    setNovoRespCpf('')
    setNovoEmail('')
    setNovoEndereco('')
    setNovoSexo('')
    setNovoObservacoesPaciente('')
    setErroAba(null)
    setCriandoPaciente(false)
    onOpenChange(false)
  }

  // Guard síncrono contra duplo-clique. O índice unique (clinical_record_id,
  // tipo) NÃO cobre receita rápida (clinical_record_id é NULL → NULL≠NULL no
  // Postgres), então dois submits rápidos criariam duas receitas idênticas.
  // O ref bloqueia o segundo disparo antes mesmo de o estado isCreating mudar.
  const submittingRef = useRef(false)

  // Submit comum (aba "existente"): RHF já validou patient_id como UUID.
  // Modo edição (CA4b): atualiza a MESMA receita em vez de criar uma nova.
  async function onSubmit(dados: z.output<typeof receitaRapidaSchema>) {
    if (submittingRef.current) return
    submittingRef.current = true
    setErroAba(null)
    try {
      if (prescricaoEdicao) {
        setSalvandoEdicao(true)
        const res = await atualizarReceitaRapida({
          prescricaoId: prescricaoEdicao.id,
          dados_prescricao: dados.dados_prescricao,
        })
        setSalvandoEdicao(false)
        if (res.error) {
          toast.error(res.error)
          return
        }
        queryClient.invalidateQueries({ queryKey: ['receitas'] })
        queryClient.invalidateQueries({ queryKey: ['prescricoes'] })
        onEditado?.(dados.dados_prescricao)
        toast.success('Receita atualizada com sucesso!')
        window.open(`/api/prescricao/${prescricaoEdicao.id}`, '_blank')
        handleFechar()
      } else {
        const novaReceita = await criarReceitaRapida(
          appointmentId ? { ...dados, appointmentId } : dados,
        )
        handleFechar()
        if (novaReceita?.id) {
          // Navega para a tela de finalização da receita (/receitas/[id]) — mesmo
          // destino do fluxo completo (ReceitaEditorView) após "Finalizar receita".
          // Lá o optometrista visualiza/baixa/imprime o PDF, entre outras ações.
          router.push(`/receitas/${novaReceita.id}`)
        }
      }
    } catch {
      // O hook useReceitas já mostra o toast de erro (caminho de criação)
    } finally {
      submittingRef.current = false
    }
  }

  // Wrapper do submit: na aba "novo", cria o paciente PRIMEIRO (server action),
  // injeta o patient_id no form via setValue e só então dispara o handleSubmit
  // do RHF — caso contrário o resolver Zod bloqueia o fluxo porque o
  // patient_id começa vazio.
  async function handleClickSubmit() {
    // Barra reentrância enquanto um envio (ou criação de paciente) está em curso.
    if (enviando || submittingRef.current) return
    setErroAba(null)

    if (pacienteFixo || aba === 'existente') {
      // Sem criação inline — deixa o RHF validar normalmente.
      handleSubmit(onSubmit)()
      return
    }

    // ── Aba "novo": cadastro rápido — só nome + WhatsApp são obrigatórios ──
    // Nome (min 3 caracteres)
    const nome = novoNome.trim()
    if (nome.length < 3) {
      setErroAba('Informe o nome completo (mínimo 3 caracteres).')
      return
    }
    // WhatsApp (min 10 dígitos)
    if (novoWhatsapp.replace(/\D/g, '').length < 10) {
      setErroAba('WhatsApp é obrigatório.')
      return
    }
    // CPF opcional — se preenchido, precisa ser válido
    if (novoCpf.trim() && !validarCPF(novoCpf)) {
      setErroAba('CPF inválido.')
      return
    }
    // Data de nascimento opcional — se preenchida, precisa estar completa
    const dataIso = novoDataBr.trim() ? dataParaIso(novoDataBr) : ''
    if (novoDataBr.trim() && !dataIso) {
      setErroAba('Data de nascimento inválida (dd/mm/aaaa).')
      return
    }

    // Menor de 18 (só calculável se a data foi informada) → responsável legal obrigatório
    // Mesmo formato do encaixe rápido: "Nome Responsavel | CPF: 000.000.000-00"
    let responsavelLegal: string | null = null
    if (dataIso && ehMenorNovo) {
      const respNome = novoRespNome.trim()
      if (respNome.length < 3) {
        setErroAba('Nome do responsável é obrigatório para menores de 18.')
        return
      }
      if (!validarCPF(novoRespCpf)) {
        setErroAba('CPF do responsável é obrigatório e deve ser válido.')
        return
      }
      responsavelLegal = `${respNome} | CPF: ${novoRespCpf}`
    }

    setCriandoPaciente(true)
    const result = await criarPaciente({
      nome,
      whatsapp: novoWhatsapp.trim(),
      cpf: novoCpf.trim() ? limparCPF(novoCpf) : '',
      data_nascimento: dataIso ?? '',
      responsavel_legal: responsavelLegal ?? '',
      email: novoEmail.trim(),
      endereco: novoEndereco.trim(),
      sexo_biologico: novoSexo || null,
      observacoes: novoObservacoesPaciente.trim(),
    })
    setCriandoPaciente(false)

    if (result.error || !result.pacienteId) {
      if (result.error === 'CPF_DUPLICADO' || result.error === 'CPF_DUPLICADO_ARQUIVADO') {
        setErroAba('CPF já cadastrado nesta clínica. Use a aba "Selecionar existente".')
      } else {
        toast.error(
          result.error === 'VALIDACAO_FALHOU'
            ? 'Dados do paciente inválidos. Verifique os campos.'
            : (result.error ?? 'Falha ao cadastrar paciente.'),
        )
      }
      return
    }

    // Injeta o id recém-criado no form pra validação Zod passar
    setValue('patient_id', result.pacienteId)
    // Dispara o submit do RHF (vai chamar onSubmit acima)
    handleSubmit(onSubmit)()
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) handleFechar()
  }

  if (!open) return null

  const enviando = isCreating || criandoPaciente || salvandoEdicao

  // Aba "novo": cadastro rápido — só nome + WhatsApp são obrigatórios.
  // CPF e data de nascimento são opcionais (mas válidos se preenchidos); responsável
  // legal só é exigido quando a data foi informada e resulta em menor de 18.
  const novoValido =
    novoNome.trim().length >= 3 &&
    novoWhatsapp.replace(/\D/g, '').length >= 10 &&
    (!novoCpf.trim() || novoCpf.replace(/\D/g, '').length === 11) &&
    (!dataParaIso(novoDataBr) || !ehMenorNovo ||
      (novoRespNome.trim().length >= 3 && novoRespCpf.replace(/\D/g, '').length === 11))

  // Botão de submit habilitado conforme aba (pacienteFixo já garante paciente válido)
  const podeSubmeter =
    !!pacienteFixo || (aba === 'existente' ? !!pacienteSelecionado : novoValido)

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-[700px] max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl bg-background shadow-2xl ring-1 ring-border overflow-hidden">
        {/* Submit é disparado manualmente pelo botão (handleClickSubmit) para
            permitir criação inline do paciente antes do handleSubmit do RHF.
            onSubmit aqui só captura Enter dentro do form quando a aba é
            "existente" (na aba "novo" delega tudo pro handler manual). */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleClickSubmit()
          }}
          className="flex flex-col h-full min-h-0"
        >

          {/* Header */}
          <div className="px-6 py-5 border-b border-border bg-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {prescricaoEdicao ? 'Editar receita' : 'Nova Receita Rápida'}
                </h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  {prescricaoEdicao
                    ? 'Atualize os dados e gere o PDF novamente'
                    : 'Gere e faça download imediato do PDF de uma prescrição'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFechar}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs (Fase 10.5) — estilo pílula idêntico ao ModalEncaixeRapido.
              Ocultas quando pacienteFixo (Reorganização "Novo Atendimento" §5):
              o paciente já veio definido da porta de entrada, sem busca/cadastro aqui. */}
          {!pacienteFixo && (
          <div className="px-6 pt-4 flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setAba('existente')
                setErroAba(null)
              }}
              className={`inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-medium border transition ${
                aba === 'existente'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Selecionar existente
            </button>
            <button
              type="button"
              onClick={() => {
                setAba('novo')
                setErroAba(null)
                // Limpa seleção da outra aba para evitar inconsistência
                setPacienteSelecionado(null)
                setBuscaPaciente('')
                setValue('patient_id', '')
              }}
              className={`inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-medium border transition ${
                aba === 'novo'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Cadastrar novo
            </button>
          </div>
          )}

          {/* Conteúdo scrollável */}
          <div className="p-6 overflow-y-auto space-y-8 flex-1 min-h-0">

            {/* 1. Paciente — pacienteFixo mostra fixo (Reorganização "Novo Atendimento" §5); senão varia conforme a aba */}
            {pacienteFixo ? (
              <div className="flex flex-col gap-1.5">
                <Label>1. Paciente</Label>
                <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground">
                  {pacienteFixo.nome}
                </div>
              </div>
            ) : aba === 'existente' ? (
              <div className="flex flex-col gap-1.5">
                <Label>
                  1. Paciente <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Buscar por nome..."
                    value={pacienteSelecionado ? pacienteSelecionado.nome : buscaPaciente}
                    onChange={(e) => {
                      setBuscaPaciente(e.target.value)
                      setPacienteSelecionado(null)
                      setValue('patient_id', '')
                      setMostrarLista(true)
                    }}
                    onFocus={() => { if (!pacienteSelecionado) setMostrarLista(true) }}
                    className="pr-8"
                  />
                  {pacienteSelecionado && (
                    <button
                      type="button"
                      onClick={() => {
                        setPacienteSelecionado(null)
                        setBuscaPaciente('')
                        setValue('patient_id', '')
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Lista de resultados */}
                {mostrarLista && !pacienteSelecionado && buscaPaciente && (
                  <div className="border rounded-md max-h-40 overflow-y-auto bg-card shadow-sm">
                    {loadingPacientes ? (
                      <div className="p-2 text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                      </div>
                    ) : pacientes.length === 0 ? (
                      <p className="p-2 text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
                    ) : (
                      pacientes.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={() => {
                            setPacienteSelecionado({ id: p.id, nome: p.nome })
                            setValue('patient_id', p.id)
                            setMostrarLista(false)
                          }}
                        >
                          {p.nome}
                          {p.whatsapp && (
                            <span className="ml-2 text-xs text-muted-foreground">{p.whatsapp}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}

                {errors.patient_id && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.patient_id.message}
                  </p>
                )}
              </div>
            ) : (
              // ─── Aba "Cadastrar novo" — mesmos campos do form completo (aba Pacientes) ───
              <div className="space-y-4">
                {/* Nome (obrigatório, min 3) */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    1. Nome <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="Nome completo do paciente"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                  />
                </div>

                {/* WhatsApp (obrigatório) */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    2. WhatsApp <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="(00) 00000-0000"
                    value={novoWhatsapp}
                    onChange={(e) => setNovoWhatsapp(mascaraWhatsApp(e.target.value))}
                    className="w-full sm:w-[220px] tabular-nums font-mono"
                  />
                </div>

                {/* CPF (opcional) */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    3. CPF <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={novoCpf}
                    onChange={(e) => setNovoCpf(mascaraCPF(e.target.value))}
                    className="tabular-nums font-mono"
                  />
                </div>

                {/* Data de nascimento (opcional) */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    4. Data de nascimento{' '}
                    <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="dd/mm/aaaa"
                    value={novoDataBr}
                    onChange={(e) => setNovoDataBr(mascaraData(e.target.value))}
                    className="w-full sm:w-[200px] tabular-nums font-mono"
                  />
                </div>

                {/* Responsável legal — aparece só quando dá pra calcular idade e é menor de 18 */}
                {ehMenorNovo && (
                  <div className="space-y-4 rounded-lg border border-status-warning/30 bg-status-warning-bg/40 p-4">
                    <p className="text-[12px] font-medium text-status-warning">
                      Paciente menor de 18 — dados do responsável obrigatórios
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <Label>
                        Nome do responsável <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="text"
                        placeholder="Nome completo do responsável"
                        value={novoRespNome}
                        onChange={(e) => setNovoRespNome(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>
                        CPF do responsável <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={novoRespCpf}
                        onChange={(e) => setNovoRespCpf(mascaraCPF(e.target.value))}
                        className="w-full sm:w-[220px] tabular-nums font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Email (opcional) */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    5. Email <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                  />
                </div>

                {/* Endereço (opcional) */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    6. Endereço <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="Rua, número, bairro, cidade"
                    value={novoEndereco}
                    onChange={(e) => setNovoEndereco(e.target.value)}
                  />
                </div>

                {/* Sexo biológico (opcional) */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    7. Sexo biológico <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Select
                    value={novoSexo}
                    onValueChange={(val) => setNovoSexo(val === '' ? '' : (val as 'M' | 'F'))}
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Observações do paciente (opcional) */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    8. Observações do paciente{' '}
                    <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Textarea
                    placeholder="Informações adicionais sobre o paciente (opcional)..."
                    rows={2}
                    value={novoObservacoesPaciente}
                    onChange={(e) => setNovoObservacoesPaciente(e.target.value)}
                    className="resize-none"
                  />
                </div>
              </div>
            )}

            {/* Refração */}
            <div className="flex flex-col gap-1.5">
              <Label>
                {aba === 'existente' ? '2. ' : '9. '}Refração
              </Label>
              <div className="rounded-xl border border-border p-4">
                <Controller
                  name="dados_prescricao"
                  control={control}
                  render={({ field }) => {
                    const errosDioptria: Record<string, string> = {}
                    if (errors.dados_prescricao) {
                      const dpErrors = errors.dados_prescricao as Record<string, Record<string, { message?: string }>>
                      for (const olho of ['od', 'oe']) {
                        if (dpErrors[olho]) {
                          for (const campo of Object.keys(dpErrors[olho])) {
                            const msg = dpErrors[olho][campo]?.message
                            if (msg) errosDioptria[`${olho}.${campo}`] = msg
                          }
                        }
                      }
                    }
                    return (
                      <DioptriasGrid
                        value={{ od: field.value?.od as never, oe: field.value?.oe as never }}
                        onChange={(parcial) => field.onChange({ ...(field.value ?? {}), ...parcial })}
                        disabled={enviando}
                        erros={errosDioptria}
                      />
                    )
                  }}
                />
              </div>
            </div>

            {/* Observações */}
            <div className="flex flex-col gap-1.5">
              <Label>
                {aba === 'existente' ? '3. ' : '10. '}Observações da receita
              </Label>
              <Controller
                name="dados_prescricao.observacoes"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    placeholder="Qualquer instrução extra para o paciente..."
                    className="min-h-24 resize-none"
                  />
                )}
              />
            </div>

            {/* Validade (meses) — aparece como "Válida por X meses" no PDF */}
            <div className="flex flex-col gap-1.5">
              <Label>
                {aba === 'existente' ? '4. ' : '11. '}Validade (meses)
              </Label>
              <Controller
                name="dados_prescricao.validade_meses"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    inputMode="numeric"
                    placeholder="ex: 12"
                    className="w-full sm:w-[160px]"
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const v = e.target.value.trim()
                      const n = Number(v)
                      field.onChange(v === '' || Number.isNaN(n) ? null : n)
                    }}
                  />
                )}
              />
            </div>

            {/* Erro inline da aba (criação de paciente etc.) */}
            {erroAba && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {erroAba}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-border bg-muted/30 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleFechar}
              className="h-10 px-5 rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !podeSubmeter}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-[13px] font-medium bg-primary text-white shadow-md hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {enviando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {criandoPaciente ? 'Cadastrando paciente...' : salvandoEdicao ? 'Salvando...' : 'Gerando...'}
                </>
              ) : prescricaoEdicao ? 'Salvar alterações' : 'Gerar Receita Rápida'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
