'use client'

// Cliente do checkout (Fatia B + Fase 4 — ASAAS). Rota /assinar.
//
// Layout largo (2 colunas): Resumo do pedido + Forma de pagamento. Dois métodos:
//   - Pix (padrão): "Assinar com Pix" → QR + copia-e-cola → polling do
//     plan_status até o webhook confirmar → redireciona.
//   - Cartão (atrás do flag PAYMENTS_CREDIT_CARD_ENABLED): form react-hook-form
//     + zod (enxuto) → assinatura CREDIT_CARD (o ASAAS guarda o cartão e renova
//     sozinho) → "processando" → mesmo polling. Recusa volta síncrona (mostra o
//     motivo real do ASAAS). Endereço de cobrança preenchido pelo CEP (ViaCEP).
//
// E-mail e telefone do titular NÃO são pedidos na tela — o servidor os anexa
// (sessão/cadastro). A ativação NUNCA acontece aqui — quem ativa é o webhook.
// Os dados do cartão não são persistidos: vão direto para a Server Action.

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Copy, Loader2, CircleCheck, QrCode, CreditCard, TriangleAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatarCpfCnpj, validarCpfCnpj } from '@/lib/utils/cpf-cnpj'
import { cartaoSchema } from '@/lib/validations/checkout'
import {
  iniciarCheckout,
  iniciarCheckoutCartao,
  checarStatusPlano,
} from '@/app/(app)/assinatura/actions'

type Plano = {
  id: string
  name: string
  amount_cents: number
  cycle: string
}

type PixData = { encodedImage: string; payload: string; expirationDate: string }
type Metodo = 'pix' | 'cartao'
type EtapaPix = 'idle' | 'loading' | 'pix' | 'error'
type EtapaCartao = 'idle' | 'enviando' | 'processando' | 'error'

type CartaoForm = z.input<typeof cartaoSchema>

// Polling a cada 4s. No cartão, encerra "processando" após ~88s sem confirmação
// (em prod o webhook chega em segundos; o limite evita girar para sempre se o
// webhook atrasar ou — em dev — não alcançar o localhost). No Pix não há limite.
const POLL_INTERVALO_MS = 4000
const CARTAO_MAX_TICKS = 22

function formatarBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function rotuloCiclo(cycle: string): string {
  return cycle === 'QUARTERLY' ? 'Trimestral' : 'Mensal'
}

// ── Máscaras visuais (só formatação; a validação real é no zod) ──
function mascaraCartao(v: string): string {
  return v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
}
function mascaraCep(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
}

