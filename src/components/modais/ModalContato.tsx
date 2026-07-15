'use client'

import { Mail, Phone, Clock, Send, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CONTATO_EMAIL, CONTATO_WHATSAPP_DISPLAY } from '@/lib/constants'

const WA_NUMBER = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? ''

type Props = {
  open: boolean
  onClose: () => void
}

export function ModalContato({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-[480px] w-full p-0 overflow-hidden max-h-[90dvh]"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between px-5 py-4 border-b border-border">
          <DialogTitle className="font-sans font-semibold text-[15px]">Contato</DialogTitle>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90dvh-65px)] sm:max-h-[calc(75vh-65px)] p-5 space-y-5">
          {/* Intro */}
          <div className="text-center space-y-1">
            <p className="text-base font-semibold">Fale com a gente</p>
            <p className="text-sm text-muted-foreground">
              Tire dúvidas sobre o OptoMax, resolva problemas ou mande sugestões.
            </p>
          </div>

          {/* Cards de canal */}
          <div className="grid grid-cols-2 gap-3">
            {/* E-mail */}
            <div className="rounded-xl border border-border p-4 flex flex-col items-center gap-2 text-center">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Mail className="size-4" />
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                E-mail
              </span>
              <span className="text-xs font-medium break-all">{CONTATO_EMAIL}</span>
              <a
                href={`mailto:${CONTATO_EMAIL}`}
                className="mt-auto inline-flex items-center gap-1.5 justify-center rounded-md bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 w-full hover:bg-primary/20 transition-colors"
              >
                <Send className="size-3.5" />
                Enviar e-mail
              </a>
            </div>

            {/* WhatsApp */}
            <div className="rounded-xl border border-border p-4 flex flex-col items-center gap-2 text-center">
              <div className="w-9 h-9 rounded-full bg-status-ok-bg flex items-center justify-center text-status-ok">
                <Phone className="size-4" />
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                WhatsApp
              </span>
              <span className="text-xs font-medium">{CONTATO_WHATSAPP_DISPLAY}</span>
              <a
                href={`https://wa.me/${WA_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center gap-1.5 justify-center rounded-md bg-status-ok-bg text-status-ok text-xs font-semibold px-3 py-1.5 w-full hover:opacity-80 transition-opacity"
              >
                <Phone className="size-3.5" />
                Abrir WhatsApp
              </a>
            </div>

            {/* Horário de atendimento */}
            <div className="col-span-2 rounded-xl border border-border p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Clock className="size-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Atendimento:</strong>{' '}
                segunda a sexta, das 9h às 18h (horário de Brasília).
              </p>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Para solicitações sobre dados pessoais (LGPD), use o e-mail — é o canal do Encarregado.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
