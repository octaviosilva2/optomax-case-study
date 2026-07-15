// Página pública /comece — instruções iniciais para novos usuários do OptoMax.
// Acessível sem login; layout consistente com /em-breve e /contato.

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'
import { CONTATO_EMAIL } from '@/lib/constants'
import { Wordmark } from '@/components/brand/Wordmark'

export const metadata: Metadata = {
  title: 'Comece por aqui — OptoMax',
  description: 'Como começar com o OptoMax: 5 passos para criar conta, configurar e gerar sua primeira receita.',
}

// Lista dos 5 passos do onboarding inicial.
// Cada passo curto, prático, sem juridiquês. Tom acolhedor.
const PASSOS = [
  {
    titulo: 'Crie sua conta',
    descricao:
      'Acesse optomax.com.br e clique em "Começar teste grátis". Você precisa de um email válido.',
  },
  {
    titulo: 'Confirme seu email',
    descricao:
      'Verifique sua caixa de entrada (e o spam) — clique no link que enviamos para ativar.',
  },
  {
    titulo: 'Complete o onboarding (3 minutos)',
    descricao:
      'Dados da sua clínica, seus dados profissionais e os tipos de consulta que você atende.',
  },
  {
    titulo: 'Cadastre seu primeiro paciente',
    descricao:
      'No menu lateral, clique em "Pacientes" → "Novo paciente".',
  },
  {
    titulo: 'Faça uma ficha completa e gere a receita',
    descricao:
      'A partir do paciente, inicie um atendimento. Preencha a ficha optométrica e gere a receita em PDF — pronta para o paciente baixar ou ir direto ao WhatsApp.',
  },
]

export default function ComecePage() {
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
        <div className="mb-10">
          <h1 className="text-page-hero">
            Bem-vindo ao OptoMax
          </h1>
          <p className="text-meta mt-3 leading-relaxed">
            O OptoMax é um sistema de gestão clínica feito exclusivamente para
            optometristas brasileiros.
          </p>
        </div>

        {/* 5 passos */}
        <section className="mb-10">
          <h2 className="font-serif text-xl tracking-tight text-foreground mb-4">
            Como começar em 5 passos
          </h2>
          <ol className="space-y-4">
            {PASSOS.map((passo, idx) => (
              <li
                key={passo.titulo}
                className="rounded-xl border border-border bg-card p-4 flex gap-3 shadow-sm"
              >
                {/* Número do passo num círculo */}
                <div className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[13px] font-semibold">
                  {idx + 1}
                </div>
                <div className="min-w-0">
                  <h3 className="text-card-title">
                    {passo.titulo}
                  </h3>
                  <p className="text-meta mt-1 leading-relaxed">
                    {passo.descricao}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Box de feedback — chama a atenção para o canal de reporte */}
        <section className="mb-10 rounded-xl border border-status-warning/30 bg-status-warning/5 p-5">
          <h2 className="font-serif text-lg tracking-tight text-foreground mb-2">
            Sua opinião importa
          </h2>
          <p className="text-sm text-foreground/80 leading-relaxed">
            Encontrou algo estranho? Tem uma sugestão? Use o botão{' '}
            <strong className="font-semibold">&quot;Reportar problema&quot;</strong> no
            topo do app (ícone laranja) — ele abre direto o WhatsApp da nossa equipe.
          </p>
        </section>

        {/* Suporte e contato */}
        <section className="mb-10">
          <h2 className="font-serif text-xl tracking-tight text-foreground mb-3">
            Suporte e contato
          </h2>
          <ul className="space-y-2 text-sm text-foreground/90">
            <li className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>
                Email:{' '}
                <a
                  href={`mailto:${CONTATO_EMAIL}`}
                  className="text-primary underline hover:no-underline font-medium break-all"
                >
                  {CONTATO_EMAIL}
                </a>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>
                WhatsApp:{' '}
                <Link
                  href="/contato"
                  className="text-primary underline hover:no-underline font-medium"
                >
                  Fale com a gente
                </Link>
              </span>
            </li>
          </ul>
        </section>

        {/* CTA final — botão grande para o cadastro */}
        <div className="flex justify-center">
          <Link
            href="/cadastro"
            className="inline-flex items-center gap-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground px-6 py-3 text-sm font-semibold shadow-md transition-opacity"
          >
            Ir para o cadastro
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>

      {/* Footer simples */}
      <footer className="bg-card border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between text-meta-xs">
          <span>© {new Date().getFullYear()} OptoMax</span>
          <Link href="/" className="hover:text-foreground transition-colors">
            Início
          </Link>
        </div>
      </footer>
    </div>
  )
}
