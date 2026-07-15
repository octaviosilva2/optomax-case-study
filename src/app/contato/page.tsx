// Página pública /contato — canal único para suporte e direitos LGPD (§17 da Política de Privacidade).
// Acessível sem login. Usa o mesmo layout de página legal (header com Voltar + logo) para manter
// consistência com /termos e /privacidade.

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Mail, MessageCircle, Clock } from 'lucide-react'
import { CONTATO_EMAIL } from '@/lib/constants'
import { Wordmark } from '@/components/brand/Wordmark'

export const metadata: Metadata = {
  title: 'Contato — OptoMax',
  description: 'Fale com a equipe OptoMax: email, WhatsApp e horário de atendimento.',
}

// WhatsApp do suporte — mesma env do botão "Reportar Problema" usado no app
const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || ''
// Versão amigável para exibição (DDD + número formatado)
const SUPPORT_WHATSAPP_DISPLAY = '(48) 9807-9707'

export default function ContatoPage() {
  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {/* Header — Wordmark editorial */}
      <header className="bg-card/70 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-meta hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <Wordmark size="md" />
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-12">
        {/* Hero editorial */}
        <div className="text-center mb-10">
          <h1 className="text-page-hero">
            Fale com a gente
          </h1>
          <p className="text-meta mt-3 max-w-md mx-auto leading-relaxed">
            Estamos disponíveis para tirar dúvidas sobre o OptoMax, resolver problemas
            ou ouvir sugestões.
          </p>
        </div>

        {/* Cards de canais — empilhados em mobile, lado a lado em desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Email */}
          <a
            href={`mailto:${CONTATO_EMAIL}`}
            className="rounded-xl bg-card border border-border shadow-xs p-5 text-center hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
              <Mail className="h-5 w-5" />
            </div>
            <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-1">
              Email
            </p>
            <p className="text-sm text-foreground font-medium break-all">
              {CONTATO_EMAIL}
            </p>
          </a>

          {/* WhatsApp */}
          {SUPPORT_WHATSAPP ? (
            <a
              href={`https://wa.me/${SUPPORT_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-card border border-border shadow-xs p-5 text-center hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="h-5 w-5" />
              </div>
              <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-1">
                WhatsApp
              </p>
              <p className="text-sm text-foreground font-medium font-mono">
                {SUPPORT_WHATSAPP_DISPLAY}
              </p>
            </a>
          ) : (
            // Fallback se a env nao estiver configurada: card desativado
            <div className="rounded-xl bg-card border border-border shadow-xs p-5 text-center opacity-50">
              <div className="w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="h-5 w-5" />
              </div>
              <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-1">
                WhatsApp
              </p>
              <p className="text-sm text-muted-foreground">Em breve</p>
            </div>
          )}

          {/* Horario */}
          <div className="rounded-xl bg-card border border-border shadow-xs p-5 text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-1">
              Atendimento
            </p>
            <p className="text-sm text-foreground font-medium leading-relaxed">
              Segunda a sexta<br />
              9h às 18h<br />
              <span className="text-meta-xs">Horário de Brasília</span>
            </p>
          </div>
        </div>

        {/* Aviso LGPD discreto */}
        <p className="text-meta-xs text-center mt-8">
          Para solicitações relacionadas a dados pessoais (LGPD), utilize o email acima — ele
          é o canal único do Encarregado.
        </p>
      </main>

      {/* Footer simples */}
      <footer className="bg-card border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between text-meta-xs">
          <span>© {new Date().getFullYear()} OptoMax</span>
          <Link href="/login" className="hover:text-foreground transition-colors">
            Início
          </Link>
        </div>
      </footer>
    </div>
  )
}
