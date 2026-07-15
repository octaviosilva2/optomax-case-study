'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Loader2, Search, Stethoscope } from 'lucide-react'
import { usePacientes } from '@/hooks/usePacientes'
import { iniciarAtendimentoWalkin } from '@/app/(app)/agenda/actions'
import ModalEscolhaContinuar from '@/components/atendimento/ModalEscolhaContinuar'
import QuickPrescriptionModal from '@/components/receitas/QuickPrescriptionModal'

type PacienteFixo = {
  id: string
  nome: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Quando passado, abre o modal com paciente já fixado (uso no perfil do paciente)
  pacienteFixo?: PacienteFixo
}

// Dados coletados no form antes de ramificar Ficha × Receita (SPEC §5, porta E).
type DadosPendentes = {
  pacienteId: string
  pacienteNome: string
  duracao: number
  titulo: string
  observacao: string
}

export default function ModalNovoAtendimento({
  open,
  onOpenChange,
  pacienteFixo,
}: Props) {
  const router = useRouter()
  // Reorganização "Novo Atendimento": após coletar duração/título/obs (como
  // hoje), abre o modal "Escolha como continuar" em vez de criar a ficha
  // direto (sem appointmentId ainda — CA5 não se aplica aqui).
  const [step, setStep] = useState<'form' | 'escolha' | 'receita'>('form')
  const [pendente, setPendente] = useState<DadosPendentes | null>(null)
  const [enviando, setEnviando] = useState(false)

  function handleClose() {
    setStep('form')
    setPendente(null)
    setEnviando(false)
    onOpenChange(false)
  }

  // Ramificação Ficha: comportamento de walk-in preservado.
  async function handleEscolherFicha() {
    if (!pendente || enviando) return
    setEnviando(true)
    const res = await iniciarAtendimentoWalkin({
      patientId: pendente.pacienteId,
      duracao: pendente.duracao,
      observacao: pendente.observacao.trim() || null,
      titulo: pendente.titulo.trim() || null,
    })
    setEnviando(false)
    if (res.error || !res.recordId) {
      toast.error('Erro ao iniciar atendimento: ' + (res.error ?? 'desconhecido'))
      return
    }
    handleClose()
    router.push(`/ficha/${res.recordId}`)
  }

  if (!open) return null

  // Ramificação Receita: duração/título/obs descartados, sem agendamento.
  if (step === 'receita' && pendente) {
    return (
      <QuickPrescriptionModal
        open
        onOpenChange={(o) => { if (!o) handleClose() }}
        pacienteFixo={{ id: pendente.pacienteId, nome: pendente.pacienteNome }}
      />
    )
  }

  if (step === 'escolha' && pendente) {
    return (
      <ModalEscolhaContinuar
        open
        onOpenChange={(o) => { if (!o) handleClose() }}
        paciente={{ id: pendente.pacienteId, nome: pendente.pacienteNome }}
        onVoltar={() => setStep('form')}
        onEscolherFicha={handleEscolherFicha}
        onEscolherReceita={() => setStep('receita')}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-sans text-xl font-semibold text-foreground">
            Novo atendimento
          </DialogTitle>
        </DialogHeader>

        {/* Conteúdo só monta quando aberto — garante reset ao fechar/reabrir
            sem precisar de useEffect+setState (evita cascading renders) */}
        {open && (
          <ModalConteudo
            pacienteFixo={pacienteFixo}
            valoresIniciais={pendente}
            onClose={handleClose}
            onProntoParaEscolha={(dados) => { setPendente(dados); setStep('escolha') }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ModalConteudo({
  pacienteFixo,
  valoresIniciais,
  onClose,
  onProntoParaEscolha,
}: {
  pacienteFixo?: PacienteFixo
  valoresIniciais: DadosPendentes | null
  onClose: () => void
  onProntoParaEscolha: (dados: DadosPendentes) => void
}) {
  const [busca, setBusca] = useState('')
  const [pacienteId, setPacienteId] = useState<string | null>(
    valoresIniciais?.pacienteId ?? pacienteFixo?.id ?? null,
  )
  const [pacienteNome, setPacienteNome] = useState(
    valoresIniciais?.pacienteNome ?? pacienteFixo?.nome ?? '',
  )
  // Duracao em vez de tipoConsultaId (removido na refatoracao)
  const [duracao, setDuracao] = useState<number>(valoresIniciais?.duracao ?? 30)
  const [titulo, setTitulo] = useState(valoresIniciais?.titulo ?? '')
  const [observacao, setObservacao] = useState(valoresIniciais?.observacao ?? '')

  const { data: pacientes = [], isLoading: loadingPacientes } = usePacientes(busca)

  function selecionarPaciente(id: string, nome: string) {
    setPacienteId(id)
    setPacienteNome(nome)
    setBusca('')
  }

  function handleContinuar() {
    if (!pacienteId) {
      toast.error('Selecione um paciente.')
      return
    }
    if (!duracao || duracao < 5) {
      toast.error('Informe uma duração válida (mínimo 5 minutos).')
      return
    }
    onProntoParaEscolha({ pacienteId, pacienteNome, duracao, titulo, observacao })
  }

  return (
    <div className="space-y-4">
      {/* Seletor de paciente — escondido quando pacienteFixo */}
      {pacienteFixo ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Paciente</Label>
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground">
            {pacienteFixo.nome}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="busca-pac">Paciente</Label>
          {pacienteId && pacienteNome ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2 text-sm">
              <span className="font-medium text-foreground">{pacienteNome}</span>
              <button
                type="button"
                onClick={() => {
                  setPacienteId(null)
                  setPacienteNome('')
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Trocar
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="busca-pac"
                  placeholder="Buscar por nome, CPF ou WhatsApp..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-8"
                  autoComplete="off"
                />
              </div>
              {busca.trim().length > 0 && (
                <div className="max-h-44 overflow-auto rounded-md border border-border bg-card">
                  {loadingPacientes ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="inline h-3.5 w-3.5 animate-spin mr-1" />
                      Buscando...
                    </div>
                  ) : pacientes.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Nenhum paciente encontrado.
                    </div>
                  ) : (
                    pacientes.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selecionarPaciente(p.id, p.nome)}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      >
                        {p.nome}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Nome do atendimento (opcional) — exibido no histórico do paciente */}
      <div className="space-y-2">
        <Label htmlFor="titulo-atend">Nome do atendimento (opcional)</Label>
        <Input
          id="titulo-atend"
          placeholder="Ex.: Consulta de rotina, Retorno..."
          maxLength={120}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </div>

      {/* Duracao (minutos) — substituiu o select de tipo de consulta */}
      <div className="space-y-2">
        <Label>Duração (minutos)</Label>
        <Input
          type="number"
          min={5}
          max={480}
          step={5}
          value={duracao}
          onChange={(e) => setDuracao(Number(e.target.value))}
          className="w-32"
        />
      </div>

      {/* Observação */}
      <div className="space-y-2">
        <Label htmlFor="obs">Observação (opcional)</Label>
        <Textarea
          id="obs"
          rows={2}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          className="bg-primary hover:bg-primary-hover gap-2"
          onClick={handleContinuar}
        >
          <Stethoscope className="h-4 w-4" />
          Iniciar atendimento
        </Button>
      </div>
    </div>
  )
}
