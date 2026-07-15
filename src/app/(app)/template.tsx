'use client'

/**
 * Cross-fade entre telas. Diferente do layout, o template re-monta a cada
 * navegação — é o lugar idiomático pra animar a troca de página.
 *
 * Fade curto (~150ms) via tw-animate-css (já importado no globals.css).
 * `motion-reduce:animate-none` respeita quem desativa animações no sistema.
 * Envolve tanto o loading.tsx quanto o conteúdo, então a transição cobre o
 * skeleton aparecendo.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in-0 duration-150 ease-out motion-reduce:animate-none">
      {children}
    </div>
  )
}
