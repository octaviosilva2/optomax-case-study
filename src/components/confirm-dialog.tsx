'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descricao: string
  labelConfirmar?: string
  variante?: 'destrutivo' | 'normal'
  carregando?: boolean
  onConfirmar: () => void
  // Conteúdo opcional entre a descrição e os botões (ex: campos extras).
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  onOpenChange,
  titulo,
  descricao,
  labelConfirmar = 'Confirmar',
  variante = 'normal',
  carregando = false,
  onConfirmar,
  children,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Fecha com Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onOpenChange])

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current && !carregando) onOpenChange(false)
  }

  if (!open) return null

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-sm rounded-xl bg-popover border border-border shadow-2xl p-5 space-y-4">
        <div className="space-y-1.5">
          <h3 className="font-sans text-xl font-semibold leading-snug text-foreground">
            {titulo}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{descricao}</p>
        </div>

        {children}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={carregando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={carregando}
            className={
              variante === 'destrutivo'
                ? 'bg-destructive hover:bg-destructive/90 text-white'
                : 'bg-primary hover:bg-primary-hover text-white'
            }
            onClick={onConfirmar}
          >
            {carregando ? 'Aguarde...' : labelConfirmar}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