export function CheckoutClient({
  plano,
  cartaoAtivo = false,
  cpfInicial = '',
}: {
  plano: Plano
  cartaoAtivo?: boolean
  cpfInicial?: string
}) {
  const router = useRouter()
  const [metodo, setMetodo] = useState<Metodo>('pix')

  // Estado do fluxo Pix.
  const [etapaPix, setEtapaPix] = useState<EtapaPix>('idle')
  const [pix, setPix] = useState<PixData | null>(null)
  const [erroPix, setErroPix] = useState<string | null>(null)
  const [cpfCnpj, setCpfCnpj] = useState(cpfInicial ? formatarCpfCnpj(cpfInicial) : '')
  const [erroCpf, setErroCpf] = useState<string | null>(null)

  // Estado do fluxo Cartão.
  const [etapaCartao, setEtapaCartao] = useState<EtapaCartao>('idle')
  const [erroCartao, setErroCartao] = useState<string | null>(null)

  // Status da validação do CEP (ViaCEP) — só feedback "CEP não encontrado"
  // antes de enviar; o endereço não é exibido (o ASAAS resolve pelo CEP).
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'ok' | 'erro'>('idle')

  // Confirmação final (webhook → polling) e timeout do "processando" do cartão.
  const [pago, setPago] = useState(false)
  const [demorou, setDemorou] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CartaoForm>({
    resolver: zodResolver(cartaoSchema),
    defaultValues: {
      number: '',
      holderName: '',
      expiryMonth: '',
      expiryYear: '',
      ccv: '',
      holderInfoName: '',
      cpfCnpj: cpfInicial ? formatarCpfCnpj(cpfInicial) : '',
      postalCode: '',
    },
  })

  // Valida o CEP no ViaCEP quando completa 8 dígitos (só feedback de erro).
  async function buscarCep(cepDigits: string) {
    setCepStatus('loading')
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`)
      const data = await res.json()
      setCepStatus(data?.erro ? 'erro' : 'ok')
    } catch {
      // Falha de rede no ViaCEP não bloqueia: o ASAAS ainda valida o CEP.
      setCepStatus('idle')
    }
  }

  async function handleAssinarPix() {
    if (!validarCpfCnpj(cpfCnpj)) {
      setErroCpf('Informe um CPF ou CNPJ válido.')
      return
    }
    setEtapaPix('loading')
    setErroPix(null)
    try {
      const r = await iniciarCheckout({ planId: plano.id, cpfCnpj })
      if (r.ok) {
        setPix(r.pix)
        setEtapaPix('pix')
      } else {
        setErroPix(r.error)
        setEtapaPix('error')
      }
    } catch {
      setErroPix('Não foi possível iniciar o pagamento. Tente novamente.')
      setEtapaPix('error')
    }
  }

  const onSubmitCartao = handleSubmit(async (data) => {
    setEtapaCartao('enviando')
    setErroCartao(null)
    setDemorou(false)
    try {
      const r = await iniciarCheckoutCartao({ planId: plano.id, ...data })
      if (r.ok) {
        setEtapaCartao('processando')
      } else {
        setErroCartao(r.error)
        setEtapaCartao('error')
      }
    } catch {
      setErroCartao('Não foi possível processar o cartão. Tente novamente.')
      setEtapaCartao('error')
    }
  })

  // Polling do entitlement enquanto há cobrança pendente. Para ao confirmar
  // (webhook → plan_status='active'). No cartão, encerra após CARTAO_MAX_TICKS.
  const modoEspera: 'pix' | 'cartao' | null =
    etapaPix === 'pix' ? 'pix' : etapaCartao === 'processando' ? 'cartao' : null
  useEffect(() => {
    if (!modoEspera) return
    let cancelado = false
    let ticks = 0
    const id = setInterval(async () => {
      ticks++
      try {
        const { planStatus } = await checarStatusPlano()
        if (!cancelado && planStatus === 'active') {
          clearInterval(id)
          setPago(true)
          setTimeout(() => router.push('/dashboard'), 1600)
          return
        }
      } catch {
        // Falha de poll é silenciosa — tenta de novo no próximo tick.
      }
      if (!cancelado && modoEspera === 'cartao' && ticks >= CARTAO_MAX_TICKS) {
        clearInterval(id)
        setDemorou(true)
      }
    }, POLL_INTERVALO_MS)
    return () => {
      cancelado = true
      clearInterval(id)
    }
  }, [modoEspera, router])

  async function copiarPix() {
    if (!pix) return
    try {
      await navigator.clipboard.writeText(pix.payload)
      toast.success('Código Pix copiado!')
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.')
    }
  }

  // ── Tela de sucesso (após o webhook confirmar) ──
  if (pago) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-md">
        <CircleCheck className="mx-auto size-12 text-status-ok" />
        <p className="mt-3 text-lg font-semibold">Pagamento confirmado!</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Redirecionando para o painel…</p>
      </div>
    )
  }

  const tabBase =
    'flex items-center gap-2.5 rounded-lg border p-3 text-left text-[13.5px] font-semibold transition'

  return (
    <div className="grid items-start gap-6 md:grid-cols-[0.95fr_1.25fr]">
      {/* ───────────────── Resumo do pedido ───────────────── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-md">
        <h2 className="mb-4 font-serif text-lg">Resumo do pedido</h2>
        <div className="flex items-baseline justify-between py-2 text-[13.5px]">
          <span>
            <span className="block font-semibold">Plano {plano.name}</span>
            <span className="text-[12px] text-muted-foreground">Gestão completa da clínica</span>
          </span>
          <span>{formatarBRL(plano.amount_cents)}</span>
        </div>
        <div className="flex justify-between py-2 text-[13.5px]">
          <span className="text-muted-foreground">Ciclo</span>
          <span>{rotuloCiclo(plano.cycle)}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-border pt-3">
          <span className="font-semibold">Total hoje</span>
          <span className="text-2xl font-bold tracking-tight">{formatarBRL(plano.amount_cents)}</span>
        </div>
        <div className="mt-4 flex gap-2 rounded-lg bg-primary/8 px-3 py-2.5 text-[12px] text-primary">
          <span aria-hidden>↻</span>
          <span>Renova automaticamente a cada ciclo. Cancele quando quiser.</span>
        </div>
        <div className="mt-4 space-y-2.5 text-[11.5px] text-muted-foreground">
          <p className="flex items-center gap-2">
            <ShieldCheck className="size-3.5" />
            Pagamento criptografado. Não armazenamos o número do cartão.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span>Aceitamos</span>
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold text-status-ok">
              PIX
            </span>
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold">
              VISA
            </span>
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold">
              MASTER
            </span>
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold">
              ELO
            </span>
          </div>
        </div>
      </div>

      {/* ───────────────── Forma de pagamento ───────────────── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-md">
        <h2 className="mb-4 font-serif text-lg">Forma de pagamento</h2>

        {/* Seletor de método — só aparece quando o cartão está habilitado */}
        {cartaoAtivo ? (
          <div role="tablist" aria-label="Forma de pagamento" className="mb-5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              role="tab"
              aria-selected={metodo === 'pix'}
              onClick={() => setMetodo('pix')}
              className={cn(
                tabBase,
                metodo === 'pix'
                  ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/35'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
                <QrCode className="size-4" />
              </span>
              <span>
                Pix
                <span className="block text-[11px] font-normal text-muted-foreground">
                  Aprovação na hora
                </span>
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={metodo === 'cartao'}
              onClick={() => setMetodo('cartao')}
              className={cn(
                tabBase,
                metodo === 'cartao'
                  ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/35'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
                <CreditCard className="size-4" />
              </span>
              <span>
                Cartão de crédito
                <span className="block text-[11px] font-normal text-muted-foreground">
                  Renova automático
                </span>
              </span>
            </button>
          </div>
        ) : null}

        {/* ───────────────────────── Pix ───────────────────────── */}
        {metodo === 'pix' && (
          <>
            {etapaPix === 'idle' && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="cpfCnpj" className="mb-1.5 text-[12.5px]">
                    CPF ou CNPJ do titular
                  </Label>
                  <Input
                    id="cpfCnpj"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000.000.000-00"
                    value={cpfCnpj}
                    onChange={(e) => {
                      setCpfCnpj(formatarCpfCnpj(e.target.value))
                      if (erroCpf) setErroCpf(null)
                    }}
                    aria-invalid={!!erroCpf}
                  />
                  {erroCpf ? (
                    <p className="mt-1 text-[12px] text-destructive">{erroCpf}</p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Necessário para emitir a cobrança Pix.
                    </p>
                  )}
                </div>
                <Button className="w-full" onClick={handleAssinarPix}>
                  Assinar com Pix
                </Button>
              </div>
            )}

            {etapaPix === 'loading' && (
              <Button className="w-full" disabled>
                <Loader2 className="size-4 animate-spin" />
                Gerando Pix…
              </Button>
            )}

            {etapaPix === 'error' && (
              <div className="space-y-3">
                <p className="text-[13px] text-destructive">{erroPix}</p>
                <Button variant="outline" className="w-full" onClick={handleAssinarPix}>
                  Tentar novamente
                </Button>
              </div>
            )}

            {etapaPix === 'pix' && pix && (
              <div className="text-center">
                {/* QR em base64 (PNG sem prefixo) devolvido pelo ASAAS. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${pix.encodedImage}`}
                  alt="QR Code Pix para pagamento"
                  className="mx-auto size-44 rounded-md border border-border bg-white p-2"
                />
                <div className="mx-auto mt-3 flex max-w-sm gap-2">
                  <input
                    readOnly
                    value={pix.payload}
                    aria-label="Código Pix copia-e-cola"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-muted px-3 font-mono text-[10.5px] text-muted-foreground"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copiarPix}
                    aria-label="Copiar código Pix"
                  >
                    <Copy className="size-3.5" />
                    Copiar
                  </Button>
                </div>
                <p className="mt-3 inline-flex items-center gap-2 text-[12.5px] font-medium text-status-warning">
                  <span className="size-2 animate-pulse rounded-full bg-status-warning" />
                  Aguardando confirmação do Pix…
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  A conta é ativada automaticamente quando o pagamento for confirmado — você pode
                  fechar esta aba.
                </p>
              </div>
            )}
          </>
        )}

        {/* ──────────────────────── Cartão ──────────────────────── */}
        {metodo === 'cartao' && cartaoAtivo && (
          <>
            {etapaCartao === 'processando' && !demorou && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Loader2 className="size-7 animate-spin text-primary" />
                <p className="text-sm font-semibold">Processando pagamento…</p>
                <p className="text-[12px] text-muted-foreground">
                  Confirmando com a operadora. A conta é ativada automaticamente.
                </p>
              </div>
            )}

            {etapaCartao === 'processando' && demorou && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <CircleCheck className="size-8 text-status-ok" />
                <p className="text-sm font-semibold">Pagamento enviado!</p>
                <p className="text-[12px] text-muted-foreground">
                  A confirmação da operadora pode levar alguns instantes. Você pode fechar esta aba —
                  a conta é ativada automaticamente assim que for confirmada.
                </p>
                <Button variant="outline" className="mt-1" onClick={() => router.push('/dashboard')}>
                  Ir para o painel
                </Button>
              </div>
            )}

            {etapaCartao !== 'processando' && (
              <form onSubmit={onSubmitCartao} className="space-y-4" noValidate>
                {etapaCartao === 'error' && erroCartao && (
                  <p className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    <span>{erroCartao}</span>
                  </p>
                )}

                {/* ── Dados do titular ── */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="h-name" className="mb-1 text-[12px]">
                      Nome completo
                    </Label>
                    <Input
                      id="h-name"
                      autoComplete="name"
                      aria-invalid={!!errors.holderInfoName}
                      {...register('holderInfoName')}
                    />
                    {errors.holderInfoName && (
                      <p className="mt-1 text-[11.5px] text-destructive">
                        {errors.holderInfoName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="h-cpf" className="mb-1 text-[12px]">
                      CPF/CNPJ
                    </Label>
                    <Input
                      id="h-cpf"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      aria-invalid={!!errors.cpfCnpj}
                      {...register('cpfCnpj', {
                        onChange: (e) => setValue('cpfCnpj', formatarCpfCnpj(e.target.value)),
                      })}
                    />
                    {errors.cpfCnpj && (
                      <p className="mt-1 text-[11.5px] text-destructive">{errors.cpfCnpj.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="h-cep" className="mb-1 text-[12px]">
                      CEP
                    </Label>
                    <Input
                      id="h-cep"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="00000-000"
                      aria-invalid={!!errors.postalCode || cepStatus === 'erro'}
                      {...register('postalCode', {
                        onChange: (e) => {
                          const masked = mascaraCep(e.target.value)
                          setValue('postalCode', masked)
                          const digits = masked.replace(/\D/g, '')
                          if (digits.length === 8) buscarCep(digits)
                          else setCepStatus('idle')
                        },
                      })}
                    />
                    {cepStatus === 'loading' && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> Verificando CEP…
                      </p>
                    )}
                    {cepStatus === 'erro' && (
                      <p className="mt-1 text-[11.5px] text-destructive">
                        CEP não encontrado. Confira os números.
                      </p>
                    )}
                    {errors.postalCode && cepStatus !== 'erro' && (
                      <p className="mt-1 text-[11.5px] text-destructive">
                        {errors.postalCode.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Por que pedimos esses dados */}
                <p className="rounded-md bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                  Pedimos esses dados porque a operadora do cartão os exige para validar a transação e
                  prevenir fraude.
                </p>

                {/* ── Dados do cartão ── */}
                <div className="space-y-3 border-t border-border pt-4">
                  <div>
                    <Label htmlFor="cc-number" className="mb-1 text-[12px]">
                      Número do cartão
                    </Label>
                    <Input
                      id="cc-number"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="0000 0000 0000 0000"
                      aria-invalid={!!errors.number}
                      {...register('number', {
                        onChange: (e) => setValue('number', mascaraCartao(e.target.value)),
                      })}
                    />
                    {errors.number && (
                      <p className="mt-1 text-[11.5px] text-destructive">{errors.number.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="cc-month" className="mb-1 text-[12px]">
                        Mês
                      </Label>
                      <Input
                        id="cc-month"
                        inputMode="numeric"
                        autoComplete="cc-exp-month"
                        placeholder="MM"
                        maxLength={2}
                        aria-invalid={!!errors.expiryMonth}
                        {...register('expiryMonth')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cc-year" className="mb-1 text-[12px]">
                        Ano
                      </Label>
                      <Input
                        id="cc-year"
                        inputMode="numeric"
                        autoComplete="cc-exp-year"
                        placeholder="AAAA"
                        maxLength={4}
                        aria-invalid={!!errors.expiryYear}
                        {...register('expiryYear')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cc-ccv" className="mb-1 text-[12px]">
                        CVV
                      </Label>
                      <Input
                        id="cc-ccv"
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        placeholder="123"
                        maxLength={4}
                        aria-invalid={!!errors.ccv}
                        {...register('ccv')}
                      />
                    </div>
                  </div>
                  {(errors.expiryMonth || errors.expiryYear || errors.ccv) && (
                    <p className="text-[11.5px] text-destructive">
                      {errors.expiryMonth?.message ||
                        errors.expiryYear?.message ||
                        errors.ccv?.message}
                    </p>
                  )}

                  <div>
                    <Label htmlFor="cc-holder" className="mb-1 text-[12px]">
                      Nome impresso no cartão
                    </Label>
                    <Input
                      id="cc-holder"
                      autoComplete="cc-name"
                      placeholder="Como está no cartão"
                      aria-invalid={!!errors.holderName}
                      {...register('holderName')}
                    />
                    {errors.holderName && (
                      <p className="mt-1 text-[11.5px] text-destructive">
                        {errors.holderName.message}
                      </p>
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={etapaCartao === 'enviando'}>
                  {etapaCartao === 'enviando' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Processando…
                    </>
                  ) : (
                    `Assinar e pagar ${formatarBRL(plano.amount_cents)}`
                  )}
                </Button>

                <p className="flex gap-2 rounded-md bg-status-ok/10 px-3 py-2 text-[11px] text-status-ok">
                  <span aria-hidden>↻</span>
                  <span>
                    Cobrança recorrente: o cartão fica salvo no ASAAS e renova sozinho a cada ciclo.
                    Cancele quando quiser.
                  </span>
                </p>
                <p className="text-center text-[10.5px] text-muted-foreground">
                  🔒 Conexão segura. Não armazenamos o número do cartão — ele é processado pelo ASAAS.
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
