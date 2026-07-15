import { createClient } from '@/lib/supabase/server'
import UpdatePasswordForm from './UpdatePasswordForm'
import TelaErroAtualizarSenha from './TelaErroAtualizarSenha'

// Página de redefinição de senha. A troca do `?code=pkce_...` por sessão acontece
// ANTES, no route handler /auth/callback (que persiste os cookies da sessão de
// recovery). Aqui a sessão já deve estar ativa — só validamos e renderizamos o
// form. Sem sessão (acesso direto / link já consumido) → tela de erro.
export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <TelaErroAtualizarSenha mensagem="Link inválido ou expirado. Solicite uma nova redefinição." />
  }

  return <UpdatePasswordForm email={user.email!} />
}
