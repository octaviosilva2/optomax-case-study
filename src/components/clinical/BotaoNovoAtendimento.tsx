'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import ModalNovoAtendimento from './ModalNovoAtendimento'

type Props = {
  // Quando passado, abre o modal com paciente já fixado (uso no perfil do paciente)
  pacienteFixo?: { id: string; nome: string }
  // Permite customizar a aparência do botão; se omitido usa estilo "card" padrão
  className?: string
  children?: React.ReactNode
}

/**
 * Wrapper client component que encapsula o ModalNovoAtendimento.
 * Pode ser usado em server components (Dashboard) ou client components
 * (perfil do paciente) sem dor.
 */
export default function BotaoNovoAtendimento({
  pacienteFixo,
  className,
  children,
}: Props) {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={
          className ??
          'flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:border-primary hover:text-primary transition-colors shadow-sm'
        }
      >
        {children ?? (
          <>
            <Zap className="h-4 w-4" />
            Novo Atendimento
          </>
        )}
      </button>

      <ModalNovoAtendimento
        open={aberto}
        onOpenChange={setAberto}
        pacienteFixo={pacienteFixo}
      />
    </>
  )
}
