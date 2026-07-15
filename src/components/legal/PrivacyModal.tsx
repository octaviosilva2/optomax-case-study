'use client'

import { LegalModal } from './LegalModal'
import { PRIVACY_MD } from '@/lib/legal/documents'

type Props = {
  open: boolean
  onClose: () => void
}

export function PrivacyModal({ open, onClose }: Props) {
  return (
    <LegalModal
      open={open}
      onClose={onClose}
      title="Política de Privacidade"
      content={PRIVACY_MD}
    />
  )
}
