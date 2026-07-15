'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  Pencil,
  Printer,
  Send,
  Store,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { gerarLinkPublicoPrescricao } from '@/app/(app)/ficha/[id]/actions'
import { imprimirPdf } from '@/lib/utils/print'
import {
  mascaraWhatsApp,
  normalizarNumero,
  formatarMensagemComExpiracao,
} from '@/lib/utils/whatsapp-link'

type Props = {
  prescricaoId: string
  paciente: {
    id: string
    nome: string
    whatsapp: string | null
  }
  // ─── Props para reuso fora da ficha (tela de receita dedicada /receitas/[id]) ──
  // Quando o card é usado dentro da ficha finalizada (CardsPosFinalizacao) nenhum
  // consumidor as passa, então o comportamento é idêntico ao de hoje.
  //  - mostrarLinkFicha + clinicalRecordId → ação "Ver ficha completa" que navega
  //    para /ficha/{clinicalRecordId}; usada na receita vinculada.
  //  - mostrarEditar → botão "Editar" (a abertura do modal é do componente pai,
  //    via onEditar). No B1-S3 liga só na receita avulsa; o B2 estende à vinculada.
  mostrarLinkFicha?: boolean
  clinicalRecordId?: string | null
  mostrarEditar?: boolean
  // Callback do botão "Editar" — o pai (tela de receita) abre o
  // QuickPrescriptionModal, pois só ele tem os dados completos da prescrição.
  onEditar?: () => void
}

/**
 * Card da Receita/Prescrição na tela pós-finalização: PDF da prescrição
 * (visualizar/baixar/imprimir), envio pelo WhatsApp do paciente e envio para
 * ótica. Extraído de CardsPosFinalizacao para poder ser reusado isoladamente
 * (ex.: futura tela de receita dedicada).
 */
export function CardReceita({
  prescricaoId,
  paciente,
  mostrarLinkFicha,
  clinicalRecordId,
  mostrarEditar,
  onEditar,
}: Props) {
  const router = useRouter()
  const [enviandoPrescricao, setEnviandoPrescricao] = useState(false)
  const [enviandoOtica, setEnviandoOtica] = useState(false)

  // Número da ótica — campo local, sem persistência (zera ao desmontar).
  const [numeroOtica, setNumeroOtica] = useState('')
  const numeroOticaValido = numeroOtica.replace(/\D/g, '').length >= 10

  // Abre conversa do WhatsApp do PACIENTE com link público da PRESCRIÇÃO.
  async function handleEnviarPrescricaoWhatsapp() {
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
    setEnviandoPrescricao(true)
    try {
      const { token, expiraEm, error } = await gerarLinkPublicoPrescricao(prescricaoId)
      if (error || !token) {
        toast.error('Falha ao gerar link público: ' + (error ?? 'desconhecido'))
        return
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const linkPdf = `${origin}/p/${token}`
      const mensagem = formatarMensagemComExpiracao(
        'Olá! Aqui está sua prescrição:',
        linkPdf,
        expiraEm,
      )
      window.open(
        `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`,
        '_blank',
      )
    } finally {
      setEnviandoPrescricao(false)
    }
  }

  // Envia link da PRESCRIÇÃO (NUNCA da ficha — decisão LGPD) para o número
  // da ótica/estabelecimento informado pelo profissional. Mensagem inclui o
  // nome do paciente para identificação.
  async function handleEnviarOtica() {
    if (!numeroOticaValido) return
    const numero = normalizarNumero(numeroOtica)
    if (!numero) {
      toast.error('Número da ótica inválido.')
      return
    }
    setEnviandoOtica(true)
    try {
      const { token, expiraEm, error } = await gerarLinkPublicoPrescricao(prescricaoId)
      if (error || !token) {
        toast.error('Falha ao gerar link público: ' + (error ?? 'desconhecido'))
        return
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const linkPdf = `${origin}/p/${token}`
      const mensagem = formatarMensagemComExpiracao(
        `Olá, segue prescrição do paciente ${paciente.nome}:`,
        linkPdf,
        expiraEm,
      )
      window.open(
        `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`,
        '_blank',
      )
    } finally {
      setEnviandoOtica(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground">
            Receita / Prescrição
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Prescrição em PDF para o paciente ou ótica
          </p>
        </div>
        {/* Receita vinculada: atalho para a ficha completa (os 2 cards). */}
        {mostrarLinkFicha && clinicalRecordId && (
          <button
            type="button"
            onClick={() => router.push(`/ficha/${clinicalRecordId}`)}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/15"
          >
            Ver ficha completa
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </header>

      {/* Botões principais */}
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/prescricao/${prescricaoId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Visualizar PDF
          </Button>
        </a>
        <a href={`/api/prescricao/${prescricaoId}?download=1`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Baixar PDF
          </Button>
        </a>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => imprimirPdf(`/api/prescricao/${prescricaoId}`)}
        >
          <Printer className="h-3.5 w-3.5" />
          Imprimir
        </Button>
        {/* Editar: reabre o formulário de grau. A abertura do modal é do pai
            (só ele tem os dados completos da prescrição) — ver onEditar. */}
        {mostrarEditar && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onEditar?.()}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        )}
      </div>

      {/* WhatsApp em verde, largura total */}
      <Button
        variant="ghost"
        className="w-full justify-center gap-1.5 bg-status-ok-bg font-semibold text-status-ok hover:bg-status-ok-bg/70"
        onClick={handleEnviarPrescricaoWhatsapp}
        disabled={enviandoPrescricao}
        title="Enviar prescrição pelo WhatsApp do cliente"
      >
        {enviandoPrescricao ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
        Enviar no WhatsApp do cliente
      </Button>

      {/* ─── Sub-bloco: Enviar para Ótica (#35) ─────────────────────────────── */}
      <div className="border-t border-border pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Enviar para ótica/outro estabelecimento
          </h3>
        </div>
        {/* Input + botão sempre na mesma linha (compacto), em vez de botão
            full-width empilhado que ficava pesado no mobile. */}
        <div className="flex items-stretch gap-2">
          <input
            type="tel"
            inputMode="numeric"
            placeholder="(00) 00000-0000"
            value={numeroOtica}
            onChange={(e) => setNumeroOtica(mascaraWhatsApp(e.target.value))}
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
            aria-label="Número da ótica"
          />
          <Button
            variant="default"
            onClick={handleEnviarOtica}
            disabled={!numeroOticaValido || enviandoOtica}
            className="h-10 shrink-0 gap-1.5 px-4"
          >
            {enviandoOtica ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Envia só o PDF da prescrição (sem dados clínicos sensíveis).
        </p>
      </div>
    </section>
  )
}
