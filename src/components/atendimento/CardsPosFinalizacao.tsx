'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CardFicha } from './CardFicha'
import { CardReceita } from './CardReceita'
import QuickPrescriptionModal from '@/components/receitas/QuickPrescriptionModal'
import type { ReceitaRapidaInput } from '@/lib/validations/receitas'
import type { NovaPrescricao } from '@/types/clinical'

type Props = {
  recordId: string
  // Quando null, o card de Receita/Prescrição não é renderizado.
  prescricaoId: string | null
  // Modelo da ficha — repassado ao CardFicha para o badge Resumida/Completa.
  modelo: 'resumido' | 'completo'
  paciente: {
    id: string
    nome: string
    whatsapp: string | null
  }
  // Lote 3.7 (2026-05-13): trocado de `readonly` para `finalizado`.
  // O botão "Editar ficha" deve aparecer sempre que a ficha está finalizada
  // (mesmo após edição), não só na primeira reabertura. Reabrir é idempotente
  // no servidor — chamar de novo numa ficha já editada não tem efeito colateral.
  finalizado: boolean
  // Estado do reabrir (vem do AtendimentoView para evitar duplicar lógica).
  reabrindo: boolean
  onReabrir: () => void
  // B2 (CA13): dados atuais da receita (ficha.nova_prescricao) - prefill do
  // modo edicao no CardReceita; a receita renderizada aqui e sempre vinculada
  // a esta ficha (recordId).
  dadosPrescricao?: Partial<NovaPrescricao> | null
  // B2 (stale-prefill fix): notifica o pai (AtendimentoView) com os dados
  // novos apos uma edicao bem-sucedida, para o estado local `ficha` nao ficar
  // desatualizado numa 2a edicao sem reload da pagina.
  onReceitaAtualizada?: (dados: Partial<NovaPrescricao>) => void
}

/**
 * Cards pós-finalização: exibidos acima do rodapé sticky em fichas finalizadas.
 * Compõe os dois cards independentes — CardFicha (PDF da ficha + WhatsApp do
 * paciente) e CardReceita (PDF da prescrição + WhatsApp do paciente + ótica).
 * A lógica de cada card vive no próprio componente; aqui só orquestramos o grid.
 */
export function CardsPosFinalizacao({
  recordId,
  prescricaoId,
  modelo,
  paciente,
  finalizado,
  reabrindo,
  onReabrir,
  dadosPrescricao,
  onReceitaAtualizada,
}: Props) {
  const router = useRouter()
  // B2 (CA13): edicao da receita vinculada — abre o mesmo QuickPrescriptionModal
  // usado na receita avulsa; a action (atualizarReceitaRapida) decide o merge
  // no clinical_data da ficha, o modal nao precisa saber que e vinculada.
  const [editandoReceita, setEditandoReceita] = useState(false)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <CardFicha
        recordId={recordId}
        modelo={modelo}
        paciente={paciente}
        finalizado={finalizado}
        reabrindo={reabrindo}
        onReabrir={onReabrir}
      />
      {/* Card de Receita só quando há prescrição gerada. */}
      {prescricaoId && (
        <>
          <CardReceita
            prescricaoId={prescricaoId}
            paciente={paciente}
            mostrarEditar
            onEditar={() => setEditandoReceita(true)}
          />
          <QuickPrescriptionModal
            open={editandoReceita}
            onOpenChange={(open) => {
              setEditandoReceita(open)
              if (!open) router.refresh()
            }}
            pacienteFixo={{ id: paciente.id, nome: paciente.nome }}
            prescricaoEdicao={{
              id: prescricaoId,
              dados_prescricao: (dadosPrescricao ?? {}) as unknown as ReceitaRapidaInput['dados_prescricao'],
            }}
            onEditado={(dados) =>
              onReceitaAtualizada?.(dados as unknown as Partial<NovaPrescricao>)
            }
          />
        </>
      )}
    </div>
  )
}
