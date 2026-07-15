'use client'

import { useState } from 'react'
import { Trash2, CheckSquare, Square, ArchiveRestore } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'

type Props = {
  /** Quantos itens estão selecionados agora. */
  qtdSelecionada: number
  /** Se todos os visíveis estão selecionados (controla o ícone do checkbox). */
  todosSelecionados: boolean
  onAlternarTodos: () => void
  /** Executa a exclusão dos selecionados (hard delete). */
  onExcluirSelecionados: () => Promise<void>
  /** Restaura os selecionados (volta às listas ativas). */
  onRestaurarSelecionados: () => Promise<void>
  /** Nomes da entidade para as mensagens (ex.: "atendimento" / "atendimentos"). */
  entidadeSingular: string
  entidadePlural: string
}

/**
 * Barra de ações de exclusão/restauração em massa para listagens de "Arquivados".
 *
 * Layout:
 * - Desktop: tudo numa linha — Selecionar todos (esq) · contador · à direita
 *   [Excluir selecionados] [Restaurar selecionados].
 * - Mobile: topo = Selecionar todos; as ações da seleção descem para uma linha abaixo.
 *
 * Compartilhada por Pacientes, Receitas e Atendimentos.
 */
export function BarraSelecaoMassa({
  qtdSelecionada,
  todosSelecionados,
  onAlternarTodos,
  onExcluirSelecionados,
  onRestaurarSelecionados,
  entidadeSingular,
  entidadePlural,
}: Props) {
  const [confirmSelecionados, setConfirmSelecionados] = useState(false)
  const [processando, setProcessando] = useState(false)

  const plural = (n: number) => (n === 1 ? entidadeSingular : entidadePlural)
  const temSelecao = qtdSelecionada > 0

  async function execSelecionados() {
    setProcessando(true)
    try {
      await onExcluirSelecionados()
    } finally {
      setProcessando(false)
      setConfirmSelecionados(false)
    }
  }

  async function execRestaurar() {
    setProcessando(true)
    try {
      await onRestaurarSelecionados()
    } finally {
      setProcessando(false)
    }
  }

  // Ações da seleção (excluir + restaurar) — renderizadas inline no desktop e
  // numa linha abaixo no mobile.
  const acoesSelecao = (
    <>
      <button
        type="button"
        onClick={() => setConfirmSelecionados(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors whitespace-nowrap"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Excluir selecionados
      </button>
      <button
        type="button"
        onClick={execRestaurar}
        disabled={processando}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium border border-border bg-card hover:bg-muted transition-colors whitespace-nowrap disabled:opacity-60"
      >
        <ArchiveRestore className="h-3.5 w-3.5" />
        Restaurar selecionados
      </button>
    </>
  )

  return (
    <div className="mb-3 px-3 py-2.5 rounded-lg bg-muted/60 border border-border">
      {/* Linha do topo: Selecionar todos + contador (esq) · ações (dir).
          As ações da seleção só aparecem aqui no desktop (md+). */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onAlternarTodos}
          className="inline-flex items-center gap-2 shrink-0 whitespace-nowrap text-[13px] font-medium text-foreground hover:text-primary transition-colors"
        >
          {todosSelecionados ? (
            <CheckSquare className="h-4 w-4 text-primary" />
          ) : (
            <Square className="h-4 w-4 text-muted-foreground" />
          )}
          Selecionar todos
        </button>

        {temSelecao && (
          <span className="text-[12px] text-muted-foreground shrink-0 hidden sm:inline">
            {qtdSelecionada} {plural(qtdSelecionada)} selecionado{qtdSelecionada === 1 ? '' : 's'}
          </span>
        )}

        {temSelecao && (
          <div className="ml-auto hidden md:flex items-center gap-2">{acoesSelecao}</div>
        )}
      </div>

      {/* Mobile: ações da seleção numa linha abaixo do "Selecionar todos". */}
      {temSelecao && (
        <div className="flex md:hidden flex-wrap items-center gap-2 mt-2.5">
          {acoesSelecao}
        </div>
      )}

      {/* Confirmação — selecionados */}
      <ConfirmDialog
        open={confirmSelecionados}
        onOpenChange={(o) => !o && setConfirmSelecionados(false)}
        titulo={`Excluir ${qtdSelecionada} ${plural(qtdSelecionada)}?`}
        descricao={`${qtdSelecionada} ${plural(qtdSelecionada)} ${qtdSelecionada === 1 ? 'será apagado' : 'serão apagados'} permanentemente, junto com os dados vinculados. Esta ação não pode ser desfeita.`}
        labelConfirmar="Excluir"
        variante="destrutivo"
        carregando={processando}
        onConfirmar={execSelecionados}
      />
    </div>
  )
}
