'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_MAIN, isNavActive, type NavItem } from './nav-config'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

// Bottom tab bar do mobile (<768px): as abas principais ao alcance do polegar.
// Configurações/Perfil/Sair ficam no menu do avatar (TopbarMobile), não aqui.
// Itens com `children` (ex.: Atendimento → Fichas/Receita) não navegam direto:
// abrem um sheet curto pra escolher o destino.
export function BottomNav() {
  const pathname = usePathname()
  const [openGroup, setOpenGroup] = useState<NavItem | null>(null)

  return (
    <>
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card"
        // Safe area do home indicator (iPhone).
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        aria-label="Navegação principal"
      >
        {NAV_MAIN.map((item) => {
          const { href, label, icon: Icon, children } = item
          const active = children
            ? children.some((child) => isNavActive(pathname, child.href))
            : isNavActive(pathname, href)
          const tabClass = [
            'flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[11px] tracking-tight',
            active ? 'font-medium text-primary' : 'text-muted-foreground',
          ].join(' ')

          if (children) {
            return (
              <button
                key={href}
                type="button"
                onClick={() => setOpenGroup(item)}
                aria-haspopup="dialog"
                className={tabClass}
              >
                <Icon className="h-[22px] w-[22px]" />
                <span className="max-w-full truncate px-0.5">{label}</span>
              </button>
            )
          }

          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={tabClass}>
              <Icon className="h-[22px] w-[22px]" />
              <span className="max-w-full truncate px-0.5">{label}</span>
            </Link>
          )
        })}
      </nav>

      <Sheet open={openGroup !== null} onOpenChange={(open) => !open && setOpenGroup(null)}>
        <SheetContent
          side="bottom"
          className="pb-[max(16px,env(safe-area-inset-bottom))]"
          aria-describedby={undefined}
        >
          <SheetHeader>
            <SheetTitle>{openGroup?.label}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-4 pb-2">
            {openGroup?.children?.map(({ href, label, icon: Icon }) => {
              const active = isNavActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpenGroup(null)}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                    active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent',
                  ].join(' ')}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {label}
                </Link>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
