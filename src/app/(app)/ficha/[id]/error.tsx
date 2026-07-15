'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Error boundary específico da ficha de atendimento. Sem ele, qualquer falha
 * no carregamento (ficha de paciente excluído, permissão negada, timeout)
 * caía no error.tsx global com "Algo deu errado" — sem contexto. Aqui o
 * optometrista entende que é a ficha que não abriu e tem como sair.
 */
export default function AtendimentoError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Loga só name + message + digest — não expõe stack/contexto interno.
    console.error('[atendimento error]', error.name, error.message, error.digest)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-6">
      <h2 className="text-xl font-semibold text-foreground">
        Não foi possível abrir esta ficha
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        A ficha pode ter sido arquivada, o paciente pode ter sido removido, ou
        houve uma falha temporária. Tente novamente ou volte para a lista de
        atendimentos.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary-hover"
        >
          Tentar novamente
        </button>
        <button
          onClick={() => router.push('/ficha')}
          className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
        >
          Voltar aos atendimentos
        </button>
      </div>
    </div>
  )
}
