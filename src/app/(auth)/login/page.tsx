'use client'

// Tela de LOGIN (Fase 3 ASAAS) — só "Entrar".
//
// O cadastro foi movido para a rota dedicada /cadastro (a landing pública leva
// pra lá). Aqui ficou apenas o login. A tela passou a respeitar o deep-link
// ?next: depois de entrar, vai para o destino interno (ex.: /assinar) em vez do
// /dashboard fixo — é o que faz o link de checkout compartilhado funcionar.

import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { logEventClient } from '@/lib/events'
import { safeNextPath } from '@/lib/utils/safe-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Label } from '@/components/ui/label'
import { Wordmark } from '@/components/brand/Wordmark'
import { toast } from 'sonner'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
})

type LoginData = z.infer<typeof loginSchema>

/* Classe compartilhada para inputs */
const inputCls =
  'h-9 rounded-lg border-border bg-card text-[13px] placeholder:text-muted-foreground focus-visible:ring-ring/50 focus-visible:border-ring'

/* Classe compartilhada para labels */
const labelCls = 'text-[13px] font-medium text-foreground'

function LoginPageInner() {
  const searchParams = useSearchParams()
  // Email pré-preenchido quando o user chega da tela de confirmação (?email=).
  const emailParam = searchParams.get('email') ?? ''
  // Destino pós-login (deep-link). Validado como rota interna; senão, /dashboard.
  const next = safeNextPath(searchParams.get('next')) ?? '/dashboard'
  // Repassa o ?next para o link de cadastro, preservando o funil.
  const nextParam = searchParams.get('next')
  const cadastroHref = nextParam
    ? `/cadastro?next=${encodeURIComponent(nextParam)}`
    : '/cadastro'

  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: emailParam, password: '' },
  })

  async function handleLogin(data: LoginData) {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      setLoading(false)
      toast.error('Email ou senha incorretos')
      return
    }

    // Métricas em BACKGROUND — não bloqueiam a navegação. Antes, o `await` dessas
    // queries (count de events + logEvent) criava um delay "morto" entre o clique
    // e o destino, com o botão já fora do estado de loading. Agora navegamos na
    // hora; o `loading` permanece ativo até a troca de rota.
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { count } = await supabase
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('event_name', 'session_started')
          if ((count ?? 0) === 0) {
            await logEventClient('user_first_login')
          }
        }
      } catch {
        // não-bloqueante
      }
      await logEventClient('session_started')
    })()

    // Navega para o destino (deep-link validado ou /dashboard); NÃO reseta
    // `loading` (mantém o feedback até a rota trocar).
    router.push(next)
    router.refresh()
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">

        {/* Header — Wordmark display + tagline editorial */}
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="flex flex-col items-center justify-center gap-3 mb-3">
            <Wordmark size="display" />
          </div>
          <p className="text-sm text-muted-foreground">
            Entre na sua conta
          </p>
        </div>

        {/* Body */}
        <div className="px-8 pb-8">
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className={labelCls}>Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                className={inputCls}
                {...loginForm.register('email')}
              />
              {loginForm.formState.errors.email && (
                <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className={labelCls}>Senha</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputCls}
                // Foca direto na senha quando o email já veio preenchido.
                autoFocus={Boolean(emailParam)}
                {...loginForm.register('password')}
              />
              {loginForm.formState.errors.password && (
                <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full shadow-md"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>

            <div className="text-center">
              <Link
                href="/recuperar-senha"
                className="text-[13px] text-primary hover:text-primary/80 hover:underline underline-offset-2 transition-colors"
              >
                Esqueci minha senha
              </Link>
            </div>
          </form>

          {/* Caminho do cadastro — agora é uma rota própria (/cadastro). */}
          <p className="mt-6 text-center text-[13px] text-muted-foreground">
            Não tem conta?{' '}
            <Link
              href={cadastroHref}
              className="text-primary font-medium hover:underline underline-offset-2"
            >
              Comece o teste grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// useSearchParams exige Suspense boundary para o pré-render estático funcionar.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}
