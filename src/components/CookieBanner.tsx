'use client'

// Banner mínimo essencial de cookies (LGPD §14 / Política de Privacidade v1.0).
// O OptoMax só usa cookies estritamente necessários (sessão/auth), por isso o banner
// é informativo — não há toggle de "rejeitar" porque não há cookies opcionais.
// Renderizado no root layout, aparece em TODAS as rotas (pública e autenticada).
// Dismiss persiste em localStorage com a chave versionada `cookie_consent_v1`.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cookie, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'cookie_consent_v1'

export function CookieBanner() {
  // Começa "true" pra evitar flash de banner no SSR antes do effect rodar (mesmo padrão BetaBanner)
  const [accepted, setAccepted] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setAccepted(!!localStorage.getItem(STORAGE_KEY))
  }, [])

  if (accepted) return null

  function handleAceitar() {
    // Persiste o timestamp do aceite — útil pra auditoria interna se algum dia precisar
    localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    setAccepted(true)
  }

  return (
    <div
      // z-40 pra ficar acima do conteúdo, mas ABAIXO dos modais (z-50)
      className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-lg p-4 sm:p-5"
      role="region"
      aria-label="Aviso de cookies"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <Cookie className="h-5 w-5 shrink-0 text-muted-foreground hidden sm:block" />
        <p className="text-[13px] text-foreground/90 leading-relaxed flex-1">
          Usamos cookies essenciais para o funcionamento da plataforma (sessão e autenticação).
          Não usamos cookies de rastreamento ou marketing. Saiba mais na nossa{' '}
          <Link
            href="/privacidade"
            className="underline underline-offset-2 font-medium hover:opacity-80"
          >
            Política de Privacidade
          </Link>.
        </p>
        <Button
          type="button"
          onClick={handleAceitar}
          className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-primary-foreground shadow-md shrink-0"
        >
          Entendi
        </Button>
        {/* Fechar (mobile) — atalho redundante com o "Entendi" pra usuários que esperam um X */}
        <button
          type="button"
          onClick={handleAceitar}
          aria-label="Fechar aviso"
          className="absolute top-2 right-2 p-1 rounded hover:bg-muted text-muted-foreground sm:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default CookieBanner
