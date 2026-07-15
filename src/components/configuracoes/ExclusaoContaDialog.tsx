'use client'

// Dialog de confirmação para exclusão de conta (LGPD art. 18).
// Padrão createPortal direto (sem dialog.tsx genérico) — mesmo padrão do QuickPrescriptionModal.
// Exige digitar "EXCLUIR" maiúsculo para habilitar o botão de confirmação.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { solicitarExclusaoConta } from '@/app/(app)/configuracoes/actions'
import { CONTATO_EMAIL } from '@/lib/constants'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CONFIRMACAO_EXIGIDA = 'EXCLUIR'

export function ExclusaoContaDialog({ open, onOpenChange }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [reason, setReason] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reseta estado ao fechar
  useEffect(() => {
    if (!open) {
      setReason('')
      setConfirmacao('')
      setSubmitting(false)
    }
  }, [open])

  // Fecha com Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onOpenChange(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, submitting, onOpenChange])

  // Bloqueia scroll do body enquanto modal está aberto
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Só monta o portal no client (evita SSR hydration mismatch)
  if (typeof window === 'undefined') return null
  if (!open) return null

  const podeConfirmar = confirmacao === CONFIRMACAO_EXIGIDA && !submitting

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current && !submitting) onOpenChange(false)
  }

  async function handleConfirmar() {
    if (!podeConfirmar) return
    setSubmitting(true)
    try {
      const result = await solicitarExclusaoConta({
        reason: reason.trim() || undefined,
        confirmacao,
      })
      // Em caso de sucesso o server action redireciona — o catch abaixo trata o
      // NEXT_REDIRECT lançado pelo redirect(). Não precisa de else aqui.
      if (result?.error) {
        toast.error(result.error)
        setSubmitting(false)
      }
    } catch (err) {
      // redirect() lança NEXT_REDIRECT — não é erro de verdade
      const isRedirect = err instanceof Error && err.message.includes('NEXT_REDIRECT')
      if (!isRedirect) {
        console.error('[ExclusaoContaDialog] erro:', err)
        toast.error('Erro inesperado. Tente novamente.')
        setSubmitting(false)
      }
    }
  }

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exclusao-conta-title"
    >
      <div className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col min-h-0 rounded-xl bg-background ring-1 ring-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-border">
          <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 id="exclusao-conta-title" className="text-[15px] font-semibold tracking-tight flex-1">
            Excluir conta e dados
          </h2>
          <button
            type="button"
            onClick={() => !submitting && onOpenChange(false)}
            disabled={submitting}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scroll interno */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {/* Aviso forte em vermelho */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-[13px] font-semibold text-destructive">
              Esta ação é IRREVERSÍVEL após 30 dias.
            </p>
            <p className="text-[12px] text-destructive/80 mt-1">
              Não há como recuperar depois disso.
            </p>
          </div>

          <div>
            <p className="text-[13px] text-foreground/90 mb-2">
              Ao confirmar, serão eliminados:
            </p>
            <ul className="text-[13px] text-foreground/90 list-disc pl-5 space-y-1">
              <li>Sua conta de profissional</li>
              <li>Todos os pacientes cadastrados</li>
              <li>Todas as fichas clínicas e prescrições</li>
              <li>Configurações da clínica</li>
            </ul>
          </div>

          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Você terá <strong className="text-foreground">30 dias</strong> para reverter,
            entrando em contato pelo email <span className="font-medium text-foreground">{CONTATO_EMAIL}</span>.
            Após esse prazo, seus dados serão eliminados definitivamente conforme a
            Política de Privacidade.
          </p>

          {/* Motivo opcional */}
          <div className="space-y-1.5">
            <Label htmlFor="exclusao-motivo">Motivo (opcional)</Label>
            <textarea
              id="exclusao-motivo"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Conta-nos o que motivou a saída — nos ajuda a melhorar"
              rows={3}
              maxLength={2000}
              disabled={submitting}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-50"
            />
          </div>

          {/* Confirmação textual */}
          <div className="space-y-1.5">
            <Label htmlFor="exclusao-confirmacao">
              Digite <span className="font-mono font-semibold text-destructive">{CONFIRMACAO_EXIGIDA}</span> para confirmar
            </Label>
            <Input
              id="exclusao-confirmacao"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder={CONFIRMACAO_EXIGIDA}
              autoComplete="off"
              disabled={submitting}
              className="font-mono"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-border bg-muted/30">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirmar}
            disabled={!podeConfirmar}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar exclusão'
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default ExclusaoContaDialog
