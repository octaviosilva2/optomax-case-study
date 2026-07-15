// Layout reutilizado pelas páginas legais (Termos e Privacidade).
// Estrutura: header com voltar/Wordmark, container max-width legível,
// estilos tipográficos consistentes para texto longo.

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'

type Props = {
  titulo: string
  ultimaAtualizacao: string
  children: React.ReactNode
}

export function LegalPageLayout({ titulo, ultimaAtualizacao, children }: Props) {
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

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-8 sm:p-10">
          {/* Meta editorial — data em mono */}
          <p className="text-eyebrow font-mono mb-3">
            Documento — publicada em {ultimaAtualizacao}
          </p>
          {/* Titulo em serifa editorial */}
          <h1 className="text-page-title">
            {titulo}
          </h1>

          {/* Prose editorial — H2 em serifa, corpo legivel */}
          <div className="prose prose-sm dark:prose-invert max-w-none mt-6 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:text-sm [&_p]:text-foreground/90 [&_p]:leading-relaxed [&_p]:mb-3 [&_ul]:text-sm [&_ul]:text-foreground/90 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_li]:leading-relaxed [&_strong]:text-foreground">
            {children}
          </div>
        </div>
      </main>

      {/* Footer das páginas públicas legais — adicionado na Fase 8 para expor o canal /contato */}
      <footer className="border-t border-border bg-card mt-auto">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between text-[12px] text-muted-foreground">
          <span>© {new Date().getFullYear()} OptoMax</span>
          <Link href="/contato" className="hover:text-foreground transition-colors">
            Contato
          </Link>
        </div>
      </footer>
    </div>
  )
}
