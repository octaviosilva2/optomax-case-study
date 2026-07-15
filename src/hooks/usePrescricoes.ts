'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { excluirPrescricao } from '@/app/(app)/receitas/actions'
import type { ReceitaRapidaInput } from '@/lib/validations/receitas'

// Tipo retornado pelo hook — só os campos que a UI precisa.
// Se um dia o tipo "oculos" for ampliado (lentes de contato, etc.), o
// campo permanece flexível porque mantemos como string.
export type ItemPrescricao = {
  id: string
  tipo: string
  prescription_type: string
  // Data do atendimento — finalizado_em do record (preferido) com fallback
  // para created_at da prescription. Garantidamente não-null.
  dataReferencia: string
  // True se a prescription tem dados de OD/OE/etc — usado para evitar
  // exibir uma linha praticamente vazia (defesa contra inconsistências).
  temDados: boolean
  // Reorganização "Novo Atendimento" (CA7): presente = receita nasceu de uma
  // ficha (botão "Ver ficha"); ausente = quick/standalone (botão "Editar").
  clinical_record_id: string | null
  // Dados brutos da prescrição — necessário para reabrir o formulário de
  // grau em modo edição (QuickPrescriptionModal `prescricaoEdicao`, CA7).
  dados_prescricao: ReceitaRapidaInput['dados_prescricao']
}

type RowJoin = {
  id: string
  tipo: string
  prescription_type: string
  created_at: string
  dados_prescricao: unknown
  clinical_record_id: string | null
  clinical_records: { finalizado_em: string | null } | null
}

/**
 * Lista as prescrições emitidas para um paciente, ordenadas da mais recente
 * para a mais antiga.
 *
 * Segurança (camada principal): RLS no Supabase filtra automaticamente por
 * `org_id` do usuário logado. **Pré-requisito**: a tabela `prescriptions`
 * deve ter policy SELECT do tipo:
 *
 *     CREATE POLICY "prescriptions_select_org" ON prescriptions
 *       FOR SELECT USING (
 *         org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
 *       );
 *
 * Verifique no Dashboard Supabase → Database → Policies. Se ausente, criar
 * antes de subir para produção.
 *
 * Defesa em profundidade: se `orgId` for fornecido (recomendado, vindo do SSR
 * via profile validado), aplica também filtro client-side `.eq('org_id')`.
 * Mesmo que a RLS falhe ou seja removida acidentalmente, esse filtro impede
 * vazamento entre tenants.
 *
 * Performance:
 * - ORDER BY na coluna indexada created_at.
 * - staleTime de 60s — prescrições mudam apenas em finalização/edição.
 */
export function usePrescricoes(patientId: string, orgId?: string) {
  const supabase = createClient()

  return useQuery({
    // orgId entra na queryKey para que cache não compartilhe resultados
    // entre orgs em hipóteses de troca de conta sem reload.
    queryKey: ['prescricoes', patientId, orgId ?? null],
    queryFn: async (): Promise<ItemPrescricao[]> => {
      let q = supabase
        .from('prescriptions')
        .select(
          'id, tipo, prescription_type, created_at, dados_prescricao, clinical_record_id, clinical_records:clinical_record_id ( finalizado_em )',
        )
        .eq('patient_id', patientId)
        .is('deleted_at', null)

      if (orgId) q = q.eq('org_id', orgId)

      const { data, error } = await q.order('created_at', { ascending: false })

      if (error) throw error

      // O Supabase pode tipar a relação 1:1 como array — normalizamos aqui.
      return (data ?? []).map((rRaw) => {
        const r = rRaw as unknown as RowJoin & {
          clinical_records: { finalizado_em: string | null }[] | { finalizado_em: string | null } | null
        }
        const cr = Array.isArray(r.clinical_records)
          ? r.clinical_records[0]
          : r.clinical_records

        // Considera "tem dados" se há tipo_lente, OD/OE com valor ou tratamentos.
        const dp = (r.dados_prescricao ?? {}) as {
          tipo_lente?: string | null
          tratamentos?: unknown[]
          od?: Record<string, unknown> | null
          oe?: Record<string, unknown> | null
        }
        const olhoComValor = (o: Record<string, unknown> | null | undefined) =>
          !!o && Object.values(o).some((v) => v !== null && v !== undefined && v !== '')
        const temDados =
          !!dp.tipo_lente ||
          olhoComValor(dp.od) ||
          olhoComValor(dp.oe) ||
          (Array.isArray(dp.tratamentos) && dp.tratamentos.length > 0)

        return {
          id: r.id,
          tipo: r.tipo,
          prescription_type: r.prescription_type,
          dataReferencia: cr?.finalizado_em ?? r.created_at,
          temDados,
          clinical_record_id: r.clinical_record_id,
          dados_prescricao: r.dados_prescricao as ReceitaRapidaInput['dados_prescricao'],
        }
      })
    },
    staleTime: 60 * 1000,
    enabled: !!patientId,
  })
}

/**
 * Mutation de exclusão de prescrição (soft delete via deleted_at).
 *
 * F5-C02: agora delega para a server action `excluirPrescricao`, que valida
 * org + bloqueia exclusão de receita vinculada a ficha finalizada (documento
 * legal). Mutation direta no client perdia essa proteção mesmo com RLS ativa.
 *
 * Invalida queries de prescrições e receitas — atualiza ambas as telas
 * (perfil do paciente e hub de receitas).
 */
export function useDeletarPrescricao() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (prescricaoId: string) => {
      const { error } = await excluirPrescricao({ prescricaoId })
      if (error) throw new Error(error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescricoes'] })
      queryClient.invalidateQueries({ queryKey: ['receitas'] })
    },
  })
}
