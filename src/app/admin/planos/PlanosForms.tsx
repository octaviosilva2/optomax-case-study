'use client'

// Formulários da config de planos (Fase 5C). Dois cards: teste grátis (dias) e
// plano pago (nome, preço, ativo). Cada um chama uma server action e dá refresh.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PlanosConfig } from '@/lib/admin/planos'
import { atualizarPlano, atualizarTrialDias } from './actions'

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-serif text-xl tracking-tight mb-4">{titulo}</h2>
      {children}
    </section>
  )
}

// Centavos → string em reais para o input ("5997" → "59,97").
function centsParaReais(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function PlanosForms({ config }: { config: PlanosConfig }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [trialDias, setTrialDias] = useState(String(config.trialDays))
  const [nome, setNome] = useState(config.plano?.name ?? '')
  const [preco, setPreco] = useState(config.plano ? centsParaReais(config.plano.amountCents) : '')
  const [ativo, setAtivo] = useState(config.plano?.isActive ?? true)

  function run(fn: () => Promise<{ error: string | null }>, sucesso: string) {
    startTransition(async () => {
      const res = await fn()
      if (res.error) toast.error(res.error)
      else {
        toast.success(sucesso)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Teste grátis ─────────────────────────────────────────────── */}
      <Card titulo="Teste grátis">
        {!config.settingsDisponivel && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning-bg px-3 py-2.5 text-[12px] text-status-warning">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              A configuração de dias ainda não está ativa no banco. Aplique a migration
              <code className="mx-1">app_settings_trial</code>para poder salvar.
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="trial-dias">Duração do trial no cadastro (dias)</Label>
            <Input
              id="trial-dias"
              type="number"
              min={1}
              max={365}
              value={trialDias}
              onChange={(e) => setTrialDias(e.target.value)}
              className="w-40"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending || !config.settingsDisponivel}
            onClick={() => run(() => atualizarTrialDias(parseInt(trialDias, 10)), 'Teste grátis atualizado')}
          >
            Salvar
          </Button>
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
          Vale para <strong className="text-foreground">novos cadastros</strong>. Não altera o trial de
          quem já se cadastrou (ajuste individual fica na gestão da clínica).
        </p>
      </Card>

      {/* ── Plano pago ───────────────────────────────────────────────── */}
      <Card titulo="Plano pago">
        {config.plano ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="plano-nome">Nome</Label>
                <Input id="plano-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plano-preco">Preço mensal (R$)</Label>
                <Input
                  id="plano-preco"
                  inputMode="decimal"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  placeholder="59,97"
                />
              </div>
            </div>
            <label className="mt-4 flex items-center gap-2 text-[13px] font-medium cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="h-4 w-4"
              />
              Plano ativo (visível no checkout)
            </label>
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending || !nome.trim() || !preco.trim()}
                onClick={() =>
                  run(
                    () =>
                      atualizarPlano({
                        id: config.plano!.id,
                        name: nome,
                        amountReais: preco,
                        isActive: ativo,
                      }),
                    'Plano atualizado',
                  )
                }
              >
                Salvar plano
              </Button>
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
              Slug <code>{config.plano.slug}</code> (identificador do checkout — não editável aqui).
              Mudar o preço afeta novas cobranças; assinaturas já criadas no ASAAS seguem o valor antigo
              até serem recriadas.
            </p>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nenhum plano cadastrado na tabela.</p>
        )}
      </Card>
    </div>
  )
}
