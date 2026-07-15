'use client'

import { useEffect, useState } from 'react'
import {
  Plus,
  ChevronDown,
  CalendarClock,
  CalendarPlus,
  Zap,
  Glasses,
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
import ModalEncaixeRapido from '@/components/atendimento/ModalEncaixeRapido'
import ModalNovoAgendamento from '@/app/(app)/agenda/ModalNovoAgendamento'
import { useOrgId } from '@/hooks/useOrgId'

type Props = {
  // compact: botão pequeno com ícone Plus + "Novo atendimento" + dropdown (header da Central)
  // card:    cartão estilo atalho (ícone + título + subtítulo) — usado no dashboard
  // fab:     botão flutuante (+) no canto inferior, mobile — abre modal centralizado
  variant: 'compact' | 'card' | 'fab'
  className?: string
  // Aba "Nova Ficha" (S4/CA6): quando true, as 3 opções pulam o modal
  // Ficha×Receita e vão direto pra ficha, e o rótulo vira "Nova Ficha".
  // Default (false) = "Novo atendimento" (Painel), mostra a escolha.
  pularEscolha?: boolean
}

/**
 * Menu compartilhado de "Novo atendimento".
 *
 * Fonte única das 3 ações de início de atendimento — mesma lista em todo lugar:
 *   1. Atender agora      → encaixe sem agendamento prévio (ModalEncaixeRapido)
 *   2. Adiantar atendimento → iniciar agora um paciente já agendado (ModalAdiantarAtendimento)
 *   3. Agendar            → marcar para depois na agenda (ModalNovoAgendamento)
 *
 * Usado por:
 * - Dashboard (variant="card") → popover ancorado ao card
 * - AtendimentoCentral header (variant="compact") → popover ancorado ao botão
 * - AtendimentoCentral FAB mobile (variant="fab") → MODAL centralizado estilo "Novo paciente"
 */
export default function NovoAtendimentoMenu({ variant, className = '', pularEscolha = false }: Props) {
  const rotulo = pularEscolha ? 'Nova Ficha' : 'Novo atendimento'
  // menuOpen: popover (desktop)
  const [menuOpen, setMenuOpen] = useState(false)
  // dialogOpen: modal centralizado (mobile — todas as variantes)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [adiantarOpen, setAdiantarOpen] = useState(false)
  const [encaixeOpen, setEncaixeOpen] = useState(false)
  const [agendarOpen, setAgendarOpen] = useState(false)
  // Detecção de mobile (breakpoint md = 768px)
  const [isMobile, setIsMobile] = useState(false)
  // Data estável para o modal de agendamento (evita refetch a cada render).
  const [hoje] = useState(() => new Date())
  const { data: orgId } = useOrgId()

  // Detecção de mobile — pós-mount para evitar hydration mismatch
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Fecha dropdown ao clicar fora — mesmo data-attr legado entre rotas.
  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-novo-menu]')) setMenuOpen(false)
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

  // Fecha popover/dialog e abre modal de encaixe
  function abrirEncaixe() {
    setMenuOpen(false)
    setDialogOpen(false)
    setEncaixeOpen(true)
  }

  // Fecha popover/dialog e abre modal de adiantar
  function abrirAdiantar() {
    setMenuOpen(false)
    setDialogOpen(false)
    setAdiantarOpen(true)
  }

  const isCard = variant === 'card'
  const isFab = variant === 'fab'

  // No mobile, todas as variantes abrem modal centralizado.
  // No desktop, FAB ainda usa modal (caso seja renderizado), card/compact usam popover.
  function handleClick() {
    if (isMobile) {
      setDialogOpen(true)
    } else {
      setMenuOpen((v) => !v)
    }
  }

  // Os 3 itens do menu — idênticos em todas as variantes.
  // Usado tanto no popover (desktop/card) quanto no Dialog (mobile FAB)
  // Cada item é um mini-card com borda sutil para separação visual clara.
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
            Encaixe sem agendamento prévio
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
            Iniciar agora um paciente já agendado
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

  // Posicionamento do dropdown por variante (só card e compact usam popover).
  const dropdownPos = isCard
    ? 'top-full mt-2 left-0 right-0'
    : 'top-full mt-2 left-0 sm:left-auto sm:right-0 w-[280px] max-w-[calc(100vw-2rem)]'

  return (
    <>
      {/* Variante "fab": botão flutuante mobile */}
      {isFab && (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          aria-label={rotulo}
          className={`inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 ${className}`}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Variantes "card" e "compact": popover (desktop) ou modal (mobile) */}
      {!isFab && (
        <div
          className={`relative ${isCard ? 'w-full' : 'self-start sm:self-auto'} ${className}`}
          data-novo-menu
        >
          {isCard ? (
            // Variante "card": atalho do dashboard.
            <button
              type="button"
              onClick={handleClick}
              className="w-full text-left rounded-2xl bg-card border border-border shadow-sm p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Glasses className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-foreground flex items-center gap-1.5">
                    {rotulo}
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="text-[12px] text-muted-foreground leading-snug mt-0.5">
                    Iniciar atendimento agora
                  </div>
                </div>
              </div>
            </button>
          ) : (
            // Variante "compact": header da Central / Dashboard.
            // Mesmo tamanho/estilo dos botões "Novo paciente" e "Nova receita":
            // button nativo (evita o has-[>svg]:px-3 do <Button> shadcn que encolhe o padding).
            <button
              type="button"
              onClick={handleClick}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground shadow-md hover:bg-primary-hover transition-colors"
            >
              <Plus className="h-4 w-4" />
              {rotulo}
              <ChevronDown className="h-4 w-4 ml-1" />
            </button>
          )}

          {/* Popover desktop — só renderiza quando não é mobile */}
          {menuOpen && !isMobile && (
            <div
              data-novo-menu
              className={`absolute z-40 rounded-xl bg-popover border border-border shadow-xl p-2 ${dropdownPos}`}
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
              {rotulo}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {itens}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modais de ação — renderizados no portal pelos próprios componentes */}
      <ModalAdiantarAtendimento
        open={adiantarOpen}
        onOpenChange={setAdiantarOpen}
        destino={pularEscolha ? 'ficha' : 'escolha'}
      />
      <ModalEncaixeRapido
        open={encaixeOpen}
        onOpenChange={setEncaixeOpen}
        destino={pularEscolha ? 'ficha' : 'escolha'}
      />
      <ModalNovoAgendamento
        open={agendarOpen}
        onOpenChange={setAgendarOpen}
        orgId={orgId ?? ''}
        dataSelecionada={hoje}
      />
    </>
  )
}
