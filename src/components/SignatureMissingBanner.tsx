'use client'

// Banner global que aparece em todas as páginas de (app) quando o profissional
// ainda não cadastrou sua assinatura digital. Persiste até:
//   - o profissional clicar em "Cadastrar agora" e salvar uma assinatura, OU
//   - o profissional fechar via "X" — neste caso, fica dispensado apenas
//     pela sessão atual (sessionStorage), voltando a aparecer no próximo login.

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SignatureUploadDialog } from '@/components/SignatureUploadDialog'

const DISMISS_KEY = 'signature_banner_dismissed'

type Props = {
  // true quando o profile.signature_url está null/vazio
  missing: boolean
}

export function SignatureMissingBanner({ missing }: Props) {
  const [dismissed, setDismissed] = useState(true) // começa "true" pra evitar flash no SSR
  const [dialogOpen, setDialogOpen] = useState(false)

  // Sincroniza com sessionStorage apenas no client (evita hydration mismatch)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  if (!missing || dismissed) return null

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <>
      <div className="w-full bg-status-warning-bg dark:bg-status-warning-bg border-b border-status-warning/30 dark:border-status-warning/30 px-4 py-2.5 flex items-center gap-3 text-[13px] text-status-warning dark:text-status-warning">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          <strong className="font-semibold">Você ainda não cadastrou sua assinatura digital.</strong>{' '}
          Sem ela, seus PDFs de fichas e receitas saem sem assinatura no carimbo.
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-status-warning/40 dark:border-status-warning/30 bg-white/60 dark:bg-status-warning-bg text-status-warning dark:text-status-warning hover:bg-white"
          onClick={() => setDialogOpen(true)}
        >
          Cadastrar agora
        </Button>
        <button
          type="button"
          aria-label="Fechar aviso"
          className="p-1 rounded hover:bg-status-warning-bg dark:hover:bg-status-warning-bg"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <SignatureUploadDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
