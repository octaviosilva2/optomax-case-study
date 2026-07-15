'use client'

import { Wordmark } from '@/components/brand/Wordmark'
import { AvatarMenu } from './AvatarMenu'

// Barra superior do mobile (<768px): logo à esquerda, menu do avatar à
// direita. Os destinos de navegação ficam na BottomNav; aqui só mora o "Mais".
export function TopbarMobile({ nomeProfissional, email }: { nomeProfissional: string; email: string }) {
  return (
    <header className="md:hidden sticky top-0 z-20 flex h-[56px] shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <Wordmark size="md" />
      </div>
      <AvatarMenu nomeProfissional={nomeProfissional} email={email} variant="topbar" />
    </header>
  )
}
