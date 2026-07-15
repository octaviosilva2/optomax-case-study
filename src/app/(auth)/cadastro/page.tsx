'use client'

// Tela de CADASTRO dedicada (Fase 3 ASAAS).
//
// Extraída da antiga aba "Criar conta" do /login. A landing pública leva pra cá
// ("Começar teste grátis"). O aceite dos Termos/Política é IMPLÍCITO ao criar a
// conta (padrão de mercado), mas continua registrado no banco (IP, timestamp,
// versão) via finalizarCadastro. Respeita o deep-link ?next: depois de criar a
// conta, vai para o destino interno (senão, /dashboard).

import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getAppUrl } from '@/lib/app-url'
import { safeNextPath } from '@/lib/utils/safe-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Label } from '@/components/ui/label'
import { TermsModal } from '@/components/legal/TermsModal'
import { PrivacyModal } from '@/components/legal/PrivacyModal'
import { Wordmark } from '@/components/brand/Wordmark'
import { finalizarCadastro } from '../login/actions'
import { mensagemErroTelefone, normalizarTelefone, TELEFONE_AJUDA } from '@/lib/validations/onboarding'
import { toast } from 'sonner'

// Schema de cadastro — mesmo da antiga aba "Criar conta". Nome e telefone são
// coletados aqui (o wizard de onboarding foi aposentado). Telefone usa
// mensagemErroTelefone para avisar quando a pessoa inclui o 55 (código do país).
const registerSchema = z
  .object({
    nomeCompleto: z.string().trim().min(3, 'Informe seu nome completo'),
    telefone: z.string().trim().superRefine((val, ctx) => {
      const msg = mensagemErroTelefone(val)
      if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg })
    }),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Mínimo de 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

type RegisterData = z.infer<typeof registerSchema>

/* Classe compartilhada para inputs */
const inputCls =
  'h-9 rounded-lg border-border bg-card text-[13px] placeholder:text-muted-foreground focus-visible:ring-ring/50 focus-visible:border-ring'

/* Classe compartilhada para labels */
const labelCls = 'text-[13px] font-medium text-foreground'

