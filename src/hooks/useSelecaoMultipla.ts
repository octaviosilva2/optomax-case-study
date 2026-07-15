'use client'

import { useState, useCallback, useEffect } from 'react'

/**
 * Seleção múltipla por id para listagens (usada nos "Arquivados" para exclusão
 * em massa). Mantém um Set de ids selecionados e helpers de toggle / selecionar
 * todos / limpar.
 *
 * `idsVisiveis` é a lista atual de ids na tela — usada para "selecionar todos" e
 * para podar da seleção ids que sumiram (ex.: após excluir ou trocar de aba).
 */
export function useSelecaoMultipla(idsVisiveis: string[]) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  // Remove da seleção qualquer id que não esteja mais visível (evita "fantasmas"
  // selecionados após exclusão/filtro). Só atualiza quando há diferença.
  useEffect(() => {
    setSelecionados((prev) => {
      if (prev.size === 0) return prev
      const visiveis = new Set(idsVisiveis)
      let mudou = false
      const next = new Set<string>()
      for (const id of prev) {
        if (visiveis.has(id)) next.add(id)
        else mudou = true
      }
      return mudou ? next : prev
    })
  }, [idsVisiveis])

  const toggle = useCallback((id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const limpar = useCallback(() => setSelecionados(new Set()), [])

  const alternarTodos = useCallback(() => {
    setSelecionados((prev) => {
      const todos = idsVisiveis.length > 0 && idsVisiveis.every((id) => prev.has(id))
      return todos ? new Set() : new Set(idsVisiveis)
    })
  }, [idsVisiveis])

  const todosSelecionados =
    idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.has(id))

  return {
    selecionados,
    qtd: selecionados.size,
    estaSelecionado: (id: string) => selecionados.has(id),
    toggle,
    limpar,
    alternarTodos,
    todosSelecionados,
  }
}
