'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { inicioDoDiaBR, fimDoDiaBR } from '@/lib/utils/data'
import { useOrgId } from './useOrgId'

export type AtendimentoFinalizado = {
  id: string
  patient_id: string
  finalizado_em: string
  patients: { nome: string } | null
  appointments: {
    data_hora: string
  } | null
}

export function useAtendimentosFinalizadosHoje() {
  const supabase = createClient()
  const { data: orgId } = useOrgId()
  // Janela de "hoje" em horário de Brasília — independe do fuso do browser/server.
  const inicioHoje = inicioDoDiaBR().toISOString()
  const fimHoje = fimDoDiaBR().toISOString()

  return useQuery({
    queryKey: ['atendimentos_finalizados_hoje', inicioHoje, orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await supabase
        .from('clinical_records')
        .select('id, patient_id, finalizado_em, patients!inner(nome, deleted_at), appointments(data_hora)')
        .eq('org_id', orgId)
        .eq('status', 'finalizado')
        .is('patients.deleted_at', null)
        .gte('finalizado_em', inicioHoje)
        .lte('finalizado_em', fimHoje)
        .order('finalizado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AtendimentoFinalizado[]
    },
    staleTime: 30 * 1000,
    enabled: !!orgId,
  })
}
