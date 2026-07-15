'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { salvarRascunhoReceita, finalizarReceita } from '@/app/(app)/receitas/actions'
import type { NovaPrescricao } from '@/types/clinical'
import type { AutoSaveStatus } from '@/components/clinical/AutoSaveIndicator'

const DEBOUNCE_MS = 2000

/**
 * Auto-save do rascunho de receita avulsa (B3, CA20). Espelha `useFichaClinica`:
 * estado local é a fonte de verdade enquanto edita; `dirtyRef` só vira true
 * quando o USUÁRIO edita (evita auto-save fantasma na hidratação inicial).
 */
export function useReceitaRascunho(prescricaoId: string, initialDados: NovaPrescricao) {
  const [dados, setDados] = useState<NovaPrescricao>(initialDados)
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>('idle')
  const [ultimaSalvaEm, setUltimaSalvaEm] = useState<Date | null>(null)

  const dirtyRef = useRef(false)
  const inFlightRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dadosRef = useRef(dados)
  dadosRef.current = dados

  // Único caminho que marca dirty — mesma convenção de `useFichaClinica.atualizarSecao`.
  function atualizar(parcial: Partial<NovaPrescricao>) {
    dirtyRef.current = true
    setDados((prev) => ({ ...prev, ...parcial }))
  }

  // Auto-save com debounce de 2s (só dispara quando dirtyRef === true).
  useEffect(() => {
    if (!dirtyRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)
    setSaveStatus('saving')

    async function tentarSalvar() {
      inFlightRef.current = true
      try {
        const res = await salvarRascunhoReceita(prescricaoId, dadosRef.current)
        if (res.error) {
          setSaveStatus('error')
          toast.error(res.error, { duration: 6000 })
        } else {
          setSaveStatus('saved')
          setUltimaSalvaEm(new Date())
        }
      } finally {
        inFlightRef.current = false
      }
    }

    timerRef.current = setTimeout(tentarSalvar, DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados])

  // Finaliza — força flush do que está em memória primeiro (evita perder o
  // último delta se o usuário clicar "Finalizar" antes do debounce disparar).
  async function finalizar(): Promise<{ error: string | null }> {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSaveStatus('saving')
    try {
      const flush = await salvarRascunhoReceita(prescricaoId, dadosRef.current)
      if (flush.error) {
        setSaveStatus('error')
        return { error: flush.error }
      }
      const res = await finalizarReceita(prescricaoId)
      if (res.error) {
        setSaveStatus('error')
        return { error: res.error }
      }
      setSaveStatus('saved')
      setUltimaSalvaEm(new Date())
      dirtyRef.current = false
      return { error: null }
    } finally {
      inFlightRef.current = false
    }
  }

  return { dados, atualizar, saveStatus, ultimaSalvaEm, finalizar }
}
