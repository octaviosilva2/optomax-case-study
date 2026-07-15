'use client'

// Formulários da tab Gestão. Cada card chama uma server action de ./actions.ts
// (ou toggleOrgStatus do admin) e dá router.refresh() pra refletir o novo estado
// vindo do server. Feedback via toast.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Power, PowerOff, Clock, KeyRound, Copy, Check, Gift, Infinity as InfinityIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toggleOrgStatus } from '@/app/admin/actions'
import {
  orgPodeAcessar,
  diasRestantesTrial,
  planoEhIlimitado,
  PLANS,
  PLAN_LABELS,
  type Plan,
} from '@/lib/utils/status'
import { formatarDataCurta } from '@/lib/utils/data'
import {
  definirTrial,
  estenderTrial,
  encerrarTrial,
  definirPlano,
  concederCortesia,
  removerCortesia,
  atualizarDadosOrg,
  gerarLinkRecuperacao,
} from './actions'

type Props = {
  orgId: string
  nomeClinica: string
  telefone: string
  endereco: string
  plan: string
  planStatus: string
  trialEndsAt: string | null
  emailTitular: string | null
}

// Converte um ISO em valor pro <input type="date"> (YYYY-MM-DD em horário BR).
function isoParaInputDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

// Card padrão da tela.
function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-serif text-xl tracking-tight mb-4">{titulo}</h2>
      {children}
    </section>
  )
}

