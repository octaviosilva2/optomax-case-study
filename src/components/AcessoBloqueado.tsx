'use client'

import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ShieldAlert, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { CONTATO_EMAIL } from '@/lib/constants'

type Props = {
  nomeClinica: string
  // Fase 8: quando a org tem deletion_requested_at preenchido, mostra mensagem
  // específica de exclusão em vez do bloqueio genérico de suspensão.
  deletionScheduledFor?: string | null
}

// Tela exibida quando organizations.plan_status != 'active'.
// Bloqueia o acesso ao app — o usuário só pode sair.
export function AcessoBloqueado({ nomeClinica, deletionScheduledFor }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    // Limpa o cache do React Query ao sair (ver AvatarMenu) — evita vazamento
    // de dados em cache entre contas no mesmo navegador.
    queryClient.clear()
    router.push('/login')
    router.refresh()
  }

  // Formata data de exclusão prevista no padrão brasileiro
  const dataExclusao = deletionScheduledFor
    ? new Date(deletionScheduledFor).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null

  const isDeletionPending = !!deletionScheduledFor

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-6">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-sm p-8 text-center">
        {isDeletionPending ? (
          <>
            <div className="w-14 h-14 rounded-full bg-status-warning-bg text-status-warning flex items-center justify-center mx-auto mb-4 border border-status-warning/30">
              <Trash2 className="h-6 w-6" />
            </div>
            <h1 className="text-[18px] font-semibold tracking-tight mb-2">
              Conta em processo de exclusão
            </h1>
            <p className="text-[13px] text-muted-foreground mb-1">
              A conta de <strong>{nomeClinica}</strong> está marcada para exclusão.
            </p>
            <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
              Os dados serão eliminados em{' '}
              <strong className="text-foreground">{dataExclusao}</strong>.
            </p>
            <p className="text-[12px] text-muted-foreground mb-6 leading-relaxed">
              Para reverter, entre em contato pelo email{' '}
              <a
                href={`mailto:${CONTATO_EMAIL}`}
                className="font-medium text-foreground underline underline-offset-2 hover:opacity-80"
              >
                {CONTATO_EMAIL}
              </a>{' '}
              antes do prazo.
            </p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-destructive-bg text-destructive flex items-center justify-center mx-auto mb-4 border border-destructive/30">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="text-[18px] font-semibold tracking-tight mb-2">
              Acesso bloqueado
            </h1>
            <p className="text-[13px] text-muted-foreground mb-1">
              O acesso de <strong>{nomeClinica}</strong> foi suspenso.
            </p>
            <p className="text-[13px] text-muted-foreground mb-6">
              Entre em contato com a administração para reativar.
            </p>
          </>
        )}
        <Button variant="outline" onClick={handleLogout} className="w-full">
          Sair
        </Button>
      </div>
    </div>
  )
}
