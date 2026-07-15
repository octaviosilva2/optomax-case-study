'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getAppUrl } from '@/lib/app-url'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowLeft, MailCheck } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Email inválido'),
})

type FormData = z.infer<typeof schema>

/* Classes compartilhadas com o login para consistência visual */
const inputCls =
  'h-9 rounded-lg border-border bg-card text-[13px] placeholder:text-muted-foreground focus-visible:ring-ring/50 focus-visible:border-ring'

const labelCls = 'text-[13px] font-medium text-foreground'

// Cooldown de reenvio em segundos — protege contra spam e evita confusão
// do usuário (clicar várias vezes não acelera a entrega do email).
const RESEND_COOLDOWN_SECONDS = 30

export default function RecuperarSenhaPage() {
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailEnviado, setEmailEnviado] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [reenviando, setReenviando] = useState(false)
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Decremento do cooldown — só roda enquanto > 0.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  async function onSubmit(data: FormData) {
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      // URL canônica (sem www) garante consistência do email enviado pelo Supabase.
      // Passa pelo route handler /auth/callback (persiste os cookies da sessão de
      // recovery) e só depois cai em /atualizar-senha. Fazer o exchange direto na
      // página (Server Component) NÃO grava cookies → "Auth session missing".
      redirectTo: `${getAppUrl()}/auth/callback?next=/atualizar-senha`,
    })
    setLoading(false)

    if (error) {
      toast.error('Erro ao enviar email. Tente novamente.')
      return
    }

    setEmailEnviado(data.email)
    setEnviado(true)
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  async function handleReenviar() {
    if (cooldown > 0 || reenviando || !emailEnviado) return
    setReenviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(emailEnviado, {
      redirectTo: `${getAppUrl()}/auth/callback?next=/atualizar-senha`,
    })
    setReenviando(false)

    if (error) {
      toast.error('Erro ao reenviar email. Tente novamente.')
      return
    }

    toast.success('Email reenviado')
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">

        {/* Body — sem wordmark/tagline; user vem do login (contexto já dado) */}
        <div className="px-6 pt-6 pb-6">
          {/* Título da ação */}
          <div className="text-center mb-5">
            <h1 className="text-page-title inline-flex items-center justify-center gap-2">
              {enviado && <MailCheck className="h-5 w-5 text-status-ok" />}
              {enviado ? 'Email enviado' : 'Recuperar senha'}
            </h1>
            <p className="text-meta mt-1.5">
              {enviado
                ? 'Verifique sua caixa de entrada'
                : 'Enviaremos um link para redefinir sua senha'}
            </p>
          </div>
          {enviado ? (
            <div className="space-y-4">
              <p className="text-meta text-center leading-relaxed">
                Enviamos um link de recuperação para o seu email.
                Verifique também a pasta de spam.
              </p>
              <Button
                type="button"
                className="w-full shadow-md"
                onClick={handleReenviar}
                disabled={cooldown > 0 || reenviando}
              >
                {reenviando
                  ? 'Reenviando...'
                  : cooldown > 0
                    ? `Reenviar email em ${cooldown}s`
                    : 'Reenviar email'}
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline underline-offset-2 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar para o login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className={labelCls}>Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className={inputCls}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full shadow-md" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline underline-offset-2 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
