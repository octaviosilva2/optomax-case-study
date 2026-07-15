'use client'

// Página de entrada da receita avulsa (CA19) — substitui o modal de criação.
// Reusa a MESMA UX de abas (existente/cadastrar novo) do QuickPrescriptionModal
// e do ModalEncaixeRapido (destino='receita'), copiada inline seguindo a
// convenção já adotada nesses dois (Fase 10.5: "mantém o modal autônomo").
// Ao resolver o paciente, cria o rascunho (criarRascunhoReceita) e navega
// direto para a página de preenchimento — sem passar pelo formulário de grau
// aqui (isso vive em /receitas/[id]/editar).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, UserCheck, UserPlus, X, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { usePacientes } from '@/hooks/usePacientes'
import { criarPaciente } from '@/app/(app)/pacientes/actions'
import { criarRascunhoReceita } from '@/app/(app)/receitas/actions'
import { validarCPF, limparCPF } from '@/lib/utils/cpf'
import { calcularIdade } from '@/lib/utils/idade'
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

type Aba = 'existente' | 'novo'

// Máscaras (cópia deliberada — mesmo padrão de QuickPrescriptionModal/ModalEncaixeRapido).
function mascaraCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
function mascaraWhatsApp(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}
function mascaraData(v: string) {
  return v.replace(/\D/g, '').slice(0, 8)
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})(\d)/, '$1/$2')
}
function dataParaIso(dataBr: string): string | null {
  const m = dataBr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, dia, mes, ano] = m
  return `${ano}-${mes}-${dia}`
}

// Classe da aba pílula — extraída (não inline no className) para o hook de
// auditoria de cores não confundir a interpolação de tokens com hardcoded.
function tabClass(ativa: boolean) {
  return `inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-medium border transition ${
    ativa
      ? 'bg-primary text-primary-foreground border-primary'
      : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
  }`
}

