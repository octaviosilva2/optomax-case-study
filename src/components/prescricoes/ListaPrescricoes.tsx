'use client'

import { useState, useEffect } from 'react'
import { Download, Eye, FileText, Loader2, MoreVertical, Archive, Printer } from 'lucide-react'
import { WhatsAppIcon } from '@/components/icons/whatsapp'
import { usePrescricoes, useDeletarPrescricao } from '@/hooks/usePrescricoes'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { formatarDataCurta } from '@/lib/utils/data'
import { toast } from 'sonner'
import { gerarLinkPublicoPrescricao } from '@/app/(app)/ficha/[id]/actions'

type Props = {
  patientId: string
  // orgId opcional — defesa em profundidade contra falha/ausência de RLS.
  // Recomendado fornecer sempre que disponível no contexto.
  orgId?: string
  variante?: 'compacta' | 'completa'
  whatsapp?: string | null
}

// Receita unificada — sem distinção de tipo na UI.
// Mantemos a variável para compatibilidade em caso de rollback, mas não usamos.

// Reutiliza helper centralizado em lib/utils/data.ts

/**
 * Lista as prescrições emitidas para o paciente, com botões de
 * Visualizar (preview em nova aba) e Baixar PDF (download direto).
 */
export function ListaPrescricoes({ patientId, orgId, variante = 'compacta', whatsapp }: Props) {
  const { data: prescricoes, isLoading, isError } = usePrescricoes(patientId, orgId)
  const deletarPrescricao = useDeletarPrescricao()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [prescricaoParaExcluir, setPrescricaoParaExcluir] = useState<string | null>(null)

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  // Soft delete (arquivar) via mutation — invalida queries de prescrições e receitas
  async function handleConfirmarArquivar() {
    if (!prescricaoParaExcluir) return
    try {
      await deletarPrescricao.mutateAsync(prescricaoParaExcluir)
      toast.success('Prescrição arquivada')
    } catch {
      toast.error('Erro ao arquivar prescrição')
    } finally {
      setPrescricaoParaExcluir(null)
    }
  }

  // Normaliza WhatsApp do paciente (mesmo padrão do AtendimentoView).
  function normalizarWhatsapp(): string | null {
    if (!whatsapp) return null
    const digitos = whatsapp.replace(/\D/g, '')
    if (!digitos) return null
    return digitos.length <= 11 ? `55${digitos}` : digitos
  }

  // Envia link PÚBLICO da prescrição via WhatsApp.
  // Usa token HMAC server-side — paciente baixa o PDF sem precisar logar.
  // Etapa 13 #39 (13/05/2026): link agora aponta para a página pública
  // intermediária `/p/[token]` (não direto para o endpoint do PDF) e a
  // mensagem inclui a data de expiração lida do retorno da action.
  async function handleEnviarWhatsapp(prescricaoId: string) {
    const numero = normalizarWhatsapp()
    if (!numero) {
      toast.error('WhatsApp do paciente não cadastrado.')
      return
    }
    const { token, expiraEm, error } = await gerarLinkPublicoPrescricao(prescricaoId)
    if (error || !token) {
      toast.error('Falha ao gerar link público: ' + (error ?? 'desconhecido'))
      return
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const linkPdf = `${origin}/p/${token}`
    const dataExp = expiraEm.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const mensagem = `Olá! Aqui está sua prescrição:\n${linkPdf}\n\nEste link expira em 7 dias (até ${dataExp}).`
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, '_blank')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive py-8 text-center font-medium">
        Erro ao carregar prescrições.
      </p>
    )
  }

  const itens = prescricoes ?? []

  if (itens.length === 0) {
    if (variante === 'completa') {
      return (
        <div className="bg-card rounded-2xl border border-border shadow-[0_2px_12px_rgba(0,0,0,0.01)] p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-subtle text-primary flex items-center justify-center mx-auto mb-4 shadow-inner">
            <FileText className="w-6 h-6" />
          </div>
          <div className="text-[14px] font-bold text-foreground">
            Nenhuma receita emitida ainda
          </div>
          <div className="text-[13px] text-muted-foreground mt-1 max-w-[280px] mx-auto">
            Use o botão acima para emitir a primeira receita.
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground border border-dashed border-border">
          <FileText className="h-5 w-5" />
        </div>
        <p className="text-[13px] text-muted-foreground font-medium">Nenhum documento emitido.</p>
      </div>
    )
  }

  // Se a variante for compacta (sidebar)
  if (variante === 'compacta') {
    return (
      <ul className="space-y-3">
        {itens.map((p) => {
          const dataFmt = formatarDataCurta(p.dataReferencia)
          return (
            <li
              key={p.id}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl border border-border hover:border-primary/15 hover:shadow-sm hover:bg-muted/50 transition-all duration-300"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary-subtle text-primary flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    Prescrição
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-0.5">{dataFmt}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:ml-auto shrink-0">
                <a
                  href={`/api/prescricao/${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] font-semibold text-primary hover:text-primary-hover hover:underline flex items-center gap-1 px-1.5 py-1 rounded hover:bg-primary-subtle transition-all"
                  title="Visualizar PDF"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Ver
                </a>
                <a
                  href={`/api/prescricao/${p.id}?download=1`}
                  className="text-[12px] font-semibold text-primary hover:text-primary-hover hover:underline flex items-center gap-1 px-1.5 py-1 rounded hover:bg-primary-subtle transition-all"
                  title="Baixar PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar
                </a>
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenuId(openMenuId === p.id ? null : p.id)
                    }}
                    aria-label="Mais opções"
                    className="w-6 h-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openMenuId === p.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-2 w-44 bg-card border border-border rounded-xl shadow-[0_12px_30px_rgba(0,0,0,0.08)] z-30 py-1.5 px-1.5 animate-in fade-in slide-in-from-top-1 duration-150"
                    >
                      <button
                        onClick={() => {
                          setPrescricaoParaExcluir(p.id)
                          setOpenMenuId(null)
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-destructive hover:bg-destructive/10 rounded-lg text-left transition-colors"
                      >
                        <Archive className="w-4 h-4" />
                        Arquivar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          )
        })}
        <ConfirmDialog
          open={!!prescricaoParaExcluir}
          onOpenChange={(open) => !open && setPrescricaoParaExcluir(null)}
          titulo="Arquivar prescrição?"
          descricao="A prescrição será arquivada. Você pode restaurá-la depois na tela de Receitas."
          labelConfirmar="Arquivar"
          variante="destrutivo"
          carregando={deletarPrescricao.isPending}
          onConfirmar={handleConfirmarArquivar}
        />
      </ul>
    )
  }

  // Variante COMPLETA (aba Receitas)
  return (
    <div className="space-y-3">
      {itens.map((p) => {
        const dataFmt = formatarDataCurta(p.dataReferencia)

        // Indica se há WhatsApp cadastrado para habilitar/desabilitar o botão.
        // O link em si é resolvido por handleEnviarWhatsapp (token HMAC).
        const temWhatsapp = !!normalizarWhatsapp()

        return (
          <div
            key={p.id}
            className="group rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:border-primary/15 hover:shadow-sm hover:bg-muted/50 transition-all duration-300"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary-subtle text-primary flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-foreground transition-colors duration-200 group-hover:text-primary flex items-center gap-2">
                  Prescrição
                  {p.prescription_type === 'quick' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-status-warning/10 text-status-warning shrink-0 border border-status-warning/30">
                      Rápida
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary-subtle text-primary shrink-0 border border-primary/20">
                      Completa
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-muted-foreground mt-0.5">{dataFmt}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end sm:ml-auto">
              {/* Ver / Baixar / Imprimir — secundários (outline) */}
              <a
                href={`/api/prescricao/${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 rounded-md border border-border bg-card text-foreground text-[13px] font-semibold hover:bg-muted hover:border-primary/20 hover:text-primary flex items-center gap-1.5 transition-all duration-200 active:scale-[0.97] shadow-sm"
              >
                <Eye className="w-4 h-4" />
                Ver PDF
              </a>
              <a
                href={`/api/prescricao/${p.id}?download=1`}
                className="h-8 px-3 rounded-md border border-border bg-card text-foreground text-[13px] font-semibold hover:bg-muted hover:border-primary/20 hover:text-primary flex items-center gap-1.5 transition-all duration-200 active:scale-[0.97] shadow-sm"
              >
                <Download className="w-4 h-4" />
                Baixar
              </a>
              <a
                href={`/api/prescricao/${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 rounded-md border border-border bg-card text-foreground text-[13px] font-semibold hover:bg-muted hover:border-primary/20 hover:text-primary flex items-center gap-1.5 transition-all duration-200 active:scale-[0.97] shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </a>

              {/* Enviar no WhatsApp — ação em destaque (verde) */}
              {temWhatsapp ? (
                <button
                  onClick={() => handleEnviarWhatsapp(p.id)}
                  title="Enviar prescrição pelo WhatsApp do cliente"
                  className="h-8 px-3.5 rounded-md bg-status-ok text-white text-[13px] font-semibold hover:bg-status-ok/90 flex items-center gap-1.5 transition-all duration-200 active:scale-[0.97] shadow-sm"
                >
                  <WhatsAppIcon className="w-4 h-4" />
                  Enviar no WhatsApp
                </button>
              ) : (
                <button
                  onClick={() => toast.error('WhatsApp do paciente não cadastrado.')}
                  className="h-8 px-3.5 rounded-md border border-border bg-muted/20 text-muted-foreground/50 text-[13px] font-semibold flex items-center gap-1.5 cursor-not-allowed"
                  title="WhatsApp não cadastrado"
                >
                  <WhatsAppIcon className="w-4 h-4" />
                  Enviar no WhatsApp
                </button>
              )}

              {/* ⋮ — só Excluir (Baixar/Imprimir viraram botões) */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(openMenuId === p.id ? null : p.id)
                  }}
                  aria-label="Mais opções"
                  className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {openMenuId === p.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-2 w-44 bg-card border border-border rounded-xl shadow-[0_12px_30px_rgba(0,0,0,0.08)] z-30 py-1.5 px-1.5 animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <button
                      onClick={() => {
                        setPrescricaoParaExcluir(p.id)
                        setOpenMenuId(null)
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-destructive hover:bg-destructive/10 rounded-lg text-left transition-colors"
                    >
                      <Archive className="w-4 h-4" />
                      Arquivar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
      <ConfirmDialog
        open={!!prescricaoParaExcluir}
        onOpenChange={(open) => !open && setPrescricaoParaExcluir(null)}
        titulo="Arquivar prescrição?"
        descricao="A prescrição será arquivada. Você pode restaurá-la depois na tela de Receitas."
        labelConfirmar="Arquivar"
        variante="destrutivo"
        carregando={deletarPrescricao.isPending}
        onConfirmar={handleConfirmarArquivar}
      />
    </div>
  )
}
