'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Label } from '@/components/ui/label'
import { Wordmark } from '@/components/brand/Wordmark'
import { toast } from 'sonner'
import { Check, Circle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Critérios de senha forte alinhados com a política do Supabase ativa (8 chars
// + maiúscula + minúscula + número). Leaked password protection é validada
// no servidor do Supabase — aqui só os critérios estruturais.
const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Precisa de 1 letra maiúscula')
      .regex(/[a-z]/, 'Precisa de 1 letra minúscula')
      .regex(/\d/, 'Precisa de 1 número'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

const inputCls =
  'h-9 rounded-lg border-border bg-card text-[13px] placeholder:text-muted-foreground focus-visible:ring-ring/50 focus-visible:border-ring'

const labelCls = 'text-[13px] font-medium text-foreground'

export default function UpdatePasswordForm({ email }: { email: string }) {
  const [loading, setLoading] = useState(false)
  const [pwdFocused, setPwdFocused] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const pwd = watch('password') ?? ''
  const criterios = {
    len: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    digit: /\d/.test(pwd),
  }
  const mostrarCriterios = pwdFocused || pwd.length > 0

  async function onSubmit(data: FormData) {
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: data.password })
    setLoading(false)

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('weak') || msg.includes('pwned') || msg.includes('leak')) {
        toast.error('Senha não atende aos requisitos de segurança. Veja as dicas abaixo do campo.')
      } else {
        toast.error('Erro ao atualizar senha: ' + error.message)
      }
      return
    }

    toast.success('Senha atualizada com sucesso!')
    // Sucesso: redireciona para `/` — middleware/layout (app) leva para dashboard
    // ou onboarding conforme o estado do profile.
    router.push('/')
    router.refresh()
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Header — Wordmark display + tagline editorial (idêntico ao login) */}
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="flex flex-col items-center justify-center gap-3 mb-3">
            <Wordmark size="display" />
          </div>
          <p className="text-sm text-muted-foreground">
            Sistema de Gestão para Optometristas
          </p>
        </div>

        <div className="px-8 pb-8">
          {/* Título da ação — Inter (uma serifa só por tela: a wordmark) */}
          <div className="text-center mb-5">
            <h1 className="text-section-title">
              Atualizar senha
            </h1>
            <p className="text-meta mt-1.5">
              Defina uma nova senha para{' '}
              <strong className="text-foreground font-medium break-all">{email}</strong>
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className={labelCls}>Nova senha</Label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                placeholder="••••••••"
                className={inputCls}
                {...register('password', {
                  onBlur: () => setPwdFocused(false),
                })}
                onFocus={() => setPwdFocused(true)}
              />

              {mostrarCriterios && (
                <ul className="mt-2 space-y-1 text-xs">
                  <li className={cn('flex items-center gap-1.5', criterios.len ? 'text-status-ok' : 'text-muted-foreground')}>
                    {criterios.len ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                    Pelo menos 8 caracteres
                  </li>
                  <li className={cn('flex items-center gap-1.5', criterios.upper ? 'text-status-ok' : 'text-muted-foreground')}>
                    {criterios.upper ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                    1 letra maiúscula
                  </li>
                  <li className={cn('flex items-center gap-1.5', criterios.lower ? 'text-status-ok' : 'text-muted-foreground')}>
                    {criterios.lower ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                    1 letra minúscula
                  </li>
                  <li className={cn('flex items-center gap-1.5', criterios.digit ? 'text-status-ok' : 'text-muted-foreground')}>
                    {criterios.digit ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                    1 número
                  </li>
                </ul>
              )}

              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className={labelCls}>Confirmar nova senha</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                placeholder="••••••••"
                className={inputCls}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full shadow-md" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Atualizando...' : 'Atualizar senha'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
