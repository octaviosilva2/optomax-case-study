'use client'

// Botão "Reportar problema" — abre WhatsApp do suporte (Caio) numa nova aba
// SEM mensagem pré-formatada. Decisão Fase 10.5: optometristas estranharam
// mensagens automáticas — chat fica vazio pra parecer conversa natural.
// Três variantes para encaixar em diferentes contextos da UI.

import { MessageCircleWarning } from 'lucide-react'

type Variant = 'icon' | 'menu-item' | 'inline'

type Props = {
  variant?: Variant
  // Texto custom — usado pelo TrialCountdown ("Falar com a gente").
  // Default depende da variante.
  label?: string
  className?: string
}

export function ReportProblemButton({ variant = 'icon', label, className }: Props) {
  const number = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || ''
  const disabled = !number

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (disabled) {
      console.warn('[ReportProblemButton] NEXT_PUBLIC_SUPPORT_WHATSAPP não configurado')
      return
    }
    // WhatsApp em branco — sem ?text= (Fase 10.5)
    window.open(`https://wa.me/${number}`, '_blank', 'noopener,noreferrer')
  }

  // ----- Variante: icon (botão pequeno com ícone — header) -----
  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={disabled ? 'Suporte não configurado' : 'Reportar problema'}
        aria-label="Reportar problema"
        className={[
          'w-9 h-9 rounded-lg grid place-items-center transition-colors',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
          className ?? '',
        ].join(' ')}
      >
        <MessageCircleWarning className="w-4 h-4" />
      </button>
    )
  }

  // ----- Variante: menu-item (item de dropdown) -----
  if (variant === 'menu-item') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={disabled ? 'Suporte não configurado' : undefined}
        className={[
          'flex w-full items-center gap-2 px-3 py-2 text-[13px] text-left rounded-md',
          'text-foreground hover:bg-muted transition-colors',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
          className ?? '',
        ].join(' ')}
      >
        <MessageCircleWarning className="w-4 h-4 shrink-0" />
        <span>{label ?? 'Reportar problema'}</span>
      </button>
    )
  }

  // ----- Variante: inline (link dentro de texto — banner / pill) -----
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? 'Suporte não configurado' : undefined}
      className={[
        'underline underline-offset-2 font-medium hover:opacity-80 transition-opacity',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline',
        className ?? '',
      ].join(' ')}
    >
      {label ?? 'Reportar problema'}
    </button>
  )
}

export default ReportProblemButton