function CadastroPageInner() {
  const searchParams = useSearchParams()
  // Destino pós-cadastro (deep-link). Validado como rota interna; senão, /dashboard.
  const next = safeNextPath(searchParams.get('next')) ?? '/dashboard'
  // Repassa o ?next para o link de login, preservando o funil.
  const nextParam = searchParams.get('next')
  const loginHref = nextParam
    ? `/login?next=${encodeURIComponent(nextParam)}`
    : '/login'

  const [loading, setLoading] = useState(false)
  const [openTerms, setOpenTerms] = useState(false)
  const [openPrivacy, setOpenPrivacy] = useState(false)
  const supabase = createClient()

  const registerForm = useForm<z.input<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { nomeCompleto: '', telefone: '', email: '', password: '', confirmPassword: '' },
  })

  async function handleRegister(data: RegisterData) {
    setLoading(true)
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        // Link de confirmação aponta para o callback PKCE da app — garante
        // domínio canônico (sem www) e troca o code por sessão.
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
        // Nome vai no metadata como redundância — a gravação canônica é feita
        // pela action finalizarCadastro logo abaixo (em profiles/organizations).
        data: { nome_completo: data.nomeCompleto },
      },
    })

    if (error || !signUpData.user) {
      setLoading(false)
      // Detecta erros específicos para orientar o usuário. A condição de senha é
      // ESTREITA de propósito: só trata como problema de senha quando o Supabase
      // fala em fraqueza/vazamento/comprimento — não qualquer mensagem que contenha
      // "password". A senha agora é livre: piso de 6 chars.
      const msg = (error?.message ?? '').toLowerCase()
      if (
        msg.includes('weak') ||
        msg.includes('pwned') ||
        msg.includes('leak') ||
        (msg.includes('password') && (msg.includes('short') || msg.includes('length') || msg.includes('least') || msg.includes('character')))
      ) {
        toast.error('A senha precisa ter pelo menos 6 caracteres.')
      } else if (msg.includes('email') && (msg.includes('invalid') || msg.includes('valid'))) {
        toast.error('Email inválido. Verifique e tente novamente.')
      } else if (msg.includes('registered') || msg.includes('exists')) {
        toast.error('Esse email já está cadastrado. Tente fazer login ou recuperar a senha.')
      } else if (error?.message) {
        toast.error(error.message)
      } else {
        toast.error('Erro ao criar conta. Tente novamente.')
      }
      return
    }

    // Grava nome (profile) + telefone (org) + aceite dos termos numa única
    // action. Aceite é IMPLÍCITO ao criar conta. O try/catch garante que
    // QUALQUER falha aqui NUNCA prenda o usuário na tela de cadastro. userId NÃO
    // é enviado: a action lê da sessão (F3-C01).
    try {
      const r = await finalizarCadastro({
        nomeCompleto: data.nomeCompleto,
        // Telefone já validado pelo schema → normaliza para o formato limpo.
        telefone: normalizarTelefone(data.telefone) ?? data.telefone,
      })
      if (r?.error) console.warn('Falha ao finalizar cadastro:', r.error)
    } catch (e) {
      console.warn('Falha ao finalizar cadastro:', e)
    }

    // Confirmação de email DESLIGADA: o signUp já cria a sessão ativa. Usamos
    // navegação HARD (full reload) em vez de router.push: força um GET real
    // levando os cookies de sessão recém-setados, o middleware enxerga o usuário
    // e libera o destino. Mais confiável que o client router neste ponto.
    window.location.assign(next)
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
            Crie sua conta — 7 dias grátis, sem cartão
          </p>
        </div>

        {/* Body */}
        <div className="px-8 pb-8">
          <form onSubmit={registerForm.handleSubmit(handleRegister as never)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reg-nome" className={labelCls}>Nome completo</Label>
              <Input
                id="reg-nome"
                type="text"
                autoComplete="name"
                placeholder="Dr. João Silva"
                className={inputCls}
                {...registerForm.register('nomeCompleto')}
              />
              {registerForm.formState.errors.nomeCompleto && (
                <p className="text-xs text-destructive">{registerForm.formState.errors.nomeCompleto.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-telefone" className={labelCls}>Telefone</Label>
              <Input
                id="reg-telefone"
                type="tel"
                autoComplete="tel"
                placeholder="47991960107"
                className={inputCls}
                {...registerForm.register('telefone')}
              />
              {registerForm.formState.errors.telefone ? (
                <p className="text-xs text-destructive">{registerForm.formState.errors.telefone.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{TELEFONE_AJUDA}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-email" className={labelCls}>Email</Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                className={inputCls}
                {...registerForm.register('email')}
              />
              {registerForm.formState.errors.email && (
                <p className="text-xs text-destructive">{registerForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-password" className={labelCls}>Senha</Label>
              <PasswordInput
                id="reg-password"
                autoComplete="new-password"
                placeholder="••••••••"
                className={inputCls}
                {...registerForm.register('password')}
              />
              {/* Senha livre: única regra é o mínimo de 6 caracteres (piso do Supabase Auth). */}
              {registerForm.formState.errors.password ? (
                <p className="text-xs text-destructive">{registerForm.formState.errors.password.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className={labelCls}>Confirmar senha</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                placeholder="••••••••"
                className={inputCls}
                {...registerForm.register('confirmPassword')}
              />
              {registerForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full shadow-md"
              disabled={loading}
            >
              {loading ? 'Criando conta...' : 'Criar conta e começar'}
            </Button>

            {/* Aceite implícito — ao criar a conta o usuário concorda com os
                Termos e a Política. Links abrem os modais (não navegam). */}
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Ao clicar em criar conta, você concorda com nossos{' '}
              <button
                type="button"
                onClick={() => setOpenTerms(true)}
                className="text-primary underline hover:no-underline"
              >
                Termos de Uso
              </button>{' '}
              e{' '}
              <button
                type="button"
                onClick={() => setOpenPrivacy(true)}
                className="text-primary underline hover:no-underline"
              >
                Política de Privacidade
              </button>.
            </p>
          </form>

          {/* Caminho de volta ao login. */}
          <p className="mt-6 text-center text-[13px] text-muted-foreground">
            Já tem conta?{' '}
            <Link
              href={loginHref}
              className="text-primary font-medium hover:underline underline-offset-2"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>

      {/* Modais — montados sempre, abertos via state */}
      <TermsModal open={openTerms} onClose={() => setOpenTerms(false)} />
      <PrivacyModal open={openPrivacy} onClose={() => setOpenPrivacy(false)} />
    </div>
  )
}

// useSearchParams exige Suspense boundary para o pré-render estático funcionar.
export default function CadastroPage() {
  return (
    <Suspense>
      <CadastroPageInner />
    </Suspense>
  )
}
