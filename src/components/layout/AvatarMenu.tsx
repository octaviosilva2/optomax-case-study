'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  ChevronDown,
  CreditCard,
  Settings,
  Mail,
  MessageCircleWarning,
  Palette,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  LogOut,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ModalConfiguracoes } from '@/components/modais/ModalConfiguracoes'
import { ModalConta } from '@/components/modais/ModalConta'
import { ModalContato } from '@/components/modais/ModalContato'

// Menu do usuário compartilhado pela Sidebar (rodapé) e pela TopbarMobile.
// Não é navegação do produto — é "eu, minha conta, ajuda e preferências".
type Props = {
  nomeProfissional: string
  email?: string
  /** Badge de plano exibido no cabeçalho; oculto quando não fornecido. */
  plano?: string
  /** sidebar = trigger com nome+chevron (some no rail via CSS); topbar = só avatar. */
  variant?: 'sidebar' | 'topbar'
}

type ModalType = 'configuracoes' | 'conta' | 'contato'

export function AvatarMenu({ nomeProfissional, email, plano, variant = 'sidebar' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()

  // Evita hydration mismatch no estado ativo do seletor de tema
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Qual modal está aberto
  const [openModal, setOpenModal] = useState<ModalType | null>(null)
  const closeModal = () => setOpenModal(null)

  // Abre o modal com delay de 1 frame para evitar conflito com o fechamento do dropdown.
  // O Base UI Menu fecha ao clicar em um item e o evento pode "vazar" para o dialog,
  // fazendo-o fechar imediatamente. O requestAnimationFrame garante que o modal só abre
  // após o dropdown ter terminado de processar o clique.
  const openModalDelayed = (modal: ModalType) => {
    requestAnimationFrame(() => setOpenModal(modal))
  }

  const iniciais =
    nomeProfissional
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join('') || 'U'

  async function handleLogout() {
    await supabase.auth.signOut()
    // Limpa o cache do React Query: evita que dados da org anterior (ex.: a
    // lista de receitas, cuja queryKey não era escopada por org) apareçam se
    // outra conta logar no mesmo navegador.
    queryClient.clear()
    router.push('/login')
    router.refresh()
  }

  // WhatsApp do suporte com mensagem pré-preenchida (tela atual + versão)
  const supportNumber = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || ''
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? 'v0.1'
  function handleReport() {
    if (!supportNumber) return
    const msg = `Bug no OptoMax [${pathname}] · ${appVersion} · `
    window.open(
      `https://wa.me/${supportNumber}?text=${encodeURIComponent(msg)}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  const avatarSmall = (
    <span className="w-8 h-8 rounded-full grid place-items-center text-white text-[11px] font-semibold bg-gradient-to-br from-primary/80 to-primary shrink-0 select-none">
      {iniciais}
    </span>
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Menu do usuário"
          className={
            variant === 'sidebar'
              ? 'flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-accent justify-center lg:group-data-[collapsed=false]/shell:justify-start'
              : 'flex items-center gap-1 rounded-full pr-1 transition-colors hover:bg-muted'
          }
        >
          {avatarSmall}
          {/* Mobile: chevron sinaliza que o avatar abre um menu */}
          {variant === 'topbar' && (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          {variant === 'sidebar' && (
            <>
              <span className="hidden min-w-0 flex-1 leading-tight lg:group-data-[collapsed=false]/shell:block">
                <span className="block truncate text-[13px] font-medium text-foreground">
                  {nomeProfissional || 'Profissional'}
                </span>
                <span className="block text-[11px] text-muted-foreground">Optometrista</span>
              </span>
              <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground lg:group-data-[collapsed=false]/shell:block" />
            </>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={variant === 'topbar' ? 'end' : 'start'}
          side={variant === 'sidebar' ? 'top' : 'bottom'}
          className="w-72"
        >
          {/* Cabeçalho de identidade — não clicável */}
          <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border mb-1">
            <span className="w-[42px] h-[42px] rounded-full grid place-items-center text-white text-sm font-semibold bg-gradient-to-br from-primary/80 to-primary shrink-0 select-none">
              {iniciais}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{nomeProfissional || 'Profissional'}</p>
              {email && (
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              )}
              {plano && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <Sparkles className="size-[10px]" />
                  Plano {plano}
                </span>
              )}
            </div>
          </div>

          {/* Grupo 1 — Conta */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Conta</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => openModalDelayed('configuracoes')}>
              <Settings />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openModalDelayed('conta')}>
              <CreditCard />
              Conta e plano
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          {/* Grupo 2 — Ajuda */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Ajuda</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => openModalDelayed('contato')}>
              <Mail />
              Contato
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleReport} disabled={!supportNumber}>
              <MessageCircleWarning />
              Reportar problema
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          {/* Seletor de tema — div custom para não fechar o menu ao trocar */}
          <div className="flex items-center gap-2 px-1.5 py-1.5">
            <Palette className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm">Tema</span>
            <div className="flex rounded-md border border-border overflow-hidden">
              {(
                [
                  { value: 'light', Icon: Sun, title: 'Claro' },
                  { value: 'dark', Icon: Moon, title: 'Escuro' },
                  { value: 'system', Icon: Monitor, title: 'Sistema' },
                ] as const
              ).map(({ value, Icon, title }) => (
                <button
                  key={value}
                  title={title}
                  onClick={(e) => {
                    // stopPropagation impede o Base UI de fechar o menu
                    e.stopPropagation()
                    setTheme(value)
                  }}
                  className={cn(
                    'flex items-center justify-center px-2 py-1.5 transition-colors hover:bg-muted',
                    mounted && theme === value ? 'bg-muted text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="size-[14px]" />
                </button>
              ))}
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleLogout} variant="destructive">
            <LogOut />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Modais — renderizados fora do DropdownMenu para não interferir no portal */}
      <ModalConfiguracoes open={openModal === 'configuracoes'} onClose={closeModal} />
      <ModalConta open={openModal === 'conta'} onClose={closeModal} />
      <ModalContato open={openModal === 'contato'} onClose={closeModal} />
    </>
  )
}
