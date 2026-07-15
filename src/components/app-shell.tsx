'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { TopbarMobile } from './layout/TopbarMobile'
import { BottomNav } from './layout/BottomNav'

type Props = {
  nomeProfissional: string
  email: string
  /** Estado inicial do colapso, lido do cookie no Server Component (evita salto no SSR). */
  defaultCollapsed: boolean
  children: React.ReactNode
}

export function AppShell({ nomeProfissional, email, defaultCollapsed, children }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      // Persiste pra o próximo SSR renderizar já na largura certa.
      document.cookie = `sidebar_collapsed=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
      return next
    })
  }

  return (
    // `group/shell` + `data-collapsed` controlam largura/rótulos da sidebar via CSS.
    <div data-collapsed={collapsed} className="group/shell flex min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        nomeProfissional={nomeProfissional}
        email={email}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopbarMobile nomeProfissional={nomeProfissional} email={email} />
        <main className="flex-1 overflow-y-auto">
          {/* pb extra no mobile pra conteúdo não ficar atrás da BottomNav */}
          <div className="px-4 pt-6 pb-24 md:px-8 md:pt-8 md:pb-8">{children}</div>
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
