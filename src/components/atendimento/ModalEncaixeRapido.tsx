'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Zap, X, Loader2, AlertCircle, UserCheck, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { usePacientes } from '@/hooks/usePacientes'
import { iniciarAtendimentoWalkin } from '@/app/(app)/agenda/actions'
import { criarPaciente } from '@/app/(app)/pacientes/actions'
import { calcularIdade } from '@/lib/utils/idade'
import { validarCPF, limparCPF } from '@/lib/utils/cpf'
import ModalEscolhaContinuar from './ModalEscolhaContinuar'
import QuickPrescriptionModal from '@/components/receitas/QuickPrescriptionModal'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // 'escolha' (default, Painel "Novo atendimento"): mostra o modal Ficha×Receita.
  // 'ficha' (aba "Nova Ficha", S4/CA6): pula a escolha, cria a ficha direto
  // (comportamento anterior à reorganização) — duração continua obrigatória.
  // 'receita' (aba "Nova Receita", S4/CA6): pula duração e a escolha, abre o
  // formulário de grau direto com o paciente fixado.
  destino?: 'escolha' | 'ficha' | 'receita'
}

type Aba = 'existente' | 'novo'

// ─── Máscaras de input (cópia das usadas em FormPaciente.tsx) ──────────────
// Decisão Etapa 9 #28: copiei inline pra manter o modal autônomo — extrair
// pra um utilitário compartilhado fica pra um refator futuro.

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

