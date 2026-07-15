import Link from 'next/link'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/brand/Wordmark'

// Tela de erro do fluxo /atualizar-senha — usada quando o `code` do email
// está ausente, expirou ou já foi consumido.
export default function TelaErroAtualizarSenha({ mensagem }: { mensagem: string }) {
  return (
    <div className="w-full max-w-md">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Header — Wordmark display + tagline editorial (idêntico ao login) */}
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="flex flex-col items-center justify-center gap-3 mb-3">
            <Wordmark size="display" />
          </div>
          <p className="text-sm text-muted-foreground">
            Sistema de Gestão para Optometristas
          </p>
        </div>

        <div className="px-8 pb-8">
          {/* Título da ação + ícone de alerta */}
          <div className="text-center mb-5">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <h1 className="text-section-title">
              Link inválido ou expirado
            </h1>
            <p className="text-meta mt-1.5 leading-relaxed">
              {mensagem}
            </p>
          </div>

          <Link href="/recuperar-senha">
            <Button className="w-full shadow-md">
              Solicitar nova redefinição
            </Button>
          </Link>

          <div className="text-center mt-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline underline-offset-2 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
