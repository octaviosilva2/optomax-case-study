'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from './useOrgId'

// Item da Central de Atendimento — uma FICHA clínica (clinical_record).
// A Central gira em torno das fichas geradas (em andamento → finalizada → receita),
// NÃO em torno dos agendamentos (esses vivem na Agenda).
// `data_evento` é o timestamp para ordenação/filtros de período:
// - finalizado_em quando a ficha está fechada
// - created_at enquanto está em andamento
export type AtendimentoItem = {
  id: string
  patient_id: string
  appointment_id: string | null
  status: 'em_andamento' | 'finalizado'
  modelo: string
  created_at: string
  finalizado_em: string | null
  data_evento: string
  // Título do atendimento (vindo do appointment, quando houver).
  titulo: string | null
  patients: { nome: string; whatsapp: string | null } | null
  // Receita gerada a partir da ficha (acessível direto na linha). null se não houver.
  prescription_id: string | null
}

type Row = {
  id: string
  patient_id: string
  appointment_id: string | null
  status: 'em_andamento' | 'finalizado'
  modelo: string
  created_at: string
  finalizado_em: string | null
  patients: { nome: string; whatsapp: string | null } | null
  appointments: { data_hora: string | null; titulo: string | null } | null
  prescriptions: { id: string; deleted_at: string | null }[] | null
}

/**
 * Lista as fichas de atendimento (clinical_records) da org — em andamento e
 * finalizadas — com a prescrição vinculada (para acesso direto à receita).
 *
 * Defesa em profundidade: filtro explícito por org_id além da RLS, e
 * `patients!inner` + deleted_at IS NULL para esconder pacientes arquivados.
 * O filtro de período é aplicado no componente (sobre data_evento).
 */
export function useAtendimentos(verArquivados = false) {
  const supabase = createClient()
  const { data: orgId } = useOrgId()

  return useQuery({
    queryKey: ['atendimentos_lista', orgId, verArquivados],
    queryFn: async () => {
      if (!orgId) return []
      // Limite defensivo: 100 últimas fichas cobre o SLC (10 testers) folgado.
      let query = supabase
        .from('clinical_records')
        .select(`
          id,
          patient_id,
          appointment_id,
          status,
          modelo,
          created_at,
          finalizado_em,
          patients!inner ( nome, whatsapp, deleted_at ),
          appointments ( data_hora, titulo ),
          prescriptions ( id, deleted_at )
        `)
        .eq('org_id', orgId)
        .is('patients.deleted_at', null)
        .in('status', ['em_andamento', 'finalizado'])

      // Arquivamento (soft delete) da ficha: ativos = deleted_at NULL;
      // arquivados = deleted_at preenchido (toggle "Arquivados" na Central).
      query = verArquivados
        ? query.not('deleted_at', 'is', null)
        : query.is('deleted_at', null)

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const rows = (data ?? []) as unknown as Row[]
      return rows.map((r) => ({
        id: r.id,
        patient_id: r.patient_id,
        appointment_id: r.appointment_id,
        status: r.status,
        modelo: r.modelo,
        created_at: r.created_at,
        finalizado_em: r.finalizado_em,
        data_evento: r.finalizado_em ?? r.created_at,
        titulo: r.appointments?.titulo ?? null,
        patients: r.patients,
        // Ignora prescrições soft-deletadas (link quebrado).
        prescription_id: r.prescriptions?.find((p) => !p.deleted_at)?.id ?? null,
      })) as AtendimentoItem[]
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // fichas em andamento mudam de estado ao vivo
    enabled: !!orgId,
  })
}