export function GestaoForms(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const ehAdmin = planoEhIlimitado(props.plan)
  const temAcesso = orgPodeAcessar(props.planStatus)
  const dias = diasRestantesTrial(props.trialEndsAt, props.plan)

  // Estados locais dos forms.
  const [plano, setPlano] = useState<string>(props.plan)
  const [dataInput, setDataInput] = useState(isoParaInputDate(props.trialEndsAt))
  const [cortesiaData, setCortesiaData] = useState('')
  const [nome, setNome] = useState(props.nomeClinica)
  const [telefone, setTelefone] = useState(props.telefone)
  const [endereco, setEndereco] = useState(props.endereco)
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  // Wrapper genérico: roda a action, mostra toast e dá refresh.
  function run(
    fn: () => Promise<{ error: string | null }>,
    sucesso: string,
  ) {
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
    <div className="space-y-6">
      {/* ── Acesso & Trial ───────────────────────────────────────────── */}
      <Card titulo="Acesso & Trial">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border ${
              temAcesso
                ? 'bg-status-ok-bg text-status-ok border-status-ok/30'
                : 'bg-secondary text-muted-foreground border-border'
            }`}
          >
            {temAcesso ? 'Com acesso' : 'Sem acesso'}
          </span>
          <button
            onClick={() =>
              run(
                () => toggleOrgStatus(props.orgId, temAcesso ? 'inactive' : 'active'),
                temAcesso ? 'Acesso desativado' : 'Acesso reativado',
              )
            }
            disabled={isPending}
            className={`h-8 px-3 rounded-md border text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50 ${
              temAcesso
                ? 'border-destructive/30 text-destructive hover:bg-destructive-bg'
                : 'border-status-ok/30 text-status-ok hover:bg-status-ok-bg'
            }`}
          >
            {temAcesso ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            {temAcesso ? 'Desativar acesso' : 'Reativar acesso'}
          </button>
        </div>

        {ehAdmin ? (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground rounded-lg bg-muted/40 px-3 py-2.5">
            <InfinityIcon className="h-4 w-4 shrink-0" />
            Plano <strong className="text-foreground">Admin</strong> — acesso ilimitado, sem prazo de
            trial.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[13px] mb-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Trial termina em:</span>
              <span className="font-medium">{formatarDataCurta(props.trialEndsAt)}</span>
              {dias !== null && (
                <span
                  className={`text-[11px] font-medium ${
                    dias <= 0
                      ? 'text-destructive'
                      : dias <= 3
                        ? 'text-status-warning'
                        : 'text-muted-foreground'
                  }`}
                >
                  ({dias <= 0 ? 'expirado' : `faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}`})
                </span>
              )}
            </div>

            {/* Atalhos */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {[7, 15, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => run(() => estenderTrial(props.orgId, d), `Trial estendido +${d} dias`)}
                  disabled={isPending}
                  className="h-8 px-3 rounded-md border border-border bg-card text-[13px] font-medium hover:bg-muted disabled:opacity-50"
                >
                  +{d} dias
                </button>
              ))}
              <button
                onClick={() => run(() => encerrarTrial(props.orgId), 'Trial encerrado')}
                disabled={isPending}
                className="h-8 px-3 rounded-md border border-destructive/30 text-destructive text-[13px] font-medium hover:bg-destructive-bg disabled:opacity-50"
              >
                Encerrar agora
              </button>
            </div>

            {/* Data exata */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="trial-date">Definir data exata</Label>
                <input
                  id="trial-date"
                  type="date"
                  value={dataInput}
                  onChange={(e) => setDataInput(e.target.value)}
                  className="h-9 px-3 rounded-md border border-border bg-background text-sm"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending || !dataInput}
                onClick={() => run(() => definirTrial(props.orgId, dataInput), 'Data do trial salva')}
              >
                Salvar data
              </Button>
            </div>

            <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
              Editar o trial muda apenas o contador e o aviso de teste. Para bloquear o acesso de
              fato, use <strong className="text-foreground">Desativar acesso</strong>.
            </p>
          </>
        )}
      </Card>

      {/* ── Acesso cortesia ──────────────────────────────────────────── */}
      {!ehAdmin && (
        <Card titulo="Acesso cortesia (grátis)">
          <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
            Libera o uso <strong className="text-foreground">sem cobrar</strong> (plano free).
            <strong className="text-foreground"> Permanente</strong>: nunca expira.
            <strong className="text-foreground"> Por prazo</strong>: ao vencer, entra no paywall e
            passa a exigir pagamento.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                run(() => concederCortesia(props.orgId, 'permanente'), 'Cortesia permanente concedida')
              }
            >
              <Gift className="h-3.5 w-3.5" />
              Cortesia permanente
            </Button>

            <div className="space-y-1.5">
              <Label htmlFor="cortesia-date">Grátis até (por prazo)</Label>
              <div className="flex items-end gap-2">
                <input
                  id="cortesia-date"
                  type="date"
                  value={cortesiaData}
                  onChange={(e) => setCortesiaData(e.target.value)}
                  className="h-9 px-3 rounded-md border border-border bg-background text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending || !cortesiaData}
                  onClick={() =>
                    run(
                      () => concederCortesia(props.orgId, 'prazo', cortesiaData),
                      'Cortesia por prazo concedida',
                    )
                  }
                >
                  Conceder
                </Button>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              className="text-destructive hover:text-destructive"
              onClick={() => run(() => removerCortesia(props.orgId), 'Cortesia removida')}
            >
              Remover cortesia
            </Button>
          </div>
        </Card>
      )}

      {/* ── Plano ────────────────────────────────────────────────────── */}
      <Card titulo="Plano">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="plano">Plano da clínica</Label>
            <select
              id="plano"
              value={plano}
              onChange={(e) => setPlano(e.target.value)}
              className="h-9 px-3 rounded-md border border-border bg-background text-sm min-w-[200px]"
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {PLAN_LABELS[p as Plan]}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending || plano === props.plan}
            onClick={() => run(() => definirPlano(props.orgId, plano), 'Plano atualizado')}
          >
            Salvar plano
          </Button>
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Free</strong>: grátis (trial por prazo ou cortesia).{' '}
          <strong className="text-foreground">Pago</strong>: assinatura ativa.{' '}
          <strong className="text-foreground">Admin</strong>: interno, acesso ilimitado. Para liberar
          grátis sem cobrar, prefira o card <strong className="text-foreground">Acesso cortesia</strong>.
        </p>
      </Card>

      {/* ── Conta ────────────────────────────────────────────────────── */}
      <Card titulo="Conta do titular">
        <div className="space-y-1.5 mb-4">
          <Label>E-mail de acesso</Label>
          <Input value={props.emailTitular ?? '—'} disabled className="text-muted-foreground" />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || !props.emailTitular}
          onClick={() =>
            startTransition(async () => {
              const res = await gerarLinkRecuperacao(props.orgId)
              if (res.error) toast.error(res.error)
              else {
                setRecoveryLink(res.link ?? null)
                setCopiado(false)
                toast.success('Link de redefinição gerado')
              }
            })
          }
        >
          <KeyRound className="h-3.5 w-3.5" />
          Gerar link de redefinição de senha
        </Button>

        {recoveryLink && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
            <code className="flex-1 text-[11px] break-all text-muted-foreground">{recoveryLink}</code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(recoveryLink)
                setCopiado(true)
                toast.success('Link copiado')
              }}
              className="h-7 px-2 rounded border border-border bg-card text-[11px] font-medium hover:bg-muted inline-flex items-center gap-1 shrink-0"
            >
              {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        )}
        <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
          Gera um link de redefinição de senha para enviar ao titular (ex: WhatsApp). O link expira
          conforme a configuração do Supabase.
        </p>
      </Card>

      {/* ── Dados da clínica ─────────────────────────────────────────── */}
      <Card titulo="Dados da clínica">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="nome">Nome da clínica</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending || !nome.trim()}
            onClick={() =>
              run(
                () => atualizarDadosOrg(props.orgId, { nome_clinica: nome, telefone, endereco }),
                'Dados atualizados',
              )
            }
          >
            Salvar dados
          </Button>
        </div>
      </Card>
    </div>
  )
}
