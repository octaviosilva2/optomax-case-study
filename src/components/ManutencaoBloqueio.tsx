import { Wrench } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'

// Tela full-screen exibida quando o modo manutenção está ligado e o usuário
// NÃO tem bypass (ver lib/maintenance.ts). Sem app shell, sem links de volta
// pro app — o objetivo é "loja fechada". Server component puro (sem interação).
export function ManutencaoBloqueio({ mensagem }: { mensagem: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-6">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-status-warning-bg text-status-warning flex items-center justify-center mx-auto mb-5 border border-status-warning/30">
          <Wrench className="h-6 w-6" />
        </div>
        <Wordmark size="lg" className="mb-3 justify-center" />
        <h1 className="text-[16px] font-semibold tracking-tight mb-2">
          Em manutenção
        </h1>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          {mensagem}
        </p>
      </div>
    </div>
  )
}