export default function ModalEncaixeRapido({ open, onOpenChange, destino = 'escolha' }: Props) {
  // 'receita': não pede duração (não cria agendamento nem ficha).
  const pedeDuracao = destino !== 'receita'
  const router = useRouter()
  const queryClient = useQueryClient()
  const overlayRef = useRef<HTMLDivElement>(null)

  // Aba ativa (Etapa 9 #28)
  const [aba, setAba] = useState<Aba>('existente')

  // ── Aba "existente"
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [pacienteSelecionado, setPacienteSelecionado] = useState<{ id: string; nome: string } | null>(null)
  const [mostrarLista, setMostrarLista] = useState(false)

  // ── Aba "novo"
  const [novoNome, setNovoNome] = useState('')
  const [novoCpf, setNovoCpf] = useState('')
  const [novoWhatsapp, setNovoWhatsapp] = useState('')
  const [novoDataBr, setNovoDataBr] = useState('')
  // Responsável legal — só aparece/obrigatório quando o paciente é menor de 18.
  const [novoRespNome, setNovoRespNome] = useState('')
  const [novoRespCpf, setNovoRespCpf] = useState('')
  // Campos opcionais — mesmos do form completo (aba Pacientes).
  const [novoEmail, setNovoEmail] = useState('')
  const [novoEndereco, setNovoEndereco] = useState('')
  const [novoSexo, setNovoSexo] = useState<'M' | 'F' | ''>('')
  const [novoObservacoes, setNovoObservacoes] = useState('')

  // ── Comum as duas abas — duracao em vez de tipo de consulta
  const [duracao, setDuracao] = useState<number>(30)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Reorganização "Novo Atendimento" (SPEC §5, porta A1): paciente+duração
  // resolvidos → mostra o modal "Escolha como continuar" em vez de criar a
  // ficha direto. Sem appointmentId ainda (CA5 não se aplica ao walk-in).
  const [pacienteResolvido, setPacienteResolvido] = useState<{ id: string; nome: string } | null>(null)
  const [receitaAberta, setReceitaAberta] = useState(false)

  // Debounce na busca de pacientes (300ms) — so ativa quando a aba e "existente"
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca), 300)
    return () => clearTimeout(t)
  }, [busca])

  const { data: pacientes = [], isLoading: loadingPacientes } = usePacientes(termo)

  // Idade do novo paciente — quando menor de 18, exige dados do responsável.
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

  // Bloqueia scroll do body
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  function resetTudo() {
    setAba('existente')
    setBusca('')
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
    setNovoObservacoes('')
    setDuracao(30)
    setErro(null)
    setEnviando(false)
    setPacienteResolvido(null)
    setReceitaAberta(false)
  }

  function handleFechar() {
    resetTudo()
    onOpenChange(false)
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) handleFechar()
  }

  // Cria a ficha pro paciente informado — extraído para ser reaproveitado
  // tanto pela ramificação Ficha (após a escolha) quanto pelo modo
  // "Nova Ficha" (destino='ficha'), que pula a escolha e vai direto aqui.
  async function criarFichaPara(paciente: { id: string; nome: string }) {
    setEnviando(true)
    try {
      const result = await iniciarAtendimentoWalkin({
        patientId: paciente.id,
        duracao: duracao,
      })
      if (result.error) throw new Error(result.error)

      queryClient.invalidateQueries({ queryKey: ['atendimentos_ativos'] })
      queryClient.invalidateQueries({ queryKey: ['atendimentos_lista'] })
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['pacientes'] })

      handleFechar()
      if (result.recordId) router.push(`/ficha/${result.recordId}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao iniciar encaixe.')
      setEnviando(false)
    }
  }

  // Resolve o paciente (existente ou recém-cadastrado) e avança para o modal
  // "Escolha como continuar" — a ficha/receita só é criada depois de o
  // usuário escolher (SPEC §5, porta A1). REFATORADO: usa duracao em vez de
  // tipoConsultaId.
  async function handleIniciar() {
    // Guard contra duplo-clique: evita cadastrar o paciente duas vezes.
    if (enviando) return
    setErro(null)

    if (pedeDuracao && (!duracao || duracao < 5)) {
      setErro('Informe uma duração válida (mínimo 5 minutos).')
      return
    }

    if (aba === 'existente') {
      if (!pacienteSelecionado) {
        setErro('Selecione um paciente para iniciar.')
        return
      }
      if (destino === 'ficha') {
        await criarFichaPara(pacienteSelecionado)
        return
      }
      if (destino === 'receita') {
        setPacienteResolvido(pacienteSelecionado)
        setReceitaAberta(true)
        return
      }
      setPacienteResolvido(pacienteSelecionado)
      return
    }

    // aba === 'novo' — cadastro rápido: só nome + WhatsApp são obrigatórios.
    const nome = novoNome.trim()
    if (nome.length < 3) {
      setErro('Informe o nome completo (mínimo 3 caracteres).')
      return
    }
    if (novoWhatsapp.replace(/\D/g, '').length < 10) {
      setErro('WhatsApp é obrigatório.')
      return
    }
    // CPF opcional — se preenchido, precisa ser válido
    if (novoCpf.trim() && !validarCPF(novoCpf)) {
      setErro('CPF inválido.')
      return
    }
    // Data de nascimento opcional — se preenchida, precisa estar completa
    const dataIso = novoDataBr.trim() ? dataParaIso(novoDataBr) : ''
    if (novoDataBr.trim() && !dataIso) {
      setErro('Data de nascimento inválida (dd/mm/aaaa).')
      return
    }

    // Menor de 18 (só calculável se a data foi informada) → responsável legal obrigatório.
    // Mesmo formato do FormPaciente: nome e CPF concatenados em responsavel_legal.
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

    setEnviando(true)
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
    setEnviando(false)

    if (result.error || !result.pacienteId) {
      // CPF ja cadastrado nesta clinica — orienta o usuario a
      // usar a aba "Selecionar existente" em vez de cadastrar duplicata.
      if (result.error === 'CPF_DUPLICADO' || result.error === 'CPF_DUPLICADO_ARQUIVADO') {
        setErro('CPF já cadastrado nesta clínica. Use a aba "Selecionar existente".')
        setAba('existente')
        return
      }
      setErro(result.error ?? 'Falha ao cadastrar paciente.')
      return
    }

    // Paciente recém-criado já é "existente" a partir de agora — evita
    // recriar duplicata se o usuário voltar e reenviar o formulário.
    const novoPaciente = { id: result.pacienteId, nome }
    setPacienteSelecionado(novoPaciente)
    setAba('existente')
    if (destino === 'ficha') {
      await criarFichaPara(novoPaciente)
      return
    }
    if (destino === 'receita') {
      setPacienteResolvido(novoPaciente)
      setReceitaAberta(true)
      return
    }
    setPacienteResolvido(novoPaciente)
  }

  // Ramificação Ficha (SPEC §5): comportamento de walk-in preservado.
  async function handleEscolherFicha() {
    if (!pacienteResolvido || enviando) return
    await criarFichaPara(pacienteResolvido)
  }

  if (!open) return null

  // Ramificação Receita (SPEC §5): duração descartada, sem agendamento.
  if (receitaAberta && pacienteResolvido) {
    return (
      <QuickPrescriptionModal
        open
        onOpenChange={(o) => { if (!o) handleFechar() }}
        pacienteFixo={pacienteResolvido}
      />
    )
  }

  // Paciente + duração resolvidos → modal "Escolha como continuar" (CA1/CA2).
  if (pacienteResolvido) {
    return (
      <ModalEscolhaContinuar
        open
        onOpenChange={(o) => { if (!o) handleFechar() }}
        paciente={pacienteResolvido}
        onVoltar={() => setPacienteResolvido(null)}
        onEscolherFicha={handleEscolherFicha}
        onEscolherReceita={() => setReceitaAberta(true)}
      />
    )
  }

  // Habilita botao "Iniciar" so quando aba atual tem o minimo preenchido.
  // Na aba "novo", cadastro rápido: só nome + WhatsApp são obrigatórios. CPF e
  // data de nascimento são opcionais (mas válidos se preenchidos); responsável
  // legal só é exigido quando a data foi informada e resulta em menor de 18.
  const novoValido =
    novoNome.trim().length >= 3 &&
    novoWhatsapp.replace(/\D/g, '').length >= 10 &&
    (!novoCpf.trim() || novoCpf.replace(/\D/g, '').length === 11) &&
    (!dataParaIso(novoDataBr) || !ehMenorNovo ||
      (novoRespNome.trim().length >= 3 && novoRespCpf.replace(/\D/g, '').length === 11))

  const podeIniciar =
    (!pedeDuracao || duracao >= 5) &&
    (aba === 'existente' ? !!pacienteSelecionado : novoValido)

  const tituloHeader = destino === 'receita' ? 'Nova receita' : 'Encaixe rápido'
  const subtituloHeader = destino === 'receita'
    ? 'Emita uma receita agora, sem agendamento prévio'
    : 'Atenda agora um paciente sem agendamento prévio'

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-[560px] max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl bg-background shadow-2xl ring-1 ring-border overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{tituloHeader}</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {subtituloHeader}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFechar}
            aria-label="Fechar encaixe rápido"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs (Etapa 9 #28) — estilo pílula do ModalAdiantarAtendimento */}
        <div className="px-6 pt-4 flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => { setAba('existente'); setErro(null) }}
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
            onClick={() => { setAba('novo'); setErro(null) }}
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

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {aba === 'existente' ? (
            // ─── Aba "Selecionar existente" — fluxo original preservado ───
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                1. Paciente <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por nome, CPF ou WhatsApp..."
                  value={pacienteSelecionado ? pacienteSelecionado.nome : busca}
                  onChange={(e) => {
                    setBusca(e.target.value)
                    setPacienteSelecionado(null)
                    setMostrarLista(true)
                  }}
                  onFocus={() => { if (!pacienteSelecionado) setMostrarLista(true) }}
                  className="w-full h-10 px-3 rounded-lg bg-muted text-[13px] border border-border focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {pacienteSelecionado && (
                  <button
                    type="button"
                    onClick={() => {
                      setPacienteSelecionado(null)
                      setBusca('')
                    }}
                    aria-label="Limpar paciente selecionado"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Lista de resultados de busca */}
              {mostrarLista && !pacienteSelecionado && busca && (
                <div className="border rounded-md max-h-44 overflow-y-auto bg-card shadow-sm">
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
            // ─── Aba "Cadastrar novo" — mesmos campos do form completo (aba Pacientes) ───
            <div className="space-y-4">
              {/* Nome (obrigatório) */}
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                  1. Nome <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nome completo do paciente"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-muted text-[13px] border border-border focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* WhatsApp (obrigatório) */}
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                  2. WhatsApp <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="(00) 00000-0000"
                  value={novoWhatsapp}
                  onChange={(e) => setNovoWhatsapp(mascaraWhatsApp(e.target.value))}
                  className="w-full sm:w-[220px] h-10 px-3 rounded-lg bg-muted text-[13px] border border-border focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* CPF (opcional) */}
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                  3. CPF <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={novoCpf}
                  onChange={(e) => setNovoCpf(mascaraCPF(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg bg-muted text-[13px] border border-border focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Data de nascimento (opcional) */}
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                  4. Data de nascimento{' '}
                  <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="dd/mm/aaaa"
                  value={novoDataBr}
                  onChange={(e) => setNovoDataBr(mascaraData(e.target.value))}
                  className="w-full sm:w-[200px] h-10 px-3 rounded-lg bg-muted text-[13px] border border-border focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Responsável legal — aparece só quando dá pra calcular idade e é menor de 18 */}
              {ehMenorNovo && (
                <div className="space-y-4 rounded-lg border border-status-warning/30 bg-status-warning-bg/40 p-4">
                  <p className="text-[12px] font-medium text-status-warning">
                    Paciente menor de 18 — dados do responsável obrigatórios
                  </p>
                  <div className="space-y-2">
                    <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                      Nome do responsável <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Nome completo do responsável"
                      value={novoRespNome}
                      onChange={(e) => setNovoRespNome(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-muted text-[13px] border border-border focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                      CPF do responsável <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={novoRespCpf}
                      onChange={(e) => setNovoRespCpf(mascaraCPF(e.target.value))}
                      className="w-full sm:w-[220px] h-10 px-3 rounded-lg bg-muted text-[13px] border border-border focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {/* Email (opcional) */}
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                  5. Email <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </label>
                <input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-muted text-[13px] border border-border focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Endereço (opcional) */}
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                  6. Endereço <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro, cidade"
                  value={novoEndereco}
                  onChange={(e) => setNovoEndereco(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-muted text-[13px] border border-border focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Sexo biológico (opcional) */}
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                  7. Sexo biológico <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </label>
                <select
                  value={novoSexo}
                  onChange={(e) => setNovoSexo(e.target.value as 'M' | 'F' | '')}
                  className="w-full sm:w-[200px] h-10 px-3 rounded-lg bg-muted text-[13px] border border-border focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Selecione (opcional)</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>

              {/* Observações do paciente (opcional) */}
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                  8. Observações <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </label>
                <textarea
                  placeholder="Informações adicionais (opcional)..."
                  rows={2}
                  value={novoObservacoes}
                  onChange={(e) => setNovoObservacoes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted text-[13px] border border-border focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
          )}

          {/* Duracao (minutos) — não se aplica à receita direta (destino="receita"):
              não cria agendamento nem ficha, então duração não tem efeito nenhum. */}
          {pedeDuracao && (
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                {aba === 'existente' ? '2. ' : '9. '}Duração (minutos) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={duracao}
                onChange={(e) => setDuracao(Number(e.target.value))}
                className="w-32 h-10 px-3 rounded-lg bg-muted text-[13px] border border-border focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {/* Erro inline */}
          {erro && (
            <p className="text-[12px] text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {erro}
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
            type="button"
            onClick={handleIniciar}
            disabled={enviando || !podeIniciar}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-[13px] font-medium bg-primary text-white shadow-md hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {enviando ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Iniciando...</>
            ) : destino === 'receita' ? 'Continuar' : 'Iniciar atendimento'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
