'use client'

import { AlertTriangle } from 'lucide-react'
import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  mensagem: string
}

/**
 * Indicador de erro de campo: ícone de alerta com tooltip.
 *
 * A tooltip é renderizada via createPortal no <body> para escapar de
 * containers com `overflow: hidden|auto` (caso típico: células de tabela
 * dentro de scroll horizontal). Antes a tooltip ficava cortada nessas
 * situações.
 */
export function FieldError({ mensagem }: Props) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Mede a posição do botão sempre que o tooltip aparece — evita "salto"
  // se a página rolou ou se o layout mudou entre montagens.
  useLayoutEffect(() => {
    if (!visible || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setPos({
      top: rect.top + window.scrollY - 8,
      left: rect.left + rect.width / 2 + window.scrollX,
    })
  }, [visible])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Erro: ${mensagem}`}
        className="ml-1 text-destructive hover:text-destructive focus:outline-none transition-colors"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
      </button>

      {visible &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              transform: 'translate(-50%, -100%)',
            }}
            className="\
              z-[9999] px-2.5 py-1.5 rounded-md shadow-lg\
              bg-destructive text-white text-xs whitespace-nowrap\
              pointer-events-none\
              after:content-[''] after:absolute after:top-full after:left-1/2\
              after:-translate-x-1/2 after:border-4 after:border-transparent\
              after:border-t-destructive\
            "
          >
            {mensagem}
          </span>,
          document.body,
        )}
    </>
  )
}
