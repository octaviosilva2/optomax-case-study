'use client'

// Formulário de nova nota — client component pra dar feedback via toast/inline error.
// Submit via server action criarNotaOrg.

import { useState, useTransition } from 'react'
import { criarNotaOrg } from './actions'

export function NotaForm({ orgId }: { orgId: string }) {
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [content, setContent] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!content.trim()) {
      setErro('A nota não pode ser vazia.')
      return
    }
    setErro(null)
    const fd = new FormData()
    fd.set('orgId', orgId)
    fd.set('content', content)
    startTransition(async () => {
      const res = await criarNotaOrg(fd)
      if (res.error) {
        setErro(res.error)
      } else {
        setContent('')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Nova nota sobre esta org..."
        rows={4}
        maxLength={5000}
        disabled={isPending}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y min-h-[80px]"
      />
      <div className="flex items-center justify-between gap-3">
        {erro ? (
          <p className="text-[12px] text-destructive">{erro}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {content.length}/5000 caracteres · Notas são imutáveis
          </p>
        )}
        <button
          type="submit"
          disabled={isPending || !content.trim()}
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Salvando...' : 'Adicionar nota'}
        </button>
      </div>
    </form>
  )
}
