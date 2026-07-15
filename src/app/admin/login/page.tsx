'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Wordmark } from '@/components/brand/Wordmark'
import { loginAdminAction } from './actions'

const initialState = { error: null as string | null }

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(loginAdminAction, initialState)

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-sm p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          {/* Wordmark com badge admin dourado */}
          <div className="flex items-center gap-2">
            <Wordmark size="lg" />
            <Badge variant="accent">ADMIN</Badge>
          </div>
          <h1 className="text-page-title">Acesso administrativo</h1>
          <p className="text-meta-xs">Restrito a operadores do sistema</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[13px] font-medium">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              className="h-9 rounded-lg"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[13px] font-medium">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-9 rounded-lg"
            />
          </div>

          {/* Segundo fator: código de 6 dígitos do app autenticador (TOTP). */}
          <div className="space-y-1.5">
            <Label htmlFor="totp" className="text-[13px] font-medium">Código do autenticador</Label>
            <Input
              id="totp"
              name="totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              required
              className="h-9 rounded-lg tracking-[0.3em] text-center"
            />
          </div>

          {state.error && (
            <p className="text-xs text-destructive">{state.error}</p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Verificando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
