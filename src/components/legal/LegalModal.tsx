'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  content: string
}

// Modal compartilhado para exibir textos jurídicos (Termos / Privacidade).
// Renderizado via createPortal para fugir de stacking contexts do form.
// Não tem botão "Aceitar" — modal é apenas leitura; o aceite é externo via checkbox.
// Lições da Fase 1.2/1.3: usar dvh (não vh) e min-h-0 para scroll funcionar em mobile.
export function LegalModal({ open, onClose, title, content }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Fecha com Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Bloqueia scroll do body enquanto modal está aberto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Clicar no overlay (fora do card) fecha
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  if (!open) return null

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-[760px] max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl bg-background shadow-2xl ring-1 ring-border overflow-hidden">

        {/* Header — botão Voltar à esquerda + título centralizado */}
        <div className="px-5 py-4 border-b border-border bg-card flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 -ml-2 rounded-md hover:bg-muted/50"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <h2 className="text-[15px] md:text-base font-semibold text-foreground">
            {title}
          </h2>
        </div>

        {/* Body com scroll interno — min-h-0 é crítico para o flex permitir overflow */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
          <div className="text-[14px] text-foreground/90 leading-relaxed [&_h1]:hidden [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-1.5 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_ol]:mb-3 [&_li]:leading-relaxed [&_strong]:text-foreground [&_strong]:font-semibold [&_hr]:my-5 [&_hr]:border-border [&_a]:text-primary [&_a]:underline hover:[&_a]:no-underline [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_table]:w-full [&_table]:my-3 [&_table]:border-collapse [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:border [&_th]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:border [&_td]:border-border">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        </div>

      </div>
    </div>,
    document.body
  )
}
