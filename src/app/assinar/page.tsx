// Checkout focado (Fatia B — BLOCO 1 ASAAS). Rota /assinar.
//
// FORA do grupo (app) de propósito: o layout de (app) bloqueia
// !orgPodeAcessar(plan_status), mas o titular em trial/expirado PRECISA poder
// assinar (spec §4). Aqui exigimos só sessão válida (login) — sem o gate de
// acesso. O middleware já redireciona deslogado para /login.
//
// Tela de pagamento sem o app shell (sidebar) — mesmo link serve para fechar
// venda no WhatsApp. A ativação vem do webhook, nunca do redirect.

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireSession, getSessionData } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { cartaoHabilitado } from '@/lib/payments'
import { Wordmark } from '@/components/brand/Wordmark'
import { CheckoutClient } from './CheckoutClient'

export const metadata: Metadata = { title: 'Assinar — OptoMax' }

export default async function AssinarPage() {
  // Exige login (org na sessão). Redireciona para /login se não houver sessão.
  // NÃO aplica o gate de plan_status — trial/expirado pode pagar.
  await requireSession()

  const supabase = await createClient()
  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, amount_cents, cycle, billing_type, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Plano base (mesmo plano serve para Pix e cartão — a forma é escolha da UI).
  const plano = (plans ?? []).find((p) => p.billing_type === 'PIX') ?? plans?.[0] ?? null

  // Pré-preenche o CPF do form de cartão com o que já temos (CPF da org).
  // E-mail/telefone não vão para a tela — são anexados no servidor.
  const cartaoAtivo = cartaoHabilitado()
  const session = await getSessionData()
  let cpfInicial = ''
  if (cartaoAtivo && session?.org) {
    const { data: org } = await supabase
      .from('organizations')
      .select('cpf_cnpj')
      .eq('id', session.org.id)
      .single()
    cpfInicial = org?.cpf_cnpj ?? ''
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-4xl">
        {/* Cabeçalho do checkout */}
        <div className="mb-8 text-center">
          <Wordmark size="lg" />
          <h1 className="mt-4 font-serif text-2xl sm:text-[28px]">Finalize sua assinatura</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Pagamento seguro · cancele quando quiser
          </p>
        </div>

        {plano ? (
          <CheckoutClient
            plano={{
              id: plano.id,
              name: plano.name,
              amount_cents: plano.amount_cents,
              cycle: plano.cycle,
            }}
            cartaoAtivo={cartaoAtivo}
            cpfInicial={cpfInicial}
          />
        ) : (
          <div className="mx-auto max-w-lg rounded-xl border border-dashed border-border p-7 text-center text-sm text-muted-foreground">
            <strong className="text-foreground">Nenhum plano disponível para assinatura.</strong>
            <br />
            Tente novamente em instantes ou{' '}
            <Link href="/dashboard" className="text-primary hover:underline">
              volte ao painel
            </Link>
            .
          </div>
        )}
      </div>
    </main>
  )
}
