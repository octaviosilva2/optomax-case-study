'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { useReceitaRascunho } from '@/hooks/useReceitaRascunho'
import { AutoSaveIndicator } from '@/components/clinical/AutoSaveIndicator'
import { DioptriasGrid } from '@/components/clinical/DioptriasGrid'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CampoRefracao, NovaPrescricao } from '@/types/clinical'

type Props = {
  prescricaoId: string
  paciente: { id: string; nome: string }
  // Rascunho novo nasce `{}` (criarRascunhoReceita) — nenhuma chave garantida.
  dadosPrescricao: Partial<NovaPrescricao>
}

// Preenche o mínimo que a DioptriasGrid e os campos abaixo esperam, igual ao
// defaultValues do QuickPrescriptionModal.
function comDefaults(dados: Partial<NovaPrescricao>): NovaPrescricao {
  const od: Partial<CampoRefracao> = dados.od ?? {}
  const oe: Partial<CampoRefracao> = dados.oe ?? {}
  return {
    od: { esf: od.esf ?? '', cil: od.cil ?? '', eixo: od.eixo ?? '', add: od.add ?? '' },
    oe: { esf: oe.esf ?? '', cil: oe.cil ?? '', eixo: oe.eixo ?? '', add: oe.add ?? '' },
    tipo_lente: dados.tipo_lente ?? null,
    tratamentos: dados.tratamentos ?? [],
    observacoes: dados.observacoes ?? '',
    validade_meses: dados.validade_meses ?? null,
  }
}

/**
 * Página de preenchimento do rascunho de receita avulsa (CA20–CA21, CA23).
 * Mesmo padrão de auto-save do `useFichaClinica` (debounce ~2s), via o hook
 * `useReceitaRascunho`. "Finalizar receita" valida o mínimo no servidor
 * (edge case 5) e navega para a tela de resultado (CA22).
 */
export function ReceitaEditorView({ prescricaoId, paciente, dadosPrescricao }: Props) {
  const router = useRouter()
  const [finalizando, setFinalizando] = useState(false)
  const { dados, atualizar, saveStatus, ultimaSalvaEm, finalizar } = useReceitaRascunho(
    prescricaoId,
    comDefaults(dadosPrescricao),
  )

  async function handleFinalizar() {
    if (finalizando) return
    setFinalizando(true)
    const res = await finalizar()
    setFinalizando(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    router.push(`/receitas/${prescricaoId}`)
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

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Receita de <span className="font-medium text-foreground">{paciente.nome}</span>
        </p>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary whitespace-nowrap">
          <Timer className="h-3 w-3" />
          Em andamento
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Refração</h1>
          <AutoSaveIndicator status={saveStatus} ultimaSalvaEm={ultimaSalvaEm} />
        </div>

        <div className="rounded-xl border border-border p-4">
          <DioptriasGrid
            value={{ od: dados.od, oe: dados.oe }}
            onChange={(parcial) => atualizar(parcial)}
            disabled={finalizando}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Observações da receita</Label>
          <Textarea
            value={dados.observacoes ?? ''}
            onChange={(e) => atualizar({ observacoes: e.target.value })}
            placeholder="Qualquer instrução extra para o paciente..."
            className="min-h-24 resize-none"
            disabled={finalizando}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Validade (meses)</Label>
          <Input
            type="number"
            min={1}
            max={60}
            inputMode="numeric"
            placeholder="ex: 12"
            className="w-full sm:w-[160px]"
            value={dados.validade_meses ?? ''}
            disabled={finalizando}
            onChange={(e) => {
              const v = e.target.value.trim()
              const n = Number(v)
              atualizar({ validade_meses: v === '' || Number.isNaN(n) ? null : n })
            }}
          />
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleFinalizar}
            disabled={finalizando}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-[13px] font-medium bg-primary text-white shadow-md hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            Finalizar receita →
          </button>
        </div>
      </div>
    </div>
  )
}
