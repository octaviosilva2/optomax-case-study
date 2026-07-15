'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock, Sparkles, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExclusaoContaDialog } from '@/components/configuracoes/ExclusaoContaDialog'
import { createClient } from '@/lib/supabase/client'
import { getAppUrl } from '@/lib/app-url'
import { cn } from '@/lib/utils'
import { planoEhIlimitado } from '@/lib/utils/status'
import { toast } from 'sonner'

type Props = {
  open: boolean
  onClose: () => void
}

export function ModalConta({ open, onClose }: Props) {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [exclusaoOpen, setExclusaoOpen] = useState(false)
  // Estado do envio do email de redefinição (loading + confirmação no botão).
  const [enviandoSenha, setEnviandoSenha] = useState(false)
  const [senhaEnviada, setSenhaEnviada] = useState(false)

  // Envia o email de redefinição. CRÍTICO: passar redirectTo para /atualizar-senha
  // — sem ele o Supabase usa o Site URL (raiz) e o link cai no dashboard.
  async function handleAlterarSenha() {
    if (!userEmail || enviandoSenha) return
    setEnviandoSenha(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${getAppUrl()}/atualizar-senha`,
    })
    setEnviandoSenha(false)
    if (error) {
      toast.error('Erro ao enviar email. Tente novamente.')
      return
    }
    setSenhaEnviada(true)
    toast.success('E-mail de redefinição enviado!')
  }

  // Carrega email + fim do trial ao abrir (lazy, uma só vez por sessão)
  useEffect(() => {
    if (!open || userEmail) return

    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      setUserEmail(user.email ?? null)

      // Busca o fim do período de teste da org (para mostrar dias restantes).
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single()
      if (profile?.org_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('trial_ends_at, plan')
          .eq('id', profile.org_id)
          .single()
        setTrialEndsAt(org?.trial_ends_at ?? null)
        setPlan(org?.plan ?? null)
      }
    }
    load()
  }, [open, userEmail])

  // Dias restantes do período de teste (7 dias a partir do cadastro). Null quando
  // não há trial_ends_at carregado ainda.
  const diasRestantes =
    trialEndsAt != null
      ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="sm:max-w-[440px] w-full p-0 overflow-hidden max-h-[90dvh]"
          showCloseButton={false}
        >
          {/* Header */}
          <DialogHeader className="flex-row items-center justify-between px-5 py-4 border-b border-border">
            <DialogTitle className="font-sans font-semibold text-[15px]">Conta e plano</DialogTitle>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[calc(90dvh-65px)] sm:max-h-[calc(75vh-65px)] p-5 space-y-5">
            {/* Card do plano */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              {planoEhIlimitado(plan) ? (
                // Plano admin = acesso ilimitado, sem contagem de teste.
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">Plano completo</span>
                    <span className="inline-flex items-center rounded-full bg-status-ok-bg px-2 py-0.5 text-[10px] font-semibold text-status-ok">
                      Ilimitado
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 shrink-0" />
                    Acesso liberado sem prazo de expiração.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">Plano gratuito</span>
                    <span className="inline-flex items-center rounded-full bg-status-ok-bg px-2 py-0.5 text-[10px] font-semibold text-status-ok">
                      Teste
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 shrink-0" />
                    Assine o OptoMax para liberar o acesso completo, sem prazo.
                  </p>
                  {/* Dias restantes do período de teste (7 dias). Quando expira, o
                      texto muda — o banner/modal global reforça fora do modal. */}
                  {diasRestantes != null && (
                    diasRestantes > 0 ? (
                      <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Clock className="size-3.5 shrink-0 text-primary" />
                        {diasRestantes === 1
                          ? 'Falta 1 dia do seu período de teste gratuito.'
                          : `Faltam ${diasRestantes} dias do seu período de teste gratuito.`}
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
                        <Clock className="size-3.5 shrink-0" />
                        Seu período de teste gratuito expirou. Assine para continuar.
                      </p>
                    )
                  )}
                  {/* CTA de assinatura — leva ao checkout Pix (/assinar). */}
                  <Link
                    href="/assinar"
                    onClick={onClose}
                    className={cn(buttonVariants({ size: 'sm' }), 'w-full')}
                  >
                    Assinar agora
                  </Link>
                </>
              )}
            </div>

            {/* Acesso */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <p className="text-sm font-semibold">Acesso</p>
              <div className="space-y-1.5">
                <Label>E-mail de acesso</Label>
                <Input value={userEmail ?? ''} disabled className="text-muted-foreground" />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAlterarSenha}
                disabled={enviandoSenha || !userEmail}
              >
                {enviandoSenha
                  ? 'Enviando...'
                  : senhaEnviada
                    ? 'E-mail enviado — verifique sua caixa'
                    : 'Alterar senha'}
              </Button>
              {senhaEnviada && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enviamos um link de redefinição para o seu e-mail. Verifique
                  também a pasta de spam.
                </p>
              )}
            </div>

            {/* Zona de perigo */}
            <div className="rounded-xl border border-destructive/30 p-4 space-y-3">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                <AlertTriangle className="size-4" />
                Zona de perigo
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A exclusão da conta é irreversível após 30 dias de carência. Todos os dados
                clínicos, pacientes e configurações serão removidos.{' '}
                <strong className="text-foreground">(Direito de eliminação — LGPD.)</strong>
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setExclusaoOpen(true)}
              >
                Excluir minha conta e dados
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação existente — reutilizado */}
      <ExclusaoContaDialog open={exclusaoOpen} onOpenChange={setExclusaoOpen} />
    </>
  )
}
