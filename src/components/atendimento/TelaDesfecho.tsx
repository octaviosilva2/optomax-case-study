'use client'

import { Check, ChevronLeft, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardsPosFinalizacao } from './CardsPosFinalizacao'
import type { NovaPrescricao } from '@/types/clinical'

// Tela de desfecho (takeover) exibida ao finalizar a ficha. Cobre a ficha
// inteira: faixa "Ficha finalizada" + os 2 cards (Ficha / Receita).
// "Editar ficha" reabre e volta à ficha; "Voltar à ficha" só esconde o
// desfecho (mostra a ficha em readonly).

type Props = {
  recordId: string
  prescricaoId: string | null
  modelo: 'resumido' | 'completo'
  paciente: { id: string; nome: string; whatsapp: string | null }
  finalizadoEmStr: string | null
  reabrindo: boolean
  onVoltar: () => void
  onEditar: () => void
  // B2 (CA13): dados atuais da receita (ficha.nova_prescricao) - prefill do
  // modo edicao no CardReceita. Repassado sem alteracao ate CardsPosFinalizacao.
  dadosPrescricao: Partial<NovaPrescricao> | null
  // B2 (stale-prefill fix): repassado sem alteracao ate CardsPosFinalizacao.
  onReceitaAtualizada?: (dados: Partial<NovaPrescricao>) => void
}

export function TelaDesfecho({
  recordId,
  prescricaoId,
  modelo,
  paciente,
  finalizadoEmStr,
  reabrindo,
  onVoltar,
  onEditar,
  dadosPrescricao,
  onReceitaAtualizada,
}: Props) {
  return (
    <div className="mx-auto max-w-4xl space-y-5 py-1">
      <button
        type="button"
        onClick={onVoltar}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar à ficha
      </button>

      {/* Faixa de finalização */}
      <div className="flex items-center gap-3 rounded-xl bg-status-ok-bg p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-ok text-white">
          <Check className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-status-ok">Ficha finalizada</p>
          <p className="truncate text-xs text-muted-foreground">
            {paciente.nome}
            {finalizadoEmStr ? ` · ${finalizadoEmStr}` : ''}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={onEditar}
          disabled={reabrindo}
        >
          <Pencil className="h-3.5 w-3.5" />
          {reabrindo ? 'Abrindo...' : 'Editar ficha'}
        </Button>
      </div>

      {/* Cards de Ficha + Receita/Prescrição (lógica de PDF/WhatsApp/Ótica) */}
      <CardsPosFinalizacao
        recordId={recordId}
        prescricaoId={prescricaoId}
        modelo={modelo}
        paciente={paciente}
        finalizado={true}
        reabrindo={reabrindo}
        onReabrir={onEditar}
        dadosPrescricao={dadosPrescricao}
        onReceitaAtualizada={onReceitaAtualizada}
      />
    </div>
  )
}
