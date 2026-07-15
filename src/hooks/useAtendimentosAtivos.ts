'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from './useOrgId'

export type AtendimentoAtivo = {
  id: string           // clinical_record id
  patient_id: string
  appointment_id: string | null
  created_at: string
  patients: { nome: string } | null
}

export function useAtendimentosAtivos() {
  const supabase = createClient()
  const { data: orgId } = useOrgId()

  return useQuery({
    queryKey: ['atendimentos_ativos', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await supabase
        .from('clinical_records')
        .select('id, patient_id, appointment_id, created_at, patients!inner(nome, deleted_at)')
        .eq('org_id', orgId)
        .eq('status', 'em_andamento')
        // Ficha arquivada (soft-delete) não conta como atendimento ativo.
        .is('deleted_at', null)
        .is('patients.deleted_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AtendimentoAtivo[]
    },
    // Polling moderado: atendimentos ativos mudam pouco. Mutações locais já
    // disparam invalidateQueries — refetchInterval é só fallback p/ outro user
    // da mesma org criar/finalizar. Em SLC 1.0 (1 user por org) poderia até ser desativado.
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    enabled: !!orgId,
  })
}
