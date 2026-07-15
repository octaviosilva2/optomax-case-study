'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { FichaClinica } from '@/types/clinical'
import {
  salvarFichaClinica,
  finalizarAtendimento,
  reabrirParaEdicao,
  trocarModelo,
} from '@/app/(app)/ficha/[id]/actions'
import { fichaClinicaSchema } from '@/lib/validations/clinical'
import type { AutoSaveStatus } from '@/components/clinical/AutoSaveIndicator'
import { useOrgId } from './useOrgId'

type ClinicalRecord = {
  id: string
  org_id: string
  patient_id: string
  appointment_id: string | null
  modelo: 'resumido' | 'completo'
  clinical_data: FichaClinica
  status: 'em_andamento' | 'finalizado'
  finalizado_em: string | null
  editado: boolean
  editado_em: string | null
}

const DEBOUNCE_MS = 2000

// Timeout máximo (ms) para esperar um auto-save em vôo terminar antes de
// finalizar/trocar modelo. Acima disso, prossegue mesmo assim — evita travar
// a UI para sempre se o request anterior ficou pendurado por bug de rede.
const INFLIGHT_WAIT_TIMEOUT_MS = 8000

// Espera `inFlightRef` virar false até o timeout. Retorna true se desbloqueou
// naturalmente, false se foi por timeout (caller decide se prossegue).
async function aguardarInFlight(
  inFlightRef: { current: boolean },
  timeoutMs: number,
): Promise<boolean> {
  const inicio = Date.now()
  while (inFlightRef.current) {
    if (Date.now() - inicio > timeoutMs) return false
    await new Promise((r) => setTimeout(r, 50))
  }
  return true
}

type Options = {
  initialRecord?: ClinicalRecord
  initialFicha?: FichaClinica
}

