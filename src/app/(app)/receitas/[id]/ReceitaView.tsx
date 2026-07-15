'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { CardReceita } from '@/components/atendimento/CardReceita'
import QuickPrescriptionModal from '@/components/receitas/QuickPrescriptionModal'
import type { ReceitaRapidaInput } from '@/lib/validations/receitas'

type Props = {
  prescricaoId: string
  paciente: { id: string; nome: string; whatsapp: string | null }
  // Presente = receita vinculada a uma ficha (mostra tambem "Ver ficha
  // completa"); ausente/null = receita avulsa. As duas mostram "Editar" (B2).
  clinicalRecordId: string | null
  // Dados de grau da prescrição — reabrem o QuickPrescriptionModal em modo edição.
  dadosPrescricao: ReceitaRapidaInput['dados_prescricao'] | null
}

/**
 * View da tela de receita dedicada (/receitas/[id]). Renderiza SÓ o card da
 * receita (CardReceita) — nunca os 2 cards da ficha (isso é exclusivo de
 * /ficha/[id]). Vinculada mostra tambem "Ver ficha completa". Editar (B2,
 * CA13) reabre o formulario de grau no QuickPrescriptionModal para os dois
 * casos — vinculada grava o merge em clinical_data via atualizarReceitaRapida.
 */
export function ReceitaView({
  prescricaoId,
  paciente,
  clinicalRecordId,
  dadosPrescricao,
}: Props) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-1">
      {/* Voltar — para a lista de receitas. */}
      <button
        type="button"
        onClick={() => router.push('/receitas')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar às receitas
      </button>

      {/* Contexto: de quem é a receita. */}
      <p className="text-xs text-muted-foreground">
        Receita de{' '}
        <span className="font-medium text-foreground">{paciente.nome}</span>
      </p>

      <CardReceita
        prescricaoId={prescricaoId}
        paciente={paciente}
        mostrarLinkFicha={!!clinicalRecordId}
        clinicalRecordId={clinicalRecordId}
        mostrarEditar
        onEditar={() => setEditando(true)}
      />

      {/* Edição da receita (avulsa ou vinculada, B2/CA13) — reusa o modal do
          fluxo da lista de receitas (ReceitasView). Vinculada grava o merge em
          clinical_data via atualizarReceitaRapida (o modal não precisa saber).
          Ao fechar, refresh para a tela refletir dados atualizados. */}
      <QuickPrescriptionModal
        open={editando}
        onOpenChange={(open) => {
          setEditando(open)
          if (!open) router.refresh()
        }}
        pacienteFixo={{ id: paciente.id, nome: paciente.nome }}
        prescricaoEdicao={
          dadosPrescricao
            ? { id: prescricaoId, dados_prescricao: dadosPrescricao }
            : undefined
        }
      />
    </div>
  )
}
