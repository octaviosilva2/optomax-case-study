// Banner de manutenção — aparece em todas as páginas quando
// NEXT_PUBLIC_MAINTENANCE=true. Texto custom via NEXT_PUBLIC_MAINTENANCE_MESSAGE.
//
// Uso típico: durante deploy de mudanças não-triviais, ativar a env var
// para avisar usuários que algo pode estar instável temporariamente.

import { AlertTriangle } from 'lucide-react'

export function MaintenanceBanner() {
  if (process.env.NEXT_PUBLIC_MAINTENANCE !== 'true') return null

  const mensagem =
    process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE ??
    'Sistema em manutenção. Algumas funcionalidades podem estar temporariamente indisponíveis.'

  return (
    <div className="w-full bg-status-warning-bg dark:bg-status-warning-bg border-b border-status-warning/30 dark:border-status-warning/30 px-4 py-2.5 flex items-center justify-center gap-2 text-[13px] text-status-warning dark:text-status-warning">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="font-medium">{mensagem}</span>
    </div>
  )
}
