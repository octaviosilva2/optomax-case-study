'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { pacienteSchema, type PacienteInput } from '@/lib/validations/paciente'
import { calcularIdade } from '@/lib/utils/idade'
import { validarCPF } from '@/lib/utils/cpf'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

// Separa nome e CPF do responsável armazenados como "Nome | CPF: XXX.XXX.XXX-XX"
function parsearResponsavel(valor: string | undefined): { nome: string; cpf: string } {
  if (!valor) return { nome: '', cpf: '' }
  const partes = valor.split(' | CPF: ')
  return { nome: partes[0] ?? '', cpf: partes[1] ?? '' }
}

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

// Converte dd/mm/aaaa → YYYY-MM-DD (retorna vazio se incompleto/inválido)
function dataParaIso(dataBr: string): string {
  const m = dataBr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return ''
  const [, dia, mes, ano] = m
  return `${ano}-${mes}-${dia}`
}

// Converte YYYY-MM-DD → dd/mm/aaaa (para exibir defaultValue vindo do banco)
function isoParaData(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  const [, ano, mes, dia] = m
  return `${dia}/${mes}/${ano}`
}

type Props = {
  defaultValues?: Partial<PacienteInput>
  onSubmit: (data: PacienteInput) => Promise<void>
  submitLabel: string
  loading?: boolean
  onCancel?: () => void
}

