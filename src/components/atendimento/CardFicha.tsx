'use client'

import { useState } from 'react'
import {
  ClipboardList,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  Pencil,
  Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { gerarLinkPublicoFicha } from '@/app/(app)/ficha/[id]/actions'
import { imprimirPdf } from '@/lib/utils/print'
import {
  normalizarNumero,
  formatarMensagemComExpiracao,
} from '@/lib/utils/whatsapp-link'

type Props = {
  recordId: string
  // Modelo da ficha — define o badge de tipo (Resumida/Completa) ao lado do título.
  modelo: 'resumido' | 'completo'
  paciente: {
    id: string
    nome: string
    whatsapp: string | null
  }
  // Botão "Editar ficha" só aparece quando a ficha está finalizada.
  finalizado: boolean
  // Estado do reabrir (vem de cima para evitar duplicar lógica).
  reabrindo: boolean
  onReabrir: () => void
}

/**
 * Card da Ficha na tela pós-finalização: PDF da ficha (visualizar/baixar/
 * imprimir), edição e envio pelo WhatsApp do paciente. Extraído de
 * CardsPosFinalizacao para poder ser reusado isoladamente.
 */
export function CardFicha({
  recordId,
  modelo,
  paciente,
  finalizado,
  reabrindo,
  onReabrir,
}: Props) {
  const [enviandoFicha, setEnviandoFicha] = useState(false)

  // Rótulo do tipo derivado do modelo (mesma nomenclatura da lista de fichas).
  const tipoLabel = modelo === 'completo' ? 'Completa' : 'Resumida'

  // Abre conversa do WhatsApp com link público da FICHA (sem login).
  async function handleEnviarFichaWhatsapp() {
    const whatsapp = paciente.whatsapp
    if (!whatsapp) {
      toast.error('Paciente sem WhatsApp cadastrado')
      return
    }
    const numero = normalizarNumero(whatsapp)
    if (!numero) {
      toast.error('Paciente sem WhatsApp cadastrado')
      return
    }
    setEnviandoFicha(true)
    try {
      const { token, expiraEm, error } = await gerarLinkPublicoFicha(recordId)
      if (error || !token) {
        toast.error('Falha ao gerar link público: ' + (error ?? 'desconhecido'))
        return
      }
      // Link aponta para a página pública intermediária (#37) — não direto
      // para o endpoint do PDF — para que o paciente veja contexto e CTAs
      // explícitos antes de baixar.
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const linkPdf = `${origin}/f/${token}`
      const mensagem = formatarMensagemComExpiracao(
        'Olá! Aqui está sua ficha clínica:',
        linkPdf,
        expiraEm,
      )
      window.open(
        `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`,
        '_blank',
      )
    } finally {
      setEnviandoFicha(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[15px] font-semibold text-foreground">
              Ficha finalizada
            </h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {tipoLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ficha clínica completa do paciente
          </p>
        </div>
      </header>

      {/* Botões: wrap em mobile, linha em desktop */}
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/ficha/${recordId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Visualizar PDF
          </Button>
        </a>
        <a href={`/api/ficha/${recordId}?download=1`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Baixar PDF
          </Button>
        </a>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => imprimirPdf(`/api/ficha/${recordId}`)}
        >
          <Printer className="h-3.5 w-3.5" />
          Imprimir
        </Button>
        {finalizado && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onReabrir}
            disabled={reabrindo}
          >
            <Pencil className="h-3.5 w-3.5" />
            {reabrindo ? 'Abrindo...' : 'Editar ficha'}
          </Button>
        )}
      </div>

      {/* WhatsApp em verde, largura total (consistente com o resto do app) */}
      <Button
        variant="ghost"
        className="w-full justify-center gap-1.5 bg-status-ok-bg font-semibold text-status-ok hover:bg-status-ok-bg/70"
        onClick={handleEnviarFichaWhatsapp}
        disabled={enviandoFicha}
        title="Enviar ficha pelo WhatsApp do cliente"
      >
        {enviandoFicha ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
        Enviar no WhatsApp do cliente
      </Button>
    </section>
  )
}
