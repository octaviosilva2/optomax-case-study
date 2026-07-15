import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/LegalPageLayout'
import { LegalMarkdown } from '@/components/legal/LegalMarkdown'
import { TERMS_MD } from '@/lib/legal/documents'
import { TERMS_VERSION, TERMS_PUBLISHED_AT } from '@/lib/legal/version'

export const metadata: Metadata = {
  title: 'Termos de Uso | OptoMax',
  description: 'Termos de Uso da plataforma OptoMax',
}

export default function TermosPage() {
  return (
    <LegalPageLayout titulo="Termos de Uso" ultimaAtualizacao={TERMS_PUBLISHED_AT}>
      <LegalMarkdown content={TERMS_MD} />
      <hr className="my-6 border-border" />
      <p className="text-[12px] text-muted-foreground">
        Versão {TERMS_VERSION} — publicada em {TERMS_PUBLISHED_AT}
      </p>
    </LegalPageLayout>
  )
}
