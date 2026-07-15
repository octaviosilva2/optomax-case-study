// Página pública /em-breve — vitrine do roadmap SLC 2.0.
// Cria percepção de evolução do produto para visitantes e testers.
// Acessível sem login; segue o mesmo layout das outras públicas (/contato, /comece).

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft,
  MessageCircle,
  Wallet,
  CalendarCheck,
  FileText,
  Smartphone,
  LineChart,
  type LucideIcon,
} from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'

export const metadata: Metadata = {
  title: 'Em breve — OptoMax',
  description: 'O que vem por aí no OptoMax: roadmap dos próximos recursos.',
}

// Itens do roadmap SLC 2.0 (fonte: .context/product.md).
// Mantidos como const para que o grid permaneça previsível e fácil de editar.
type RoadmapItem = {
  icon: LucideIcon
  titulo: string
  descricao: string
}

const ROADMAP: RoadmapItem[] = [
  {
    icon: MessageCircle,
    titulo: 'Lembrete automático de retorno',
    descricao: 'Notifique pacientes na hora certa por WhatsApp, sem esforço.',
  },
  {
    icon: Wallet,
    titulo: 'Módulo financeiro',
    descricao: 'Recebimentos, despesas e fluxo de caixa direto na ficha.',
  },
  {
    icon: CalendarCheck,
    titulo: 'Agendamento online',
    descricao: 'Paciente marca pelo celular, sem ligação.',
  },
  {
    icon: FileText,
    titulo: 'Laudo, atestado e encaminhamento em PDF',
    descricao: 'Mais formatos profissionais além da receita.',
  },
  {
    icon: Smartphone,
    titulo: 'App mobile nativo',
    descricao: 'Acesso direto do celular, sem navegador.',
  },
  {
    icon: LineChart,
    titulo: 'Relatório de evolução do grau',
    descricao: 'Para apresentar ao paciente.',
  },
]

export default function EmBrevePage() {
  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {/* Header — Wordmark editorial */}
      <header className="bg-card/70 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
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

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-12">
        {/* Hero editorial */}
        <div className="text-center mb-10">
          <h1 className="text-page-hero">
            O que vem por aí
          </h1>
          <p className="text-meta mt-3 max-w-xl mx-auto leading-relaxed">
            O OptoMax continua evoluindo. Estamos trabalhando em recursos que vão
            tornar sua clínica ainda mais eficiente.
          </p>
        </div>

        {/* Grid de cards do roadmap */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {ROADMAP.map(({ icon: Icon, titulo, descricao }) => (
            <div
              key={titulo}
              className="relative rounded-xl border border-border bg-card p-5 shadow-xs"
            >
              {/* Badge "Em breve" no canto superior direito — acento dourado */}
              <span className="absolute top-3 right-3 text-xs font-medium bg-accent/15 text-accent-foreground border border-accent/30 px-2 py-0.5 rounded-md">
                Em breve
              </span>

              {/* Icone num circulo com cor primaria */}
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Icon className="h-5 w-5" />
              </div>

              <h3 className="text-card-title leading-snug pr-14">
                {titulo}
              </h3>
              <p className="text-meta mt-1.5 leading-relaxed">
                {descricao}
              </p>
            </div>
          ))}
        </div>

        {/* CTA final — convida o usuario a sugerir features */}
        <p className="text-meta text-center mt-10">
          Tem uma sugestão? Adoramos ouvir o que falta.{' '}
          <Link href="/contato" className="text-primary underline hover:no-underline font-medium">
            Fale com a gente
          </Link>
        </p>
      </main>

      {/* Footer simples */}
      <footer className="bg-card border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between text-meta-xs">
          <span>© {new Date().getFullYear()} OptoMax</span>
          <Link href="/" className="hover:text-foreground transition-colors">
            Início
          </Link>
        </div>
      </footer>
    </div>
  )
}
