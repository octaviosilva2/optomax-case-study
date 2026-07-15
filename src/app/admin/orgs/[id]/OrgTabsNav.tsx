'use client'

// Navegação client das 6 tabs do detalhe da org. Lê pathname pra destacar a ativa.
// Mantida client-only porque o layout server não tem acesso confiável ao path
// no Next 15.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TABS } from './_layout-helpers'

export function OrgTabsNav({ orgId }: { orgId: string }) {
  const pathname = usePathname()

  return (
    <nav className="mt-4 flex gap-1 overflow-x-auto -mb-px">
      {TABS.map((tab) => {
        const href = `/admin/orgs/${orgId}/${tab.href}`
        // Considera ativa quando o path bate exatamente OU é uma sub-rota da tab
        // (cobre eventual paginação SSR via querystring sem perder o destaque).
        const ativa = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={tab.key}
            href={href}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 whitespace-nowrap transition-colors ${
              ativa
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