export default function FormPaciente({ defaultValues, onSubmit, submitLabel, loading, onCancel }: Props) {
  // CPF do responsável — armazenado separadamente na UI, combinado no submit
  const responsavelInicial = parsearResponsavel(defaultValues?.responsavel_legal)
  const [responsavelCpf, setResponsavelCpf] = useState(responsavelInicial.cpf)
  // Erro local do CPF do responsável (não passa pelo Zod por estar fora do schema)
  const [erroCpfResponsavel, setErroCpfResponsavel] = useState<string | null>(null)

  // Data de nascimento — visualmente em dd/mm/aaaa, mas o RHF guarda em ISO (YYYY-MM-DD)
  // Inicializa convertendo o defaultValue (que vem do banco em ISO)
  const [dataDigitada, setDataDigitada] = useState(
    isoParaData(defaultValues?.data_nascimento ?? '')
  )

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<PacienteInput>({
    resolver: zodResolver(pacienteSchema),
    defaultValues: {
      nome: '',
      data_nascimento: '',
      cpf: '',
      whatsapp: '',
      email: '',
      endereco: '',
      sexo_biologico: null,
      observacoes: '',
      origem_id: null,
      ...defaultValues,
      // Garante que responsavel_legal carrega apenas o nome (sem o CPF concatenado)
      responsavel_legal: responsavelInicial.nome,
    },
  })

  const dataNascimento = watch('data_nascimento')

  // Calcula idade a partir do campo de data de nascimento
  const idadeCalculada = dataNascimento
    ? (() => {
        try { return calcularIdade(dataNascimento) }
        catch { return null }
      })()
    : null

  const ehMenorDeIdade = idadeCalculada !== null && idadeCalculada < 18

  // Combina nome + CPF do responsável antes de enviar ao pai
  function handleFormSubmit(data: PacienteInput) {
    const nomeResp = data.responsavel_legal?.trim() ?? ''
    const cpfResp = responsavelCpf.trim()

    // CPF do responsável é obrigatório quando paciente é menor de 18 (validação local — fora do schema Zod)
    if (ehMenorDeIdade) {
      if (!cpfResp) {
        setErroCpfResponsavel('CPF do responsável é obrigatório para menores de 18 anos')
        return
      }
      if (!validarCPF(cpfResp)) {
        setErroCpfResponsavel('CPF do responsável inválido')
        return
      }
    }
    setErroCpfResponsavel(null)

    return onSubmit({
      ...data,
      responsavel_legal: cpfResp
        ? `${nomeResp} | CPF: ${cpfResp}`
        : nomeResp || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Nome completo */}
      <div className="space-y-1">
        <Label htmlFor="nome">Nome completo *</Label>
        <Input
          id="nome"
          placeholder="Nome do paciente"
          {...register('nome')}
        />
        {errors.nome && (
          <p className="text-xs text-destructive">{errors.nome.message}</p>
        )}
      </div>

      {/* WhatsApp */}
      <div className="space-y-1">
        <Label htmlFor="whatsapp">WhatsApp *</Label>
        <Controller
          name="whatsapp"
          control={control}
          render={({ field }) => (
            <Input
              id="whatsapp"
              placeholder="(00) 00000-0000"
              value={field.value}
              onChange={(e) => field.onChange(mascaraWhatsApp(e.target.value))}
            />
          )}
        />
        {errors.whatsapp && (
          <p className="text-xs text-destructive">{errors.whatsapp.message}</p>
        )}
      </div>

      {/* Data de nascimento */}
      <div className="space-y-1">
        <Label htmlFor="data_nascimento">
          Data de nascimento{' '}
          <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
          {idadeCalculada !== null && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Idade: {idadeCalculada} anos
            </span>
          )}
        </Label>
        <Controller
          name="data_nascimento"
          control={control}
          render={({ field }) => (
            <Input
              id="data_nascimento"
              type="text"
              inputMode="numeric"
              placeholder="dd/mm/aaaa"
              maxLength={10}
              autoComplete="bday"
              value={dataDigitada}
              onChange={(e) => {
                // Aplica máscara dd/mm/aaaa
                const mascarada = mascaraData(e.target.value)
                setDataDigitada(mascarada)
                // RHF guarda em ISO (vazio se ainda incompleto) — mantém schema Zod intacto
                field.onChange(dataParaIso(mascarada))
              }}
              onBlur={field.onBlur}
            />
          )}
        />
        {errors.data_nascimento && (
          <p className="text-xs text-destructive">{errors.data_nascimento.message}</p>
        )}
      </div>

      {/* CPF */}
      <div className="space-y-1">
        <Label htmlFor="cpf">
          CPF <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Controller
          name="cpf"
          control={control}
          render={({ field }) => (
            <Input
              id="cpf"
              placeholder="000.000.000-00"
              value={field.value}
              onChange={(e) => field.onChange(mascaraCPF(e.target.value))}
            />
          )}
        />
        {errors.cpf && (
          <p className="text-xs text-destructive">{errors.cpf.message}</p>
        )}
      </div>

      {/* Responsável legal — aparece apenas quando dá pra calcular idade e é menor de 18 */}
      {ehMenorDeIdade && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="responsavel_legal">
              Responsável legal *
              <span className="ml-1.5 text-xs font-normal text-status-warning">
                (obrigatório para menores de 18)
              </span>
            </Label>
            <Input
              id="responsavel_legal"
              placeholder="Nome do responsável legal"
              {...register('responsavel_legal')}
            />
            {errors.responsavel_legal && (
              <p className="text-xs text-destructive">{errors.responsavel_legal.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="responsavel_cpf">
              CPF do responsável *
              <span className="ml-1.5 text-xs font-normal text-status-warning">
                (obrigatório para menores de 18)
              </span>
            </Label>
            <Input
              id="responsavel_cpf"
              placeholder="000.000.000-00"
              inputMode="numeric"
              value={responsavelCpf}
              onChange={(e) => {
                setResponsavelCpf(mascaraCPF(e.target.value))
                // Limpa erro ao digitar
                if (erroCpfResponsavel) setErroCpfResponsavel(null)
              }}
            />
            {erroCpfResponsavel && (
              <p className="text-xs text-destructive">{erroCpfResponsavel}</p>
            )}
          </div>
        </div>
      )}

      {/* Email */}
      <div className="space-y-1">
        <Label htmlFor="email">
          Email <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="email@exemplo.com"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* Endereço */}
      <div className="space-y-1">
        <Label htmlFor="endereco">
          Endereço <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="endereco"
          placeholder="Rua, número, bairro, cidade"
          {...register('endereco')}
        />
      </div>

      {/* Sexo biológico */}
      <div className="space-y-1">
        <Label>
          Sexo biológico <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Controller
          name="sexo_biologico"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              onValueChange={(val) => field.onChange(val === '' ? null : val as 'M' | 'F')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="F">Feminino</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Observações */}
      <div className="space-y-1">
        <Label htmlFor="observacoes">
          Observações <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="observacoes"
          placeholder="Informações adicionais (opcional)..."
          rows={2}
          {...register('observacoes')}
        />
      </div>

      {/* Botão de submit */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          className="bg-primary hover:bg-primary-hover text-white"
          disabled={loading}
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
          ) : submitLabel}
        </Button>
      </div>
    </form>
  )
}
