'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, MailCheck } from 'lucide-react'
import { getAppUrl } from '@/lib/app-url'

type Props = {
  email: string | undefined
}

// Botão de reenvio do email de confirmação com cooldown visual de 60s.
// Cobre o cooldown interno do supabase-js (~60s) que antes silenciava o erro,
// e dá feedback claro de loading/sucesso/erro via toasts.
export function ResendButton({ email }: Props) {
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const supabase = createClient()

  // Countdown 1s → 0s — reseta o disabled quando chega a zero.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function handleResend() {
    if (!email) {
      toast.error('Email não disponível. Recarregue a página e tente novamente.')
      return
    }
    if (cooldown > 0 || loading) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${getAppUrl()}/auth/callback` },
      })

      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('rate') || msg.includes('limit') || msg.includes('security')) {
          toast.error('Aguarde alguns segundos antes de tentar de novo.')
        } else {
          toast.error('Não foi possível reenviar: ' + error.message)
        }
      } else {
        toast.success('Email reenviado! Confira sua caixa de entrada.')
      }
    } catch {
      toast.error('Erro ao reenviar email. Tente novamente em alguns segundos.')
    } finally {
      setLoading(false)
      // Bloqueia 60s mesmo em erro — evita repetição de chamada e dá tempo
      // do cooldown interno do supabase-js limpar.
      setCooldown(60)
    }
  }

  const disabled = !email || cooldown > 0 || loading
  const label = loading
    ? 'Reenviando...'
    : cooldown > 0
    ? `Aguarde ${cooldown}s para reenviar`
    : 'Reenviar email'

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleResend}
      disabled={disabled}
      className="w-full"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : cooldown > 0 ? null : (
        <MailCheck className="h-4 w-4" />
      )}
      {label}
    </Button>
  )
}
