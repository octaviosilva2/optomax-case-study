/**
 * Divisor editorial com 3 losangos em accent dourado.
 * Uso: separar secoes editoriais em paginas de conteudo,
 * termos, privacidade, ou dashboard hero.
 *
 * Nao usar em densidade alta (tabelas, forms).
 */

import { cn } from '@/lib/utils'

type EditorialDividerProps = {
  /** Classes adicionais para extensao */
  className?: string
}

/**
 * 3 losangos dourados centralizados — acento editorial entre secoes.
 * @example <EditorialDivider className="my-12" />
 */
export function EditorialDivider({ className }: EditorialDividerProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 my-8',
        className,
      )}
      role="separator"
      aria-hidden="true"
    >
      <span className="size-1.5 rotate-45 bg-accent" />
      <span className="size-1.5 rotate-45 bg-accent" />
      <span className="size-1.5 rotate-45 bg-accent" />
    </div>
  )
}
