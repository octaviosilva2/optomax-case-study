'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  ChevronDown,
  CalendarClock,
  CalendarPlus,
  Zap,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import ModalAdiantarAtendimento from '@/components/atendimento/ModalAdiantarAtendimento'
import ModalNovoAgendamento from '@/app/(app)/agenda/ModalNovoAgendamento'
import { useOrgId } from '@/hooks/useOrgId'

type Props = {
  // fab: botao flutuante (+) no canto inferior mobile — abre modal centralizado
  // button: botao primario do header desktop — abre popover pra baixo
  variant: 'fab' | 'button'
  className?: string
}

/**
 * Menu de "Nova Receita" — mesmas 3 opções de início de atendimento do
 * NovoAtendimentoMenu (Atender agora / Adiantar / Agendar), mas todas levam
 * direto ao formulário de grau (QuickPrescriptionModal), sem pedir duração
 * e sem o modal Ficha × Receita (SPEC §6, CA6/CA8).
 */
export default function NovaReceitaMenu({ variant, className = '' }: Props) {
  // menuOpen: popover desktop
  const [menuOpen, setMenuOpen] = useState(false)
  // dialogOpen: modal mobile (todas as variantes)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [adiantarOpen, setAdiantarOpen] = useState(false)
  const [agendarOpen, setAgendarOpen] = useState(false)
  // Detecção de mobile (breakpoint md = 768px)
  const [isMobile, setIsMobile] = useState(false)
  // Data estável para o modal de agendamento (evita refetch a cada render).
  const [hoje] = useState(() => new Date())
  const { data: orgId } = useOrgId()
  const router = useRouter()

  // Detecção de mobile — pós-mount para evitar hydration mismatch
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Fecha dropdown ao clicar fora (apenas desktop)
  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-receita-menu]')) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Fecha popover/dialog e abre modal de agendar
  function abrirAgendar() {
    setMenuOpen(false)
    setDialogOpen(false)
    if (!orgId) {
      toast.error('Aguarde o carregamento da organização.')
      return
    }
    setAgendarOpen(true)
  }

  // Fecha popover/dialog e navega para a página de receita avulsa (CA19):
  // "Atender agora" deixa de abrir modal — cria o rascunho na página dedicada.
  function abrirEncaixe() {
    setMenuOpen(false)
    setDialogOpen(false)
    router.push('/receitas/nova')
  }

  // Fecha popover/dialog e abre modal de adiantar
  function abrirAdiantar() {
    setMenuOpen(false)
    setDialogOpen(false)
    setAdiantarOpen(true)
  }

  const isButton = variant === 'button'
  const isFab = variant === 'fab'

  // No mobile, todas as variantes abrem modal centralizado.
  // No desktop, button usa popover (FAB só aparece no mobile).
  function handleClick() {
    if (isMobile) {
      setDialogOpen(true)
    } else {
      setMenuOpen((v) => !v)
    }
  }

  // Os 3 itens do menu — mesmo padrão visual do NovoAtendimentoMenu.
  // Usado tanto no popover (desktop) quanto no Dialog (mobile).
  const itens = (
    <>
      <button
        type="button"
        onClick={abrirEncaixe}
        className="group/item w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-status-warning/10 text-status-warning dark:text-status-warning shrink-0">
          <Zap className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-foreground">Atender agora</div>
          <div className="text-[12px] text-muted-foreground leading-snug">
            Emitir receita sem agendamento prévio
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover/item:opacity-100 group-hover/item:translate-x-0 shrink-0" />
      </button>

      <button
        type="button"
        onClick={abrirAdiantar}
        className="group/item w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <CalendarClock className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-foreground">Adiantar atendimento</div>
          <div className="text-[12px] text-muted-foreground leading-snug">
            Emitir receita de um paciente já agendado
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover/item:opacity-100 group-hover/item:translate-x-0 shrink-0" />
      </button>

      <button
        type="button"
        onClick={abrirAgendar}
        className="group/item w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <CalendarPlus className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-foreground">Agendar</div>
          <div className="text-[12px] text-muted-foreground leading-snug">
            Marcar para depois na agenda
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover/item:opacity-100 group-hover/item:translate-x-0 shrink-0" />
      </button>
    </>
  )

  return (
    <>
      {/* FAB mobile — botao redondo flutuante */}
      {isFab && (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          aria-label="Nova receita"
          className={`inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 ${className}`}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Botao primario — popover (desktop) ou modal (mobile) */}
      {isButton && (
        <div className={`relative ${className}`} data-receita-menu>
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground shadow-md hover:bg-primary-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova receita
            <ChevronDown className="h-4 w-4 ml-1" />
          </button>

          {/* Popover desktop — só renderiza quando não é mobile */}
          {menuOpen && !isMobile && (
            <div
              data-receita-menu
              className="absolute z-40 top-full right-0 mt-1 w-[280px] rounded-xl bg-popover border border-border shadow-xl p-2"
            >
              <div className="flex flex-col gap-2">
                {itens}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal centralizado — usado por TODAS as variantes no mobile */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg font-semibold text-foreground">
              Nova receita
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {itens}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modais de ação — destino="receita" pula duração e o modal Ficha×Receita,
          indo direto ao formulário de grau (QuickPrescriptionModal). "Atender
          agora" (B3, CA19) não usa mais modal — navega para /receitas/nova
          (abrirEncaixe acima); Adiantar/Agendar continuam vinculados a
          agendamento e nascem finalizados (fora deste bloco). */}
      <ModalAdiantarAtendimento open={adiantarOpen} onOpenChange={setAdiantarOpen} destino="receita" />
      <ModalNovoAgendamento
        open={agendarOpen}
        onOpenChange={setAgendarOpen}
        orgId={orgId ?? ''}
        dataSelecionada={hoje}
      />
    </>
  )
}
