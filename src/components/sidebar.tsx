'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, PanelLeft, PanelLeftClose } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'
import { AvatarMenu } from '@/components/layout/AvatarMenu'
import { NAV_SIDEBAR, isNavActive, type NavItem } from '@/components/layout/nav-config'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'

// Grupo (ex.: Atendimento) que já entra expandido — mostra os filhos de cara,
// sem exigir clique.
function defaultExpandedGroupHref(): string | null {
  return NAV_SIDEBAR.find((item) => item.children)?.href ?? null
}

type Props = {
  /** Estado controlado pelo AppShell (persistido em cookie). Só afeta o desktop. */
  collapsed: boolean
  onToggleCollapsed: () => void
  nomeProfissional: string
  email: string
}

/**
 * Sidebar responsiva — uma estrutura, dois modos visuais:
 * - Tablet (md–lg): rail fixo de 72px, só ícones (sem toggle).
 * - Desktop (lg+): expansível 240px ↔ 72px via toggle, persistido em cookie.
 *
 * A largura e a visibilidade dos rótulos são controladas por classes Tailwind
 * (`group-data-[collapsed]/shell`), nunca por JS de viewport — evita hydration
 * mismatch. O wrapper com `group/shell` + `data-collapsed` vive no AppShell.
 *
 * Tooltips só aparecem no estado recolhido do desktop (no tablet o uso é touch,
 * sem hover); `aria-label` garante a acessibilidade em todos os casos.
 */
export function Sidebar({ collapsed, onToggleCollapsed, nomeProfissional, email }: Props) {
  const pathname = usePathname()
  // Grupo (ex.: Atendimento) expandido no accordion — só existe no desktop
  // expandido; no rail (tablet ou desktop recolhido) o item vira link direto.
  // Entra sempre aberto (mostra Fichas + Receita de cara); clique fecha/abre.
  const [expandedHref, setExpandedHref] = useState<string | null>(defaultExpandedGroupHref)

  function renderLink({ href, label, icon: Icon }: NavItem, active: boolean) {
    const itemClass = [
      'flex h-10 items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors',
      'justify-center lg:group-data-[collapsed=false]/shell:justify-start lg:group-data-[collapsed=false]/shell:px-3',
      active
        ? 'bg-primary/10 text-primary'
        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    ].join(' ')
    const iconClass = `h-[18px] w-[18px] shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`

    const link = (
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        aria-label={label}
        className={itemClass}
      >
        <Icon className={iconClass} />
        <span className="hidden truncate lg:group-data-[collapsed=false]/shell:inline">
          {label}
        </span>
      </Link>
    )

    // Recolhido (desktop rail): rótulo só no tooltip.
    if (collapsed) {
      return (
        <Tooltip key={href}>
          <TooltipTrigger render={link} />
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      )
    }
    return <div key={href}>{link}</div>
  }

  function renderSubItem({ href, label, icon: Icon }: NavItem) {
    const active = isNavActive(pathname, href)
    const itemClass = [
      'flex h-9 items-center gap-2 rounded-lg px-3 text-[12.5px] font-medium transition-colors',
      active
        ? 'bg-primary/10 text-primary'
        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    ].join(' ')
    const iconClass = `h-[15px] w-[15px] shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`
    return (
      <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={itemClass}>
        <Icon className={iconClass} />
        {label}
      </Link>
    )
  }

  // Item com submenu (ex.: Atendimento → Fichas, Receita). No rail (tablet,
  // ou desktop recolhido) vira link direto pro href do grupo — sem espaço
  // pro accordion. No desktop expandido, clique só abre/fecha (accordion puro).
  function renderGroup(item: NavItem) {
    const active = item.children!.some((child) => isNavActive(pathname, child.href))
    const isOpen = expandedHref === item.href
    const Icon = item.icon
    const buttonClass = [
      'flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors',
      active
        ? 'text-primary'
        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    ].join(' ')
    const iconClass = `h-[18px] w-[18px] shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`
    const headerClass = ['hidden lg:group-data-[collapsed=false]/shell:flex', buttonClass].join(' ')
    const chevronClass = [
      'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
      isOpen ? 'rotate-90' : '',
    ].join(' ')

    return (
      <div key={item.href}>
        {/* Rail (tablet sempre; desktop recolhido): link direto, sem accordion. */}
        <div className="lg:group-data-[collapsed=false]/shell:hidden">
          {renderLink(item, active)}
        </div>

        {/* Desktop expandido: cabeçalho do grupo (accordion). */}
        <button type="button" onClick={() => setExpandedHref(isOpen ? null : item.href)} aria-expanded={isOpen} className={headerClass}>
          <Icon className={iconClass} />
          <span className="flex-1 truncate text-left">{item.label}</span>
          <ChevronRight className={chevronClass} />
        </button>
        {isOpen && (
          <div className="hidden flex-col gap-0.5 py-0.5 pl-7 lg:group-data-[collapsed=false]/shell:flex">
            {item.children!.map(renderSubItem)}
          </div>
        )}
      </div>
    )
  }

  function renderItem(item: NavItem) {
    if (item.children) return renderGroup(item)
    return renderLink(item, isNavActive(pathname, item.href))
  }

  return (
    <aside
      className={[
        'hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen shrink-0',
        'bg-sidebar border-r border-sidebar-border',
        'w-[72px] lg:group-data-[collapsed=false]/shell:w-60',
        'transition-[width] duration-200 ease-out',
      ].join(' ')}
      aria-label="Navegação principal"
    >
      {/* Marca / Brand */}
      <div className="flex h-[60px] items-center justify-center gap-2 border-b border-sidebar-border px-3 lg:group-data-[collapsed=false]/shell:justify-between lg:group-data-[collapsed=false]/shell:px-4">
        {/* Marca "O" — só no rail do tablet (escondida em todo lg) */}
        <span className="font-serif text-xl font-semibold leading-none lg:hidden" aria-hidden="true">
          O
        </span>
        {/* Wordmark — só no desktop expandido */}
        <div className="hidden items-center gap-2 lg:group-data-[collapsed=false]/shell:flex">
          <Wordmark size="md" />
        </div>
        {/* Toggle — só no desktop (lg+), nos dois estados */}
        <button
          onClick={onToggleCollapsed}
          className="hidden h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground lg:grid"
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Navegação — minimalista, sem rótulos de seção. Configurações vive no
          menu do avatar (rodapé). */}
      <TooltipProvider delay={0}>
        <nav className="flex flex-col gap-0.5 px-2 pt-3" aria-label="Navegação principal">
          {NAV_SIDEBAR.map(renderItem)}
        </nav>
      </TooltipProvider>

      {/* Rodapé: menu do usuário (avatar → perfil/config/contato/reportar/tema/sair) */}
      <div className="mt-auto border-t border-sidebar-border p-2 lg:group-data-[collapsed=false]/shell:p-3">
        <AvatarMenu nomeProfissional={nomeProfissional} email={email} variant="sidebar" />
      </div>
    </aside>
  )
}
