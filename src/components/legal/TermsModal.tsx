'use client'

import { LegalModal } from './LegalModal'
import { TERMS_MD } from '@/lib/legal/documents'

type Props = {
  open: boolean
  onClose: () => void
}

export function TermsModal({ open, onClose }: Props) {
  return (
    <LegalModal
      open={open}
      onClose={onClose}
      title="Termos de Uso"
      content={TERMS_MD}
    />
  )
}
