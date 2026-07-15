// Página pública de confirmação após o titular solicitar exclusão da conta (Fase 8 / LGPD art. 18).
// Acessível sem login — o usuário foi deslogado pela server action.

import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { CONTATO_EMAIL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Conta marcada para exclusão — OptoMax',
  description: 'Sua solicitação de exclusão foi registrada.',
}

export default function ContaExcluidaPage() {
  return (
    <div className="min-h-screen bg-muted flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-sm p-8 text-center">
        {/* Icone de confirmacao */}
        <div className="w-14 h-14 rounded-2xl bg-status-ok/10 text-status-ok flex items-center justify-center mx-auto mb-4 border border-status-ok/20">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        {/* Titulo em serifa editorial */}
        <h1 className="text-page-title mb-3">
          Conta marcada para exclusão
        </h1>
        <p className="text-meta mb-2 leading-relaxed">
          Recebemos seu pedido. Seus dados serão definitivamente eliminados em{' '}
          <strong className="text-foreground">30 dias</strong>.
        </p>
        <p className="text-meta mb-6 leading-relaxed">
          Caso mude de ideia, entre em contato pelo email{' '}
          <a
            href={`mailto:${CONTATO_EMAIL}`}
            className="font-medium text-foreground font-mono underline underline-offset-2 hover:opacity-80"
          >
            {CONTATO_EMAIL}
          </a>{' '}
          antes do prazo.
        </p>

        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full h-10 rounded-md bg-primary hover:opacity-90 text-primary-foreground text-sm font-medium shadow-md transition-opacity"
        >
          Voltar para o início
        </Link>
      </div>

      <p className="text-meta-xs mt-6">
        <Link href="/contato" className="hover:text-foreground transition-colors">
          Falar com a gente
        </Link>
      </p>
    </div>
  )
}
