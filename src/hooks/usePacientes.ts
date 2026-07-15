'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  criarPaciente,
  atualizarPaciente,
  excluirPaciente,
  restaurarPaciente,
  contarHistoricoPaciente,
} from '@/app/(app)/pacientes/actions'
import type { PacienteInput } from '@/lib/validations/paciente'
import { ultimaConsultaDe } from '@/lib/utils/data'
import { useOrgId } from './useOrgId'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type PacienteSimples = {
  id: string
  nome: string
  cpf: string | null
  whatsapp: string | null
  data_nascimento: string | null
  created_at: string
  // Data (ISO) da consulta finalizada mais recente; null = nunca atendido.
  ultima_consulta: string | null
}

export type PacienteDetalhe = {
  id: string
  org_id: string
  nome: string
  cpf: string | null
  whatsapp: string | null
  data_nascimento: string | null
  email: string | null
  endereco: string | null
  sexo_biologico: 'M' | 'F' | null
  responsavel_legal: string | null
  observacoes: string | null
  origem_id: string | null
  created_at: string
  updated_at: string
}

export type OrigemPaciente = {
  id: string
  nome: string
  ativo: boolean | null
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Busca lista de pacientes com filtro sanitizado por nome, CPF ou WhatsApp.
 * - Remove caracteres que podem quebrar o parser do .or() do PostgREST.
 * - CPF/WhatsApp são salvos apenas com dígitos — extrai só dígitos do termo.
 * - Aceita initialData do SSR para evitar requisição redundante no primeiro render.
 */
export function usePacientes(search: string, initialData?: PacienteSimples[], arquivados = false) {
  const supabase = createClient()
  const { data: orgId } = useOrgId()

  return useQuery({
    queryKey: ['pacientes', 'busca', search, orgId, arquivados],
    queryFn: async () => {
      if (!orgId) return []
      let query = supabase
        .from('patients')
        .select('id, nome, cpf, whatsapp, data_nascimento, created_at, clinical_records(finalizado_em)')
        .eq('org_id', orgId)
        .order('nome', { ascending: true })
        .limit(50)

      // Ativos (deleted_at IS NULL) ou arquivados (deleted_at NOT NULL).
      query = arquivados
        ? query.not('deleted_at', 'is', null)
        : query.is('deleted_at', null)

      const termo = search.trim()
      if (termo) {
        // Remove caracteres que podem quebrar o parser do .or() do PostgREST
        const termoSeguro = termo.replace(/[,()%*"]/g, '')
        // CPF e WhatsApp são salvos apenas com dígitos — limpar o termo para esses campos
        const digitos = termoSeguro.replace(/\D/g, '')

        const filtros: string[] = [`nome.ilike.%${termoSeguro}%`]
        if (digitos.length >= 3) {
          filtros.push(`cpf.ilike.%${digitos}%`)
          filtros.push(`whatsapp.ilike.%${digitos}%`)
        }
        query = query.or(filtros.join(','))
      }

      const { data, error } = await query
      if (error) throw error
      // Achata o embedded clinical_records em ultima_consulta (max finalizado_em).
      return (data ?? []).map((p) => {
        const { clinical_records, ...rest } = p as typeof p & {
          clinical_records: { finalizado_em: string | null }[] | null
        }
        return { ...rest, ultima_consulta: ultimaConsultaDe(clinical_records) }
      }) as PacienteSimples[]
    },
    staleTime: 60 * 1000,
    // initialData só aplica no estado inicial: busca vazia e lista de ativos.
    initialData: search.trim() === '' && !arquivados ? initialData : undefined,
    enabled: !!orgId,
  })
}

/** Busca detalhe de um paciente pelo id */
export function usePaciente(id: string) {
  const supabase = createClient()
  const { data: orgId } = useOrgId()

  return useQuery({
    queryKey: ['paciente', id, orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Sem organização')
      const { data, error } = await supabase
        .from('patients')
        .select('id, org_id, nome, cpf, whatsapp, data_nascimento, email, endereco, sexo_biologico, responsavel_legal, observacoes, origem_id, created_at, updated_at')
        .eq('id', id)
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .single()

      if (error) throw error
      return data as PacienteDetalhe
    },
    staleTime: 30 * 1000,
    enabled: !!id && !!orgId,
  })
}

/** Lista origens de paciente ativas da org */
export function useOrigensPaciente() {
  const supabase = createClient()
  const { data: orgId } = useOrgId()

  return useQuery({
    queryKey: ['origens_paciente', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await supabase
        .from('origens_paciente')
        .select('id, nome, ativo')
        .eq('org_id', orgId)
        .eq('ativo', true)
        .order('nome', { ascending: true })

      if (error) throw error
      return (data ?? []) as OrigemPaciente[]
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!orgId,
  })
}

/** Lista agendamentos e atendimentos de um paciente */
// NOTA: tipos_consulta pode ser null (tipo de consulta removido do produto)
export function useHistoricoConsultas(pacienteId: string) {
  const supabase = createClient()
  const { data: orgId } = useOrgId()

  return useQuery({
    queryKey: ['historico_consultas', pacienteId, orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, data_hora, status, duracao, walkin, titulo,
          patients!inner ( deleted_at ),
          clinical_records ( id )
        `)
        .eq('patient_id', pacienteId)
        .eq('org_id', orgId)
        .is('patients.deleted_at', null)
        .order('data_hora', { ascending: false })

      if (error) throw error
      return data ?? []
    },
    staleTime: 30 * 1000,
    enabled: !!pacienteId && !!orgId,
  })
}

// Uma ficha clínica (clinical_record) para listagem no perfil — NÃO é agendamento.
export type FichaResumo = {
  id: string
  status: 'em_andamento' | 'finalizado'
  modelo: 'resumido' | 'completo'
  // Data de referência: finalizado_em (se finalizada) ou created_at (em aberto).
  data: string
  // Prescrição vinculada (se houver) — habilita o botão "Baixar".
  prescricaoId: string | null
  // Título/nome da ficha (vindo do appointment vinculado, quando houver)
  titulo: string | null
}

/**
 * Lista as fichas clínicas (clinical_records) de um paciente — a aba do perfil
 * mostra fichas, não agendamentos. Inclui a prescrição vinculada (se houver)
 * para permitir o download direto do PDF.
 */
export function useFichasPaciente(pacienteId: string) {
  const supabase = createClient()
  const { data: orgId } = useOrgId()

  return useQuery({
    queryKey: ['fichas_paciente', pacienteId, orgId],
    queryFn: async (): Promise<FichaResumo[]> => {
      if (!orgId) return []
      const { data, error } = await supabase
        .from('clinical_records')
        .select(`
          id, status, modelo, finalizado_em, created_at,
          prescriptions ( id, deleted_at ),
          appointments ( titulo )
        `)
        .eq('patient_id', pacienteId)
        .eq('org_id', orgId)
        // Não lista fichas arquivadas no histórico do paciente.
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []).map((r) => {
        const prescs =
          (r.prescriptions as { id: string; deleted_at: string | null }[] | null) ?? []
        const presc = prescs.find((p) => !p.deleted_at) ?? null
        // Supabase retorna relação 1:1 como objeto (não array)
        const appt = r.appointments as { titulo: string | null } | null
        return {
          id: r.id,
          status: r.status as 'em_andamento' | 'finalizado',
          modelo: r.modelo as 'resumido' | 'completo',
          data: r.finalizado_em ?? r.created_at,
          prescricaoId: presc?.id ?? null,
          titulo: appt?.titulo ?? null,
        }
      })
    },
    staleTime: 30 * 1000,
    enabled: !!pacienteId && !!orgId,
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Cria um novo paciente via server action */
export function useCriarPaciente() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: PacienteInput) => {
      const result = await criarPaciente(input)
      if (result.error) {
        // Propaga erro com metadados para tratamento no componente
        throw Object.assign(new Error(result.error), {
          pacienteExistenteId: result.pacienteExistenteId,
        })
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] })
    },
  })
}

/** Atualiza dados de um paciente via server action */
export function useAtualizarPaciente() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PacienteInput }) => {
      const result = await atualizarPaciente(id, input)
      if (result.error) throw new Error(result.error)
      return result
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] })
      queryClient.invalidateQueries({ queryKey: ['paciente', variables.id] })
    },
  })
}

/** Soft delete de um paciente via server action */
export function useExcluirPaciente() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await excluirPaciente(id)
      if (result.error) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      // Invalida lista de pacientes + qualquer listagem que possa exibir o paciente excluído
      queryClient.invalidateQueries({ queryKey: ['pacientes'] })
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] })
      queryClient.invalidateQueries({ queryKey: ['receitas'] })
    },
  })
}

/** Restaura um paciente arquivado (deleted_at → null) via server action */
export function useRestaurarPaciente() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await restaurarPaciente(id)
      if (result.error) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] })
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] })
      queryClient.invalidateQueries({ queryKey: ['receitas'] })
    },
  })
}

/**
 * Busca contagens de atendimentos e receitas vinculadas a um paciente.
 * Usado on-demand antes de abrir o modal de confirmação de exclusão.
 */
export function useContarHistoricoPaciente() {
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await contarHistoricoPaciente(id)
      if (result.error) throw new Error(result.error)
      return {
        atendimentos: result.atendimentos ?? 0,
        receitas: result.receitas ?? 0,
      }
    },
  })
}
