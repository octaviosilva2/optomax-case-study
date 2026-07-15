'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { agendamentoSchema, type AgendamentoFormData } from '@/lib/validations/agendamento'
import { detectarConflito } from '@/lib/utils/agenda'
import { useCriarAgendamento, useAtualizarAgendamento, useAgendaDia } from '@/hooks/useAgenda'
import { usePacientes, useCriarPaciente } from '@/hooks/usePacientes'
import { logEventClient } from '@/lib/events'
import { validarCPF, limparCPF } from '@/lib/utils/cpf'
import { calcularIdade } from '@/lib/utils/idade'
import { Loader2, AlertTriangle, UserPlus, X } from 'lucide-react'

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

// Formata Date para o formato do input datetime-local sem conversão UTC
function toLocalDateTimeInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}`
}

// Retorna data selecionada + hora atual arredondada para próximo slot de 15 min
function getDefaultDataHora(dataSelecionada: Date): string {
  const agora = new Date()
  const resultado = new Date(dataSelecionada)
  const minutosArredondados = Math.ceil(agora.getMinutes() / 15) * 15
  if (minutosArredondados >= 60) {
    resultado.setHours(agora.getHours() + 1, 0, 0, 0)
  } else {
    resultado.setHours(agora.getHours(), minutosArredondados, 0, 0)
  }
  return toLocalDateTimeInput(resultado)
}

// Converte string "YYYY-MM-DDTHH:mm" (local) para ISO UTC para salvar no banco
function localStringParaISO(localStr: string): string {
  return new Date(localStr).toISOString()
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  dataSelecionada: Date
  /** Data/hora exata do slot clicado na grade — preenche o campo ao abrir. */
  dataHoraInicial?: Date
  /** Paciente pré-selecionado (ex.: ao "Reagendar" a partir de um evento). */
  pacienteInicial?: { id: string; nome: string }
  /** Quando presente, o modal entra em modo EDIÇÃO desse agendamento. */
  agendamentoEditar?: {
    id: string
    patientId: string
    patientNome: string
    dataHora: string
    duracao: number
    observacao: string | null
  }
}

export default function ModalNovoAgendamento({
  open,
  onOpenChange,
  orgId,
  dataSelecionada,
  dataHoraInicial,
  pacienteInicial,
  agendamentoEditar,
}: Props) {
  const isEdit = !!agendamentoEditar
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [conflito, setConflito] = useState<string | null>(null)
  const [miniFormAberto, setMiniFormAberto] = useState(false)
  const [miniNome, setMiniNome] = useState('')
  const [miniWhatsapp, setMiniWhatsapp] = useState('')
  const [miniCpf, setMiniCpf] = useState('')
  const [miniDataBr, setMiniDataBr] = useState('')
  // Responsável legal — só aparece/obrigatório quando o paciente é menor de 18.
  const [miniRespNome, setMiniRespNome] = useState('')
  const [miniRespCpf, setMiniRespCpf] = useState('')
  const [miniEmail, setMiniEmail] = useState('')
  const [miniEndereco, setMiniEndereco] = useState('')
  const [miniSexo, setMiniSexo] = useState<'M' | 'F' | ''>('')
  const [miniObservacoes, setMiniObservacoes] = useState('')
  const [erroMiniForm, setErroMiniForm] = useState<string | null>(null)

  const { data: pacientes = [], isLoading: loadingPacientes } = usePacientes(buscaPaciente)
  const { data: agendamentosDia = [] } = useAgendaDia(dataSelecionada)
  const criarAgendamento = useCriarAgendamento()
  const atualizarAgendamento = useAtualizarAgendamento()
  const criarPaciente = useCriarPaciente()
  const [savingPaciente, setSavingPaciente] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AgendamentoFormData>({
    resolver: zodResolver(agendamentoSchema),
    defaultValues: {
      duracao: 30, // duracao padrao 30 minutos
    },
  })

  const patientId = watch('patient_id')
  // Duracao agora vem direto do form (input de minutos), nao do tipo de consulta
  const duracaoAtual = watch('duracao') ?? 30

  // Idade do novo paciente (mini-form) — quando menor de 18, exige dados do responsável.
  const dataIsoMini = dataParaIso(miniDataBr)
  const idadeMini = dataIsoMini
    ? (() => {
        try { return calcularIdade(dataIsoMini) }
        catch { return null }
      })()
    : null
  const ehMenorMini = idadeMini !== null && idadeMini < 18

  // Preenche data/hora automaticamente ao abrir o modal — agenda livre,
  // sem slots pré-definidos.
  useEffect(() => {
    if (!open) return
    if (agendamentoEditar) {
      // Modo edição: pré-preenche com os dados do agendamento.
      setValue('patient_id', agendamentoEditar.patientId)
      setBuscaPaciente(agendamentoEditar.patientNome)
      setValue('data_hora', toLocalDateTimeInput(new Date(agendamentoEditar.dataHora)))
      setValue('duracao', agendamentoEditar.duracao)
      setValue('observacao', agendamentoEditar.observacao ?? '')
      return
    }
    // Slot clicado tem prioridade sobre o "próximo horário" padrão.
    setValue(
      'data_hora',
      dataHoraInicial ? toLocalDateTimeInput(dataHoraInicial) : getDefaultDataHora(dataSelecionada)
    )
    if (pacienteInicial) {
      setValue('patient_id', pacienteInicial.id)
      setBuscaPaciente(pacienteInicial.nome)
    }
  }, [open, dataSelecionada, dataHoraInicial, pacienteInicial, agendamentoEditar]) // eslint-disable-line react-hooks/exhaustive-deps

  function verificarConflito(dataHoraISO: string) {
    if (!dataHoraISO) { setConflito(null); return }
    const resultado = detectarConflito(
      agendamentosDia,
      new Date(dataHoraISO),
      duracaoAtual
    )
    setConflito(resultado.mensagem)
  }

  // Submit SEM tipo_consulta — usa duracao diretamente do form
  async function onSubmit(values: AgendamentoFormData) {
    if (conflito) {
      toast.error(conflito)
      return
    }

    try {
      if (isEdit && agendamentoEditar) {
        // Modo edição: atualiza o agendamento existente (paciente não muda).
        await atualizarAgendamento.mutateAsync({
          id: agendamentoEditar.id,
          data_hora: localStringParaISO(values.data_hora),
          duracao: values.duracao,
          observacao: values.observacao ?? null,
        })
        toast.success('Agendamento atualizado!')
        reset({ duracao: 30 })
        setBuscaPaciente('')
        setConflito(null)
        onOpenChange(false)
        return
      }

      await criarAgendamento.mutateAsync({
        org_id: orgId,
        patient_id: values.patient_id,
        // Converte para UTC antes de salvar — evita desvio de fuso horário
        data_hora: localStringParaISO(values.data_hora),
        duracao: values.duracao,
        observacao: values.observacao ?? null,
        walkin: false,
      })
      // Evento: agendamento criado (não-bloqueante — usado pelo painel /admin)
      logEventClient('appointment_created', { patient_id: values.patient_id })
      toast.success('Agendamento criado!')
      reset({ duracao: 30 }) // reseta com duracao padrao
      setBuscaPaciente('')
      setConflito(null)
      onOpenChange(false)
    } catch {
      toast.error(isEdit ? 'Erro ao atualizar agendamento.' : 'Erro ao criar agendamento.')
    }
  }

  // Cadastro rápido via server action — mesmos campos do form completo (aba
  // Pacientes). Só nome + WhatsApp são obrigatórios; os demais são opcionais.
  async function handleCadastrarPaciente() {
    setErroMiniForm(null)
    const nome = miniNome.trim()
    if (nome.length < 3) {
      setErroMiniForm('Informe o nome completo (mínimo 3 caracteres).')
      return
    }
    if (miniWhatsapp.replace(/\D/g, '').length < 10) {
      setErroMiniForm('WhatsApp é obrigatório.')
      return
    }
    // CPF opcional — se preenchido, precisa ser válido
    if (miniCpf.trim() && !validarCPF(miniCpf)) {
      setErroMiniForm('CPF inválido.')
      return
    }
    // Data de nascimento opcional — se preenchida, precisa estar completa
    const dataIso = miniDataBr.trim() ? dataParaIso(miniDataBr) : ''
    if (miniDataBr.trim() && !dataIso) {
      setErroMiniForm('Data de nascimento inválida (dd/mm/aaaa).')
      return
    }
    // Menor de 18 (só calculável se a data foi informada) → responsável legal obrigatório
    let responsavelLegal: string | null = null
    if (dataIso && ehMenorMini) {
      const respNome = miniRespNome.trim()
      if (respNome.length < 3) {
        setErroMiniForm('Nome do responsável é obrigatório para menores de 18.')
        return
      }
      if (!validarCPF(miniRespCpf)) {
        setErroMiniForm('CPF do responsável é obrigatório e deve ser válido.')
        return
      }
      responsavelLegal = `${respNome} | CPF: ${miniRespCpf}`
    }

    setSavingPaciente(true)
    try {
      const result = await criarPaciente.mutateAsync({
        nome,
        whatsapp: miniWhatsapp.trim(),
        cpf: miniCpf.trim() ? limparCPF(miniCpf) : '',
        data_nascimento: dataIso ?? '',
        responsavel_legal: responsavelLegal ?? '',
        email: miniEmail.trim(),
        endereco: miniEndereco.trim(),
        sexo_biologico: miniSexo || null,
        observacoes: miniObservacoes.trim(),
      })
      if (result.pacienteId) {
        setValue('patient_id', result.pacienteId)
        setBuscaPaciente(nome)
      }
      setMiniFormAberto(false)
      setMiniNome('')
      setMiniWhatsapp('')
      setMiniCpf('')
      setMiniDataBr('')
      setMiniRespNome('')
      setMiniRespCpf('')
      setMiniEmail('')
      setMiniEndereco('')
      setMiniSexo('')
      setMiniObservacoes('')
      toast.success('Paciente cadastrado!')
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? ''
      if (msg === 'CPF_DUPLICADO' || msg === 'CPF_DUPLICADO_ARQUIVADO') {
        setErroMiniForm('CPF já cadastrado. Busque o paciente na lista acima.')
      } else if (msg === 'VALIDACAO_FALHOU') {
        toast.error('Dados inválidos. Verifique os campos.')
      } else {
        toast.error('Erro ao cadastrar paciente.')
      }
    } finally {
      setSavingPaciente(false)
    }
  }

  function handleClose() {
    reset()
    setBuscaPaciente('')
    setConflito(null)
    setMiniFormAberto(false)
    setMiniNome('')
    setMiniWhatsapp('')
    setMiniCpf('')
    setMiniDataBr('')
    setMiniRespNome('')
    setMiniRespCpf('')
    setMiniEmail('')
    setMiniEndereco('')
    setMiniSexo('')
    setMiniObservacoes('')
    setErroMiniForm(null)
    onOpenChange(false)
  }

  // Agenda totalmente livre: permite agendar de agora até 1 ano à frente,
  // qualquer dia da semana, qualquer horário.
  const dataMin = toLocalDateTimeInput(new Date())
  const dataMax = toLocalDateTimeInput((() => {
    const limite = new Date()
    limite.setFullYear(limite.getFullYear() + 1)
    limite.setHours(23, 59, 0, 0)
    return limite
  })())

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-sans text-xl font-semibold text-foreground">{isEdit ? 'Editar agendamento' : 'Novo agendamento'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Paciente */}
          <div className="space-y-1">
            <Label>Paciente *</Label>
            <Input
              placeholder="Buscar por nome, CPF ou WhatsApp..."
              value={buscaPaciente}
              disabled={isEdit}
              onChange={(e) => {
                setBuscaPaciente(e.target.value)
                setValue('patient_id', '')
              }}
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                Para trocar o paciente, cancele e crie um novo agendamento.
              </p>
            )}
            {!isEdit && buscaPaciente && !miniFormAberto && !patientId && (
              <div className="border rounded-md max-h-40 overflow-y-auto bg-card shadow-sm">
                {loadingPacientes ? (
                  <div className="p-2 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                  </div>
                ) : pacientes.length === 0 ? (
                  <div className="p-2 space-y-1">
                    <p className="text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
                    <button
                      type="button"
                      onClick={() => setMiniFormAberto(true)}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Cadastrar novo paciente
                    </button>
                  </div>
                ) : (
                  pacientes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => {
                        setValue('patient_id', p.id)
                        setBuscaPaciente(p.nome)
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

            {miniFormAberto && (
              <div className="border rounded-md bg-muted p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Novo paciente</p>
                  <button
                    type="button"
                    onClick={() => setMiniFormAberto(false)}
                    className="text-muted-foreground hover:text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Nome completo *</Label>
                  <Input
                    placeholder="Nome do paciente"
                    value={miniNome}
                    onChange={(e) => setMiniNome(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">WhatsApp *</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={miniWhatsapp}
                    onChange={(e) => setMiniWhatsapp(mascaraWhatsApp(e.target.value))}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">CPF (opcional)</Label>
                  <Input
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    value={miniCpf}
                    onChange={(e) => setMiniCpf(mascaraCPF(e.target.value))}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Data de nascimento (opcional)</Label>
                  <Input
                    placeholder="dd/mm/aaaa"
                    inputMode="numeric"
                    value={miniDataBr}
                    onChange={(e) => setMiniDataBr(mascaraData(e.target.value))}
                    className="h-8 text-sm w-[140px]"
                  />
                </div>

                {/* Responsável legal — aparece só quando dá pra calcular idade e é menor de 18 */}
                {ehMenorMini && (
                  <div className="space-y-2 rounded-md border border-status-warning/30 bg-status-warning-bg/40 p-2">
                    <p className="text-[11px] font-medium text-status-warning">
                      Paciente menor de 18 — dados do responsável obrigatórios
                    </p>
                    <div className="space-y-1">
                      <Label className="text-xs">Nome do responsável *</Label>
                      <Input
                        placeholder="Nome completo do responsável"
                        value={miniRespNome}
                        onChange={(e) => setMiniRespNome(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CPF do responsável *</Label>
                      <Input
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                        value={miniRespCpf}
                        onChange={(e) => setMiniRespCpf(mascaraCPF(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Email (opcional)</Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={miniEmail}
                    onChange={(e) => setMiniEmail(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Endereço (opcional)</Label>
                  <Input
                    placeholder="Rua, número, bairro, cidade"
                    value={miniEndereco}
                    onChange={(e) => setMiniEndereco(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Sexo biológico (opcional)</Label>
                  <Select
                    value={miniSexo}
                    onValueChange={(val) => setMiniSexo(val === '' ? '' : (val as 'M' | 'F'))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Observações (opcional)</Label>
                  <Textarea
                    placeholder="Informações adicionais (opcional)..."
                    rows={2}
                    value={miniObservacoes}
                    onChange={(e) => setMiniObservacoes(e.target.value)}
                    className="text-sm resize-none"
                  />
                </div>

                {erroMiniForm && (
                  <p className="text-xs text-destructive">{erroMiniForm}</p>
                )}

                <Button
                  type="button"
                  size="sm"
                  className="w-full bg-primary hover:bg-primary-hover text-white"
                  disabled={!miniNome.trim() || miniWhatsapp.replace(/\D/g, '').length < 10 || savingPaciente}
                  onClick={handleCadastrarPaciente}
                >
                  {savingPaciente ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Salvando...</>
                  ) : 'Cadastrar e selecionar'}
                </Button>
              </div>
            )}
            {errors.patient_id && (
              <p className="text-xs text-destructive">{errors.patient_id.message}</p>
            )}
          </div>

          {/* Duracao (minutos) — substituiu o Select de tipo de consulta */}
          <div className="space-y-1">
            <Label>Duração (minutos) *</Label>
            <Input
              type="number"
              min={5}
              max={480}
              step={5}
              placeholder="30"
              {...register('duracao', { valueAsNumber: true })}
              onChange={(e) => {
                register('duracao', { valueAsNumber: true }).onChange(e)
                // Recalcula conflito com nova duracao
                const dataHora = watch('data_hora')
                if (dataHora) {
                  setTimeout(() => verificarConflito(dataHora), 0)
                }
              }}
              className="w-32"
            />
            {errors.duracao && (
              <p className="text-xs text-destructive">{errors.duracao.message}</p>
            )}
          </div>

          {/* Horário — qualquer data/hora dentro de 1 ano */}
          <div className="space-y-1">
            <Label>Data e horário *</Label>
            <Input
              type="datetime-local"
              min={dataMin}
              max={dataMax}
              {...register('data_hora')}
              onChange={(e) => {
                register('data_hora').onChange(e)
                verificarConflito(e.target.value)
              }}
            />

            {errors.data_hora && (
              <p className="text-xs text-destructive">{errors.data_hora.message}</p>
            )}
            {conflito && (
              <div className="flex items-center gap-1.5 text-xs text-status-warning bg-status-warning-bg border border-status-warning/30 rounded px-2 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {conflito}
              </div>
            )}
          </div>

          {/* Observação */}
          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea placeholder="Opcional..." rows={2} {...register('observacao')} />
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary-hover text-white"
              disabled={criarAgendamento.isPending || atualizarAgendamento.isPending || !!conflito}
            >
              {criarAgendamento.isPending || atualizarAgendamento.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
              ) : isEdit ? 'Salvar' : 'Agendar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