export function NovaReceitaView() {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('existente')

  // ── Aba "existente"
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [termo, setTermo] = useState('')
  const [pacienteSelecionado, setPacienteSelecionado] = useState<{ id: string; nome: string } | null>(null)
  const [mostrarLista, setMostrarLista] = useState(false)

  // ── Aba "novo"
  const [novoNome, setNovoNome] = useState('')
  const [novoCpf, setNovoCpf] = useState('')
  const [novoWhatsapp, setNovoWhatsapp] = useState('')
  const [novoDataBr, setNovoDataBr] = useState('')
  const [novoRespNome, setNovoRespNome] = useState('')
  const [novoRespCpf, setNovoRespCpf] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novoEndereco, setNovoEndereco] = useState('')
  const [novoSexo, setNovoSexo] = useState<'M' | 'F' | ''>('')
  const [novoObservacoes, setNovoObservacoes] = useState('')

  const [criandoPaciente, setCriandoPaciente] = useState(false)
  const [criandoRascunho, setCriandoRascunho] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setTermo(buscaPaciente), 300)
    return () => clearTimeout(t)
  }, [buscaPaciente])

  const { data: pacientes = [], isLoading: loadingPacientes } = usePacientes(termo)

  const dataIsoNovo = dataParaIso(novoDataBr)
  const idadeNovo = dataIsoNovo
    ? (() => {
        try { return calcularIdade(dataIsoNovo) }
        catch { return null }
      })()
    : null
  const ehMenorNovo = idadeNovo !== null && idadeNovo < 18

  const novoValido =
    novoNome.trim().length >= 3 &&
    novoWhatsapp.replace(/\D/g, '').length >= 10 &&
    (!novoCpf.trim() || novoCpf.replace(/\D/g, '').length === 11) &&
    (!dataParaIso(novoDataBr) || !ehMenorNovo ||
      (novoRespNome.trim().length >= 3 && novoRespCpf.replace(/\D/g, '').length === 11))

  const enviando = criandoPaciente || criandoRascunho
  const podeContinuar = aba === 'existente' ? !!pacienteSelecionado : novoValido

  // Cria o rascunho e leva direto à página de preenchimento (CA19).
  async function iniciarRascunho(patientId: string) {
    setCriandoRascunho(true)
    const res = await criarRascunhoReceita(patientId)
    setCriandoRascunho(false)
    if (res.error || !res.id) {
      toast.error(res.error ?? 'Falha ao criar rascunho de receita.')
      return
    }
    router.replace(`/receitas/${res.id}/editar`)
  }

  async function handleContinuar() {
    if (enviando) return
    setErro(null)

    if (aba === 'existente') {
      if (!pacienteSelecionado) {
        setErro('Selecione um paciente para continuar.')
        return
      }
      await iniciarRascunho(pacienteSelecionado.id)
      return
    }

    // ── Aba "novo": cadastro rápido — só nome + WhatsApp são obrigatórios ──
    const nome = novoNome.trim()
    if (nome.length < 3) {
      setErro('Informe o nome completo (mínimo 3 caracteres).')
      return
    }
    if (novoWhatsapp.replace(/\D/g, '').length < 10) {
      setErro('WhatsApp é obrigatório.')
      return
    }
    if (novoCpf.trim() && !validarCPF(novoCpf)) {
      setErro('CPF inválido.')
      return
    }
    const dataIso = novoDataBr.trim() ? dataParaIso(novoDataBr) : ''
    if (novoDataBr.trim() && !dataIso) {
      setErro('Data de nascimento inválida (dd/mm/aaaa).')
      return
    }

    let responsavelLegal: string | null = null
    if (dataIso && ehMenorNovo) {
      const respNome = novoRespNome.trim()
      if (respNome.length < 3) {
        setErro('Nome do responsável é obrigatório para menores de 18.')
        return
      }
      if (!validarCPF(novoRespCpf)) {
        setErro('CPF do responsável é obrigatório e deve ser válido.')
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
      observacoes: novoObservacoes.trim(),
    })
    setCriandoPaciente(false)

    if (result.error || !result.pacienteId) {
      if (result.error === 'CPF_DUPLICADO' || result.error === 'CPF_DUPLICADO_ARQUIVADO') {
        setErro('CPF já cadastrado nesta clínica. Use a aba "Selecionar existente".')
      } else {
        toast.error(
          result.error === 'VALIDACAO_FALHOU'
            ? 'Dados do paciente inválidos. Verifique os campos.'
            : (result.error ?? 'Falha ao cadastrar paciente.'),
        )
      }
      return
    }

    await iniciarRascunho(result.pacienteId)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-1">
      <button
        type="button"
        onClick={() => router.push('/receitas')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar às receitas
      </button>

      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Nova receita</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Selecione o paciente para começar o preenchimento
            </p>
          </div>
        </div>

        {/* Tabs — mesmo estilo pílula do QuickPrescriptionModal */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => { setAba('existente'); setErro(null) }}
            className={tabClass(aba === 'existente')}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Selecionar existente
          </button>
          <button
            type="button"
            onClick={() => {
              setAba('novo')
              setErro(null)
              setPacienteSelecionado(null)
              setBuscaPaciente('')
            }}
            className={tabClass(aba === 'novo')}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Cadastrar novo
          </button>
        </div>

        {aba === 'existente' ? (
          <div className="flex flex-col gap-1.5">
            <Label>
              Paciente <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Buscar por nome..."
                value={pacienteSelecionado ? pacienteSelecionado.nome : buscaPaciente}
                onChange={(e) => {
                  setBuscaPaciente(e.target.value)
                  setPacienteSelecionado(null)
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
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

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
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input
                type="text"
                placeholder="Nome completo do paciente"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>WhatsApp <span className="text-destructive">*</span></Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={novoWhatsapp}
                onChange={(e) => setNovoWhatsapp(mascaraWhatsApp(e.target.value))}
                className="w-full sm:w-[220px] tabular-nums font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>CPF <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={novoCpf}
                onChange={(e) => setNovoCpf(mascaraCPF(e.target.value))}
                className="tabular-nums font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Data de nascimento <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={novoDataBr}
                onChange={(e) => setNovoDataBr(mascaraData(e.target.value))}
                className="w-full sm:w-[200px] tabular-nums font-mono"
              />
            </div>

            {ehMenorNovo && (
              <div className="space-y-4 rounded-lg border border-status-warning/30 bg-status-warning-bg/40 p-4">
                <p className="text-[12px] font-medium text-status-warning">
                  Paciente menor de 18 — dados do responsável obrigatórios
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label>Nome do responsável <span className="text-destructive">*</span></Label>
                  <Input
                    type="text"
                    placeholder="Nome completo do responsável"
                    value={novoRespNome}
                    onChange={(e) => setNovoRespNome(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>CPF do responsável <span className="text-destructive">*</span></Label>
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

            <div className="flex flex-col gap-1.5">
              <Label>Email <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Endereço <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Input
                type="text"
                placeholder="Rua, número, bairro, cidade"
                value={novoEndereco}
                onChange={(e) => setNovoEndereco(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Sexo biológico <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
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
            <div className="flex flex-col gap-1.5">
              <Label>Observações do paciente <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea
                placeholder="Informações adicionais sobre o paciente (opcional)..."
                rows={2}
                value={novoObservacoes}
                onChange={(e) => setNovoObservacoes(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>
        )}

        {erro && (
          <p className="text-xs text-destructive">{erro}</p>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => router.push('/receitas')}
            className="h-10 px-5 rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleContinuar}
            disabled={enviando || !podeContinuar}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-[13px] font-medium bg-primary text-white shadow-md hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {criandoPaciente ? 'Cadastrando paciente...' : 'Criando rascunho...'}
              </>
            ) : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  )
}