export function useFichaClinica(recordId: string, options?: Options) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { data: orgId } = useOrgId()

  // Query: hidratada com dados do server component (initialData) para evitar
  // flash de campos vazios. staleTime alto porque o estado fonte-de-verdade
  // enquanto edita é o `ficha` local.
  const query = useQuery({
    queryKey: ['clinical_record', recordId, orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Sem organização')
      const { data, error } = await supabase
        .from('clinical_records')
        .select(
          'id, org_id, patient_id, appointment_id, modelo, clinical_data, status, finalizado_em, editado, editado_em',
        )
        .eq('id', recordId)
        .eq('org_id', orgId)
        .single()
      if (error) throw error
      return data as ClinicalRecord
    },
    initialData: options?.initialRecord,
    staleTime: 30 * 1000,
    enabled: !!orgId,
  })

  // Estado local da ficha — fonte de verdade enquanto edita.
  // Inicializa direto com initialFicha para que os inputs nunca apareçam vazios.
  const [ficha, setFicha] = useState<FichaClinica>(
    options?.initialFicha ?? options?.initialRecord?.clinical_data ?? {},
  )
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>('idle')
  const [ultimaSalvaEm, setUltimaSalvaEm] = useState<Date | null>(null)
  // Erros por campo: mapa de "secao.campo" -> mensagem de erro.
  // Atualizado em tempo real pela validação local (Zod no client) — apenas
  // visual, NÃO bloqueia o auto-save. Server salva drafts mesmo com erros.
  const [errosPorCampo, setErrosPorCampo] = useState<Record<string, string>>({})

  // dirtyRef: só vira true quando o USUÁRIO edita (atualizarSecao).
  // Evita que a hidratação inicial dispare auto-save fantasma.
  const dirtyRef = useRef(false)

  // Lock para evitar requests concorrentes (auto-save em vôo + finalizar simultâneo)
  const inFlightRef = useRef(false)

  // Auto-save com debounce de 2s (só dispara quando dirtyRef === true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fichaRef = useRef(ficha)
  fichaRef.current = ficha

  // Validação local apenas visual — não impede save.
  // Debounce de 500ms evita rodar Zod completo a cada keystroke numa ficha grande
  // (CPU spike perceptível em fichas com muitas seções preenchidas). Os erros
  // visuais aparecem só quando o usuário pausa a digitação.
  useEffect(() => {
    const t = setTimeout(() => {
      const parsed = fichaClinicaSchema.safeParse(ficha)
      if (parsed.success) {
        setErrosPorCampo({})
      } else {
        const mapa: Record<string, string> = {}
        for (const issue of parsed.error.issues) {
          const chave = issue.path.join('.')
          // Mantém a primeira mensagem por chave (ranges geralmente já são curtos).
          if (!mapa[chave]) mapa[chave] = issue.message
        }
        setErrosPorCampo(mapa)
      }
    }, 500)
    return () => clearTimeout(t)
  }, [ficha])

  useEffect(() => {
    if (!dirtyRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)
    setSaveStatus('saving')

    // F5-C01: reagendamento quando outra operação (finalizar/trocar modelo)
    // está em vôo, ao invés de descartar o último delta. Cap de retries evita
    // loop infinito caso `inFlightRef` nunca limpe por bug de rede; após
    // MAX_RETRIES o save prossegue mesmo com o flag travado — equivalente ao
    // timeout de segurança usado em `aguardarInFlight()` nas demais ações.
    let retries = 0
    const MAX_RETRIES = 3

    async function tentarSalvar() {
      if (inFlightRef.current && retries < MAX_RETRIES) {
        retries++
        timerRef.current = setTimeout(tentarSalvar, DEBOUNCE_MS)
        return
      }
      inFlightRef.current = true
      try {
        const res = await salvarFichaClinica(recordId, fichaRef.current)
        if (res.error) {
          setSaveStatus('error')
          toast.error(res.error, { duration: 6000 })
        } else {
          setSaveStatus('saved')
          setUltimaSalvaEm(new Date())
          // Warning soft: o save funcionou mas algum efeito colateral falhou
          // (ex.: regeneração do snapshot de prescription). Avisa uma vez,
          // sem bloquear o fluxo.
          if (res.warning) toast.warning(res.warning, { duration: 6000 })
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
  }, [ficha])

  // Atualiza uma seção específica fazendo merge — único caminho que marca dirty
  function atualizarSecao<K extends keyof FichaClinica>(
    chave: K,
    parcial: Partial<NonNullable<FichaClinica[K]>>,
  ) {
    dirtyRef.current = true
    setFicha((prev) => ({
      ...prev,
      [chave]: { ...(prev[chave] ?? {}), ...parcial },
    }))
  }

  // Substitui completamente uma seção (usado por importações entre seções)
  function substituirSecao<K extends keyof FichaClinica>(
    chave: K,
    valor: NonNullable<FichaClinica[K]>,
  ) {
    dirtyRef.current = true
    setFicha((prev) => ({ ...prev, [chave]: valor }))
  }

  // Finaliza o atendimento — força flush do que está em memória primeiro
  // Dashboard V2 FASE F: aceita retornoEm opcional (ISO string YYYY-MM-DD)
  async function finalizar(retornoEm?: string | null) {
    if (timerRef.current) clearTimeout(timerRef.current)
    // Aguarda eventual auto-save em vôo terminar (evita race) com timeout
    // de segurança para não travar a UI se o save anterior pendurou.
    const desbloqueado = await aguardarInFlight(inFlightRef, INFLIGHT_WAIT_TIMEOUT_MS)
    if (!desbloqueado) {
      console.warn('[useFichaClinica] timeout aguardando auto-save anterior — prosseguindo')
      // Reseta o flag pois o save anterior provavelmente nunca limpou
      inFlightRef.current = false
    }
    inFlightRef.current = true
    setSaveStatus('saving')
    try {
      const salvar = await salvarFichaClinica(recordId, fichaRef.current)
      if (salvar.error) {
        setSaveStatus('error')
        return { error: salvar.error }
      }
      // Warning do flush (snapshot da prescription pode ter falhado em
      // record já finalizado que está sendo refinalizado — caso raro).
      if (salvar.warning) toast.warning(salvar.warning, { duration: 6000 })
      const res = await finalizarAtendimento(recordId, retornoEm)
      if (res.error) {
        setSaveStatus('error')
        return { error: res.error }
      }
      setSaveStatus('saved')
      setUltimaSalvaEm(new Date())
      dirtyRef.current = false
      // Paraleliza as 3 invalidações para reduzir o tempo perceptível da
      // finalização. invalidateQueries não tem dependência entre si — disparar
      // em paralelo é seguro e corta ~2/3 do delay quando a rede é lenta.
      // Promise.all rejeita se qualquer uma falhar, mas as demais já foram
      // disparadas e continuam executando (só perdemos o sinal de erro delas).
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clinical_record', recordId] }),
        // Finalização altera dados que alimentam a evolução do grau (gráfico no
        // perfil do paciente e painel da ficha).
        queryClient.invalidateQueries({ queryKey: ['evolucao_grau'] }),
        // Finalização cria/atualiza linha em prescriptions — invalida a lista
        // de documentos do perfil do paciente para refletir o novo PDF.
        queryClient.invalidateQueries({ queryKey: ['prescricoes'] }),
      ])
      return { error: null }
    } finally {
      inFlightRef.current = false
    }
  }

  // Reabre uma ficha já finalizada para edição.
  async function reabrir() {
    const res = await reabrirParaEdicao(recordId)
    if (res.error) return { error: res.error }
    await queryClient.invalidateQueries({ queryKey: ['clinical_record', recordId] })
    // Reabrir não muda os dados imediatamente, mas edições subsequentes
    // afetarão a evolução. Invalida agora para garantir consistência.
    await queryClient.invalidateQueries({ queryKey: ['evolucao_grau'] })
    await queryClient.invalidateQueries({ queryKey: ['prescricoes'] })
    return { error: null }
  }

  // Troca o modelo (resumido ↔ completo). Antes de trocar, garante flush
  // do estado local para não perder edições não salvas.
  async function trocar(novoModelo: 'resumido' | 'completo') {
    if (timerRef.current) clearTimeout(timerRef.current)
    const desbloqueado = await aguardarInFlight(inFlightRef, INFLIGHT_WAIT_TIMEOUT_MS)
    if (!desbloqueado) {
      console.warn('[useFichaClinica] timeout aguardando auto-save anterior (trocar) — prosseguindo')
      inFlightRef.current = false
    }
    inFlightRef.current = true
    try {
      // Flush do que está em memória
      const flush = await salvarFichaClinica(recordId, fichaRef.current)
      if (flush.error) return { error: flush.error }
      if (flush.warning) toast.warning(flush.warning)
      const res = await trocarModelo(recordId, novoModelo)
      if (res.error) return { error: res.error }
      dirtyRef.current = false
      await queryClient.invalidateQueries({ queryKey: ['clinical_record', recordId] })
      // Troca de modelo preserva nova_prescricao — não muda a evolução.
      // Mas invalidamos por segurança (defesa contra inconsistência futura).
      await queryClient.invalidateQueries({ queryKey: ['evolucao_grau'] })
      await queryClient.invalidateQueries({ queryKey: ['prescricoes'] })
      return { error: null }
    } finally {
      inFlightRef.current = false
    }
  }

  return {
    record: query.data,
    isLoading: query.isLoading,
    error: query.error,
    ficha,
    setFicha,
    atualizarSecao,
    substituirSecao,
    saveStatus,
    ultimaSalvaEm,
    finalizar,
    reabrir,
    trocarModelo: trocar,
    finalizado: query.data?.status === 'finalizado',
    errosPorCampo,
  }
}
