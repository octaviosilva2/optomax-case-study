'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { FichaClinica } from '@/types/clinical'
import {
  calcularDelta,
  transformarRecordsEmPontos,
  transformarPrescricoesEmPontos,
  type RecordEvolucao,
  type PrescricaoEvolucao,
} from '@/lib/utils/evolucao'
import { useOrgId } from './useOrgId'

/**
 * Busca os atendimentos finalizados de um paciente e devolve já transformado
 * em pontos do gráfico + delta.
 *
 * Segurança (defesa em profundidade):
 * - RLS no Supabase filtra automaticamente por `org_id` do usuário logado
 *   (policies criadas na Fase 4). Cliente normal — sem service role.
 * - Filtro explícito por `org_id` via useOrgId — defesa adicional ao RLS.
 * - `patientId` vem da URL/perfil; mesmo que o usuário tente pegar pacientes
 *   de outra org, RLS + filtro client bloqueiam (retorna lista vazia).
 *
 * Performance:
 * - ORDER BY no servidor evita reordenar no client.
 * - useMemo cacheia transformação enquanto `records` não muda.
 * - staleTime de 60s — dados de evolução mudam pouco durante o uso.
 */
export function useEvolucaoGrau(patientId: string) {
  const supabase = createClient()
  const { data: orgId } = useOrgId()

  const query = useQuery({
    queryKey: ['evolucao_grau', patientId, orgId],
    queryFn: async (): Promise<{ records: RecordEvolucao[]; avulsas: PrescricaoEvolucao[] }> => {
      if (!orgId) return { records: [], avulsas: [] }

      // Atendimentos finalizados (fonte principal) + prescrições avulsas
      // (sem clinical_record vinculado, ex.: receita rápida) em paralelo.
      const [recordsRes, avulsasRes] = await Promise.all([
        supabase
          .from('clinical_records')
          .select('id, finalizado_em, modelo, clinical_data, patients!inner(deleted_at)')
          .eq('patient_id', patientId)
          .eq('org_id', orgId)
          .eq('status', 'finalizado')
          // Ficha arquivada não entra no gráfico de evolução do grau.
          .is('deleted_at', null)
          .is('patients.deleted_at', null)
          .order('finalizado_em', { ascending: true }),
        supabase
          .from('prescriptions')
          .select('id, created_at, dados_prescricao')
          .eq('patient_id', patientId)
          .eq('org_id', orgId)
          .is('deleted_at', null)
          .is('clinical_record_id', null)
          .order('created_at', { ascending: true }),
      ])

      if (recordsRes.error) throw recordsRes.error
      if (avulsasRes.error) throw avulsasRes.error

      // O Supabase tipa clinical_data/dados_prescricao como Json — cast centralizado.
      const records: RecordEvolucao[] = (recordsRes.data ?? []).map((r) => ({
        id: r.id,
        finalizado_em: r.finalizado_em,
        modelo: r.modelo as 'resumido' | 'completo',
        clinical_data: (r.clinical_data ?? null) as FichaClinica | null,
      }))
      const avulsas: PrescricaoEvolucao[] = (avulsasRes.data ?? []).map((p) => ({
        id: p.id,
        created_at: p.created_at,
        dados_prescricao: (p.dados_prescricao ?? null) as { od?: unknown; oe?: unknown } | null,
      }))
      return { records, avulsas }
    },
    staleTime: 60 * 1000,
    enabled: !!patientId && !!orgId,
  })

  // Mescla atendimentos + prescrições avulsas num único eixo temporal (ASC).
  const pontos = useMemo(() => {
    const dosRecords = transformarRecordsEmPontos(query.data?.records ?? [])
    const dasAvulsas = transformarPrescricoesEmPontos(query.data?.avulsas ?? [])
    return [...dosRecords, ...dasAvulsas].sort((a, b) =>
      a.finalizadoEm.localeCompare(b.finalizadoEm),
    )
  }, [query.data])

  const delta = useMemo(() => calcularDelta(pontos), [pontos])

  return {
    pontos,
    delta,
    isLoading: query.isLoading,
    error: query.error,
    isError: query.isError,
  }
}
