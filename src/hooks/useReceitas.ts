import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ReceitaRapidaInput } from '@/lib/validations/receitas'
import { toast } from 'sonner'
import { arquivarReceita } from '@/app/(app)/receitas/actions'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from './useOrgId'

/**
 * Lista as receitas ARQUIVADAS (deleted_at NOT NULL) da org — usada na visão
 * "Arquivadas" da aba Receitas (restaurar / excluir definitivo).
 * Mesmo formato de ReceitaListaItem para reaproveitar a UI da listagem.
 */
export function useReceitasArquivadas(enabled: boolean) {
  const supabase = createClient()
  const { data: orgId } = useOrgId()

  return useQuery({
    queryKey: ['receitas_arquivadas', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await supabase
        .from('prescriptions')
        .select(
          'id, tipo, prescription_type, created_at, patient_id, dados_prescricao, clinical_record_id, status, patients ( id, nome, whatsapp )',
        )
        .eq('org_id', orgId)
        .not('deleted_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000)
      if (error) throw error
      return data ?? []
    },
    staleTime: 60 * 1000,
    enabled: enabled && !!orgId,
  })
}

export function useReceitas() {
  const queryClient = useQueryClient()
  const { data: orgId } = useOrgId()

  const { data: receitas, isLoading, isError } = useQuery({
    // org_id na chave isola o cache por clínica — sem isso, trocar de conta no
    // mesmo navegador serviria as receitas da org anterior do cache.
    queryKey: ['receitas', orgId],
    queryFn: async () => {
      const res = await fetch('/api/prescriptions')
      if (!res.ok) {
        throw new Error('Falha ao carregar receitas')
      }
      return res.json()
    },
    staleTime: 60 * 1000,
    enabled: !!orgId,
  })

  const { mutateAsync: criarReceitaRapida, isPending: isCreating } = useMutation({
    mutationFn: async (dados: ReceitaRapidaInput) => {
      const res = await fetch('/api/prescriptions/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Falha ao criar receita rápida')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receitas'] })
      toast.success('Receita criada com sucesso!')
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar receita', {
        description: error.message,
      })
    },
  })

  // F5-C02 / B2 (CA16): delega para a server action `arquivarReceita`, que
  // decide vinculada (cascata via arquivarAtendimento) vs avulsa (soft delete
  // só da receita, excluirPrescricao) — ver receitas/actions.ts.
  const { mutateAsync: arquivarReceitaMut } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await arquivarReceita(id)
      if (error) throw new Error(error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receitas'] })
    },
    onError: (error: Error) => {
      toast.error('Erro ao arquivar receita', {
        description: error.message,
      })
    },
  })

  return {
    receitas,
    isLoading,
    isError,
    criarReceitaRapida,
    isCreating,
    arquivarReceita: arquivarReceitaMut,
  }
}
