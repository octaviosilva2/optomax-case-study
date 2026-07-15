'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Loga só name + message + digest — evita expor stack traces e
    // contexto interno (URLs, payloads) em consoles compartilhados.
    console.error('[app error]', error.name, error.message, error.digest)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Algo deu errado.</h2>
      <button
        onClick={() => reset()}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary-hover"
      >
        Tentar novamente
      </button>
    </div>
  )
}
