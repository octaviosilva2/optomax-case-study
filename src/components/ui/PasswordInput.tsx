'use client'

// Wrapper do Input com toggle "mostrar/ocultar senha" (ícone olho à direita).
// Mantém todos os props do <input> nativo — só substitui o type entre
// 'password' e 'text' quando o usuário clica no botão.
//
// Uso típico: substitui <Input type="password" /> em forms de signup,
// recuperação de senha e troca de senha — sem mexer em validação ou
// critérios visuais já existentes nos forms.

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './input'
import { cn } from '@/lib/utils'

type Props = Omit<React.ComponentProps<'input'>, 'type'>

export const PasswordInput = React.forwardRef<HTMLInputElement, Props>(
  function PasswordInput({ className, ...props }, ref) {
    const [show, setShow] = React.useState(false)

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={show ? 'text' : 'password'}
          // pr-10 garante espaço para o botão do olho sem cortar o caret
          className={cn('pr-10', className)}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          // tabIndex={-1}: não interrompe o fluxo de Tab entre campos do form
          tabIndex={-1}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  },
)
