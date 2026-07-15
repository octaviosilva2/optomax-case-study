'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { rangeDia, rangeSemana, formatarDataKey } from '@/lib/utils/agenda'
import {
  criarAgendamento as criarAgendamentoAction,
  atualizarAgendamento as atualizarAgendamentoAction,
  atualizarStatusAgendamento,
  excluirAgendamento as excluirAgendamentoAction,
} from '@/app/(app)/agenda/actions'
import type { StatusAgendamento } from '@/lib/utils/status'
import { useOrgId } from './useOrgId'

// ── Tipos ─────────────────────────────────────────────────────────────────────
// REFATORADO: tipo de consulta removido do produto — agendamento usa só duracao.

export type Agendamento = {
  id: string
  org_id: string
  patient_id: string
  data_hora: string
  duracao: number
  status: string
  walkin: boolean
  observacao: string | null
  created_at: string
  patients: { nome: string; whatsapp: string | null } | null
}

// Tipo para criar agendamento SEM tipo_consulta (removido na refatoracao)
export type NovoAgendamento = {
  org_id: string
  patient_id: string
  data_hora: string
  duracao: number
  observacao?: string | null
  walkin?: boolean
}

// ── Queries ───────────────────────────────────────────────────────────────────

// Status oculto por padrão na grade: só "cancelado" (libera o slot). "faltou"
// PERMANECE visível (horário perdido, alimenta a taxa de falta). Ambos seguem
// no histórico do paciente.
const STATUS_OCULTOS = ['cancelado'] as const

export function useAgendaDia(data: Date, incluirCancelados = false, enabled = true) {
  const supabase = createClient()
  const { data: orgId } = useOrgId()
  const { inicio, fim } = rangeDia(data)

  return useQuery({
    queryKey: ['agenda', 'dia', formatarDataKey(data), incluirCancelados, orgId],
    queryFn: async () => {
      if (!orgId) return []
      // Limite defensivo: 200 agendamentos/dia é teto absoluto.
      // Sem .limit() um dia atípico pode arrastar o cliente.
      let query = supabase
        .from('appointments')
        .select(`
          id, org_id, patient_id,
          data_hora, duracao, status, walkin, observacao, created_at,
          patients ( nome, whatsapp )
        `)
        .eq('org_id', orgId)
        .gte('data_hora', inicio)
        .lte('data_hora', fim)
        .order('data_hora', { ascending: true })
        .limit(200)

      if (!incluirCancelados) {
        query = query.not('status', 'in', `(${STATUS_OCULTOS.join(',')})`)
      }

      const { data: rows, error } = await query
      if (error) throw error
      return (rows ?? []) as unknown as Agendamento[]
    },
    staleTime: 30 * 1000,
    enabled: !!orgId && enabled,
  })
}

export function useAgendaSemana(data: Date, incluirCancelados = false, enabled = true) {
  const supabase = createClient()
  const { data: orgId } = useOrgId()
  const { inicio, fim } = rangeSemana(data)

  return useQuery({
    queryKey: ['agenda', 'semana', formatarDataKey(data), incluirCancelados, orgId],
    queryFn: async () => {
      if (!orgId) return []
      // Limite defensivo: 200 agendamentos/semana cobre folgadamente o caso real.
      let query = supabase
        .from('appointments')
        .select(`
          id, org_id, patient_id,
          data_hora, duracao, status, walkin, observacao, created_at,
          patients ( nome, whatsapp )
        `)
        .eq('org_id', orgId)
        .gte('data_hora', inicio)
        .lte('data_hora', fim)
        .order('data_hora', { ascending: true })
        .limit(200)

      if (!incluirCancelados) {
        query = query.not('status', 'in', `(${STATUS_OCULTOS.join(',')})`)
      }

      const { data: rows, error } = await query
      if (error) throw error
      return (rows ?? []) as unknown as Agendamento[]
    },
    staleTime: 30 * 1000,
    enabled: !!orgId && enabled,
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Cria agendamento via server action (validacao Zod + checagem cross-tenant).
 * REFATORADO: nao envia mais tipo_consulta_id, apenas duracao.
 */
export function useCriarAgendamento() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (novo: NovoAgendamento) => {
      const result = await criarAgendamentoAction({
        patient_id: novo.patient_id,
        data_hora: novo.data_hora,
        duracao: novo.duracao,
        observacao: novo.observacao ?? undefined,
        walkin: novo.walkin,
      })
      if (result.error) throw new Error(result.error)
      return { id: result.agendamentoId }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['historico_consultas'] })
    },
  })
}

/**
 * Atualiza status do agendamento via server action (whitelist de status validada).
 */
export function useAtualizarStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: StatusAgendamento
    }) => {
      const result = await atualizarStatusAgendamento(id, status)
      if (result.error) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['historico_consultas'] })
    },
  })
}

/**
 * Edita um agendamento (data/hora, duração, observação) via server action.
 */
export function useAtualizarAgendamento() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      id: string
      data_hora: string
      duracao: number
      observacao?: string | null
    }) => {
      const result = await atualizarAgendamentoAction(input.id, {
        data_hora: input.data_hora,
        duracao: input.duracao,
        observacao: input.observacao,
      })
      if (result.error) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

/**
 * Exclui agendamento via server action.
 * Erro 'AGENDAMENTO_FINALIZADO' indica que há ficha finalizada vinculada
 * — caller deve traduzir para mensagem amigável.
 */
export function useExcluirAgendamento() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const result = await excluirAgendamentoAction(appointmentId)
      if (result.error) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['historico_consultas'] })
      queryClient.invalidateQueries({ queryKey: ['atendimentos_ativos'] })
    },
  })
}
