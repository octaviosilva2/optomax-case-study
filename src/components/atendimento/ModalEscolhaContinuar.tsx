'use client'

// Modal "Escolha como continuar" (Ficha × Receita) — Reorganização "Novo Atendimento".
// Componente BURRO: não cria nada, só apresenta as 2 opções e delega ao parent
// (SPEC.md §4). Gate visual aprovado: .claude/mockups/08-modal-escolha-continuar.html

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, FileText, Glasses, X } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Quando presente, mostra o subtítulo dinâmico "Iniciando atendimento com [Nome]"
  paciente?: { id: string; nome: string }
  onEscolherFicha: () => void
  onEscolherReceita: () => void
  // Quando definido, mostra o botão "Voltar" (o modal veio de um passo anterior)
  onVoltar?: () => void
}

export default function ModalEscolhaContinuar({
  open,
  onOpenChange,
  paciente,
  onEscolherFicha,
  onEscolherReceita,
  onVoltar,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const fichaBtnRef = useRef<HTMLButtonElement>(null)

  // Esc fecha — mesmo comportamento do X (não cria nada, CA1)
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onOpenChange])

  // Bloqueia scroll do body enquanto aberto
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // A11y: foco inicial no card Ficha
  useEffect(() => {
    if (open) fichaBtnRef.current?.focus()
  }, [open])

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onOpenChange(false)
  }

  if (!open) return null

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-escolha-continuar-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-[460px] rounded-2xl bg-background shadow-2xl ring-1 ring-border p-6">
        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="modal-escolha-continuar-titulo" className="text-xl font-semibold text-foreground">
              Escolha como continuar
            </h2>
            <p className="text-[13px] text-muted-foreground mt-0.5 min-h-[16px] truncate">
              {paciente ? `Iniciando atendimento com ${paciente.nome}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <button
            ref={fichaBtnRef}
            type="button"
            onClick={onEscolherFicha}
            className="flex flex-col items-start gap-2.5 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary-subtle focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Glasses className="h-5 w-5" />
            </span>
            <span className="text-[14px] font-semibold text-foreground">Ficha Clínica</span>
            <span className="text-[12px] text-muted-foreground leading-snug">
              Resumida ou completa, com receita gerada automaticamente ao finalizar.
            </span>
          </button>

          <button
            type="button"
            onClick={onEscolherReceita}
            className="flex flex-col items-start gap-2.5 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-status-info hover:bg-status-info-bg focus:outline-none focus:ring-2 focus:ring-status-info"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-status-info/10 text-status-info">
              <FileText className="h-5 w-5" />
            </span>
            <span className="text-[14px] font-semibold text-foreground">Receita</span>
            <span className="text-[12px] text-muted-foreground leading-snug">
              Só o grau/dioptria, com PDF emitido na hora, sem abrir ficha.
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
