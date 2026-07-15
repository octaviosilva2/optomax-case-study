'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import FormPaciente from '@/components/FormPaciente'
import { useCriarPaciente, useAtualizarPaciente, usePaciente, useRestaurarPaciente } from '@/hooks/usePacientes'
import type { PacienteInput } from '@/lib/validations/paciente'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Quando presente, o modal entra em modo EDIÇÃO desse paciente. */
  pacienteEditarId?: string
}

export default function ModalNovoPaciente({ open, onOpenChange, pacienteEditarId }: Props) {
  const router = useRouter()
  const isEdit = !!pacienteEditarId
  const criarPaciente = useCriarPaciente()
  const atualizarPaciente = useAtualizarPaciente()
  const restaurarPaciente = useRestaurarPaciente()
  const [loading, setLoading] = useState(false)

  // Detalhe completo do paciente (só busca em modo edição com o modal aberto).
  const { data: detalhe, isLoading: carregandoDetalhe } = usePaciente(
    open && isEdit ? pacienteEditarId! : ''
  )

  async function handleCriar(data: PacienteInput) {
    setLoading(true)
    try {
      const result = await criarPaciente.mutateAsync(data)
      toast.success('Paciente cadastrado com sucesso!')
      onOpenChange(false)
      // Redireciona para o perfil do novo paciente
      if (result.pacienteId) {
        router.push(`/pacientes/${result.pacienteId}`)
      }
    } catch (err: unknown) {
      const error = err as Error & { pacienteExistenteId?: string }
      const msg = error?.message ?? ''

      if (msg === 'CPF_DUPLICADO') {
        const existenteId = error.pacienteExistenteId
        toast.error('CPF já cadastrado.', {
          action: existenteId
            ? {
                label: 'Ver paciente existente',
                onClick: () => {
                  onOpenChange(false)
                  router.push(`/pacientes/${existenteId}`)
                },
              }
            : undefined,
          duration: 8000,
        })
      } else if (msg === 'CPF_DUPLICADO_ARQUIVADO') {
        // CPF pertence a um paciente arquivado — oferece restaurar em vez de
        // criar um duplicado (que travaria a restauração depois).
        const arquivadoId = error.pacienteExistenteId
        toast.error('CPF pertence a um paciente arquivado.', {
          description: 'Restaure o paciente em vez de criar um novo cadastro.',
          action: arquivadoId
            ? {
                label: 'Restaurar paciente',
                onClick: async () => {
                  try {
                    await restaurarPaciente.mutateAsync(arquivadoId)
                    toast.success('Paciente restaurado.')
                    onOpenChange(false)
                    router.push(`/pacientes/${arquivadoId}`)
                  } catch {
                    toast.error('Erro ao restaurar paciente.')
                  }
                },
              }
            : undefined,
          duration: 10000,
        })
      } else if (msg === 'VALIDACAO_FALHOU') {
        toast.error('Dados inválidos, revise o formulário.')
      } else {
        toast.error('Erro ao cadastrar. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleEditar(data: PacienteInput) {
    if (!pacienteEditarId) return
    setLoading(true)
    try {
      await atualizarPaciente.mutateAsync({ id: pacienteEditarId, input: data })
      toast.success('Paciente atualizado.')
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? ''
      if (msg === 'CPF_DUPLICADO') {
        toast.error('CPF já cadastrado em outro paciente.')
      } else if (msg === 'VALIDACAO_FALHOU') {
        toast.error('Dados inválidos, revise o formulário.')
      } else {
        toast.error('Erro ao salvar. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  // defaultValues do form em modo edição (mapeia o detalhe para o input).
  const defaultValues = detalhe
    ? {
        nome: detalhe.nome,
        cpf: detalhe.cpf ?? '',
        whatsapp: detalhe.whatsapp ?? '',
        data_nascimento: detalhe.data_nascimento ?? '',
        email: detalhe.email ?? '',
        endereco: detalhe.endereco ?? '',
        sexo_biologico: detalhe.sexo_biologico,
        responsavel_legal: detalhe.responsavel_legal ?? '',
        observacoes: detalhe.observacoes ?? '',
        origem_id: detalhe.origem_id,
      }
    : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-sans text-xl font-semibold text-foreground">
            {isEdit ? 'Editar paciente' : 'Novo paciente'}
          </DialogTitle>
        </DialogHeader>

        {isEdit && carregandoDetalhe ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isEdit ? (
          // key força o form a remontar com os defaultValues quando o detalhe chega.
          <FormPaciente
            key={pacienteEditarId}
            defaultValues={defaultValues}
            onSubmit={handleEditar}
            submitLabel="Salvar"
            loading={loading}
          />
        ) : (
          <FormPaciente
            onSubmit={handleCriar}
            submitLabel="Cadastrar"
            loading={loading}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
