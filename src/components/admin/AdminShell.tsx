'use client'

// Chrome compartilhado das páginas internas do /admin (Dashboard, Usuários,
// Auditoria). Header com Wordmark + badge ADMIN, navegação superior com a tab
// ativa destacada via pathname, e botões Atualizar / Sair.
//
// NÃO envolve /admin/login (que não tem layout próprio) — é usado explicitamente
// por cada page interna como wrapper. As pages são server components passados
// como children deste client component (padrão suportado pelo App Router).

import { LogOut, RefreshCw } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import Link from 'next/link'
import { logoutAdminAction } from '@/app/admin/actions'
import { Badge } from '@/components/ui/badge'
import { Wordmark } from '@/components/brand/Wordmark'

const NAV: { href: string; label: string }[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/usuarios', label: 'Usuários' },
  { href: '/admin/billing', label: 'Billing' },
  { href: '/admin/planos', label: 'Planos' },
  { href: '/admin/auditoria', label: 'Auditoria' },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      await logoutAdminAction()
    })
  }

  return (
    <div className="min-h-screen bg-muted">
      <header className="bg-card border-b border-border px-6 pt-4">
        <div className="flex items-center justify-between">
          {/* Marca + badge admin */}
          <div className="flex items-center gap-2">
            <Wordmark size="md" />
            <Badge variant="accent">ADMIN</Badge>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.refresh()}
              disabled={isPending}
              className="h-8 px-3 rounded-md border border-border bg-card text-[13px] font-medium hover:bg-muted flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              onClick={handleLogout}
              className="h-8 px-3 rounded-md border border-border bg-card text-[13px] font-medium hover:bg-muted flex items-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>

        {/* Navegação por tabs — destaca a ativa pelo pathname. */}
        <nav className="mt-4 flex gap-1 -mb-px">
          {NAV.map((item) => {
            // '/admin' é exato; as demais aceitam sub-rotas.
            const ativa =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-[13px] font-medium border-b-2 whitespace-nowrap transition-colors ${
                  ativa
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  )
}
