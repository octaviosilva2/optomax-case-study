import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/LegalPageLayout'
import { LegalMarkdown } from '@/components/legal/LegalMarkdown'
import { PRIVACY_MD } from '@/lib/legal/documents'
import { TERMS_VERSION, TERMS_PUBLISHED_AT } from '@/lib/legal/version'

export const metadata: Metadata = {
  title: 'Política de Privacidade | OptoMax',
  description: 'Política de Privacidade da plataforma OptoMax',
}

export default function PrivacidadePage() {
  return (
    <LegalPageLayout titulo="Política de Privacidade" ultimaAtualizacao={TERMS_PUBLISHED_AT}>
      <LegalMarkdown content={PRIVACY_MD} />
      <hr className="my-6 border-border" />
      <p className="text-[12px] text-muted-foreground">
        Versão {TERMS_VERSION} — publicada em {TERMS_PUBLISHED_AT}
      </p>
    </LegalPageLayout>
  )
}
