import Link from 'next/link'
import { Mail } from 'lucide-react'
import { ResendButton } from './ResendButton'

type SearchParams = Promise<{ email?: string }>

// Tela pós-cadastro: orienta o usuário a confirmar o email recebido.
// Server component — recebe `?email=` por search param (Next 15+ async).
export default async function CheckEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const { email } = await searchParams

  return (
    <div className="w-full max-w-md">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">

        <div className="px-8 pt-8 pb-2 text-center">
          {/* Icone de email em destaque */}
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          {/* Titulo em serifa editorial */}
          <h1 className="text-page-title">
            Confirme seu email
          </h1>
        </div>

        <div className="px-8 pb-8 pt-3 space-y-4 text-center">
          {email ? (
            <div className="space-y-1">
              <p className="text-meta">Enviamos um link de confirmação para</p>
              <p className="text-foreground font-medium break-words">{email}</p>
            </div>
          ) : (
            <p className="text-meta">
              Enviamos um link de confirmação para o seu email.
            </p>
          )}

          <p className="text-meta leading-relaxed">
            Clique no link recebido para ativar sua conta. Se não chegar em alguns minutos, confira a caixa de spam.
          </p>

          <div className="pt-2">
            <ResendButton email={email} />
          </div>

          <p className="text-meta pt-2">
            Já confirmou?{' '}
            <Link
              href={email ? `/login?email=${encodeURIComponent(email)}` : '/login'}
              className="text-primary underline hover:no-underline"
            >
              Faça login aqui
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
