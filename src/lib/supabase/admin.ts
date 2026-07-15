import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// ⚠️ ATENÇÃO: Este cliente usa SERVICE_ROLE_KEY — bypassa o RLS
// Importar APENAS em src/app/api/* — NUNCA em componentes ou pages
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
