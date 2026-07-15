'use client'

// Orquestra o padrão comum descrito na SPEC.md §5 para as portas que já têm um
// appointmentId (Adiantar, Hero, Agenda de hoje, grade da Agenda): verifica
// ficha em andamento (CA5) e, se não houver, mostra o modal Ficha × Receita e
// fia cada ramo. Reaproveitado por 4 portas — ver "Padrão comum" na spec.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import ModalEscolhaContinuar from './ModalEscolhaContinuar'
import QuickPrescriptionModal from '@/components/receitas/QuickPrescriptionModal'
import {
  verificarFichaEmAndamento,
  iniciarAtendimento,
  iniciarReceitaDeAgendamento,
} from '@/app/(app)/agenda/actions'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointmentId: string
  paciente: { id: string; nome: string }
  // Quando definido, o modal de escolha mostra "Voltar" (a porta tem um passo anterior, ex.: lista do Adiantar)
  onVoltar?: () => void
}

export default function FluxoEscolhaAtendimento({
  open,
  onOpenChange,
  appointmentId,
  paciente,
  onVoltar,
}: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [verificando, setVerificando] = useState(false)
  const [escolhaAberta, setEscolhaAberta] = useState(false)
  const [receitaAberta, setReceitaAberta] = useState(false)
  const [processando, setProcessando] = useState(false)

  // CA5: ao abrir, checa se já há ficha em_andamento daquele agendamento —
  // se houver, pula o modal e retoma direto. Senão, mostra a escolha.
  useEffect(() => {
    if (!open) {
      setEscolhaAberta(false)
      setReceitaAberta(false)
      return
    }
    let cancelado = false
    setVerificando(true)
    verificarFichaEmAndamento({ appointmentId }).then((res) => {
      if (cancelado) return
      setVerificando(false)
      if (res.recordId) {
        onOpenChange(false)
        router.push(`/ficha/${res.recordId}`)
      } else {
        setEscolhaAberta(true)
      }
    })
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointmentId])

  async function handleEscolherFicha() {
    if (processando) return
    setProcessando(true)
    try {
      const result = await iniciarAtendimento(appointmentId)
      if (result.error) throw new Error(result.error)
      queryClient.invalidateQueries({ queryKey: ['atendimentos_ativos'] })
      queryClient.invalidateQueries({ queryKey: ['atendimentos_lista'] })
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      onOpenChange(false)
      if (result.recordId) router.push(`/ficha/${result.recordId}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao iniciar atendimento.')
      setProcessando(false)
    }
  }

  async function handleEscolherReceita() {
    if (processando) return
    setProcessando(true)
    try {
      const result = await iniciarReceitaDeAgendamento(appointmentId)
      if (result.error || !result.patient) throw new Error(result.error ?? 'Falha ao iniciar receita.')
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      setEscolhaAberta(false)
      setReceitaAberta(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao iniciar receita.')
    } finally {
      setProcessando(false)
    }
  }

  return (
    <>
      <ModalEscolhaContinuar
        open={escolhaAberta && !verificando}
        onOpenChange={(o) => {
          if (!o) {
            setEscolhaAberta(false)
            onOpenChange(false)
          }
        }}
        paciente={paciente}
        onEscolherFicha={handleEscolherFicha}
        onEscolherReceita={handleEscolherReceita}
        onVoltar={onVoltar ? () => { setEscolhaAberta(false); onVoltar() } : undefined}
      />
      <QuickPrescriptionModal
        open={receitaAberta}
        onOpenChange={(o) => {
          setReceitaAberta(o)
          if (!o) onOpenChange(false)
        }}
        pacienteFixo={paciente}
        appointmentId={appointmentId}
      />
    </>
  )
}
