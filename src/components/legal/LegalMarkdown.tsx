// Componente client para renderizar o markdown jurídico com estilos prose
// consistentes com o LegalModal. Server components (páginas /termos e /privacidade)
// importam este componente cliente.

'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = {
  content: string
}

export function LegalMarkdown({ content }: Props) {
  return (
    <div className="text-[14px] text-foreground/90 leading-relaxed [&_h1]:hidden [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-1.5 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_ol]:mb-3 [&_li]:leading-relaxed [&_strong]:text-foreground [&_strong]:font-semibold [&_hr]:my-5 [&_hr]:border-border [&_a]:text-primary [&_a]:underline hover:[&_a]:no-underline [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_table]:w-full [&_table]:my-3 [&_table]:border-collapse [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:border [&_th]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:border [&_td]:border-border">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
