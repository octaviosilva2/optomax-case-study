'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Retorna o org_id do usuário autenticado.
 * Cache longo (5min) — org_id de um user não muda durante a sessão.
 * Usado pelos hooks de leitura para defesa em profundidade
 * (filtro explícito por tenant além da RLS no banco).
 */
export function useOrgId() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['org_id'],
    queryFn: async (): Promise<string | null> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (error || !data) return null
      return data.org_id
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
