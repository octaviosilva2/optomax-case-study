// Landing pública na RAIZ optomax.com.br (Fase 3 ASAAS).
//
// Antes a raiz só redirecionava para /dashboard (e o deslogado caía no /login).
// Agora ela é a página de venda: hero + benefícios + seção de planos (lida da
// tabela `plans`, com SELECT público dos ativos via RLS) + FAQ. Quem está logado
// é mandado para o /dashboard; o visitante vê a oferta.
//
// Auth fica no app.* (host de auth): os CTAs apontam para `${getAppUrl()}/cadastro`
// e `/login`. Assim a sessão nasce e vive no app.* — não cruza domínio (cookie
// host-only do Supabase fica intacto). Server component: lê o catálogo no
// servidor (sem expor chave) e é resiliente — se `plans` não existir ou não
// houver plano ativo, mostra o estado "em breve" em vez de quebrar.

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Calendar, FileText, ShieldCheck, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import { Wordmark } from '@/components/brand/Wordmark'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'OptoMax — Gestão clínica para optometria',
  description:
    'Agenda, prontuário, receitas em PDF e evolução do grau — feito para optometristas. Comece com 7 dias grátis, sem cartão.',
}

// Plano vendável (subconjunto lido da tabela `plans`).
type PlanoVendavel = {
  id: string
  name: string
  description: string | null
  features: string[]
  amount_cents: number
  cycle: string
}

// Centavos (inteiro) → moeda BRL formatada.
function formatarBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

// Rótulo curto do ciclo de cobrança (vocabulário ASAAS → PT).
function rotuloCiclo(cycle: string): string {
  return cycle === 'QUARTERLY' ? '/trimestre' : '/mês'
}

// Normaliza o jsonb `features` (array de strings) com tolerância a dado sujo.
function lerFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((f): f is string => typeof f === 'string')
}

// Benefícios fixos (copy de venda — não dependem do catálogo).
const BENEFICIOS = [
  {
    icon: Calendar,
    titulo: 'Agenda inteligente',
    descricao: 'Marque, remarque e acompanhe os atendimentos do dia.',
  },
  {
    icon: FileText,
    titulo: 'Receitas em PDF',
    descricao: 'Prescrições prontas e a evolução do grau do paciente.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Seguro e LGPD',
    descricao: 'Dados isolados por clínica, com backup e exportação.',
  },
]

// FAQ leve (provisório — sem institucional completo).
const FAQ = [
  {
    q: 'Preciso de cartão para testar?',
    a: 'Não. O teste de 7 dias é liberado só com o cadastro; o pagamento só entra se você decidir assinar.',
  },
  {
    q: 'Como eu pago?',
    a: 'Por Pix, no checkout. A conta é liberada automaticamente assim que o pagamento é confirmado.',
  },
  {
    q: 'Posso cancelar?',
    a: 'Sim, quando quiser. Seus dados continuam guardados caso você volte.',
  },
]

export default async function HomePage() {
  const supabase = await createClient()

  // Logado vai direto pro app (o middleware também cobre, mas blindamos aqui).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  // `plans` tem policy de SELECT público para is_active=true — funciona sem sessão.
  const { data, error } = await supabase
    .from('plans')
    .select('id, name, description, features, amount_cents, cycle, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Erro (ex.: tabela ainda não existe) é tratado como "sem planos" — a landing
  // nunca mostra stack/erro ao visitante.
  const planos: PlanoVendavel[] =
    error || !data
      ? []
      : data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          features: lerFeatures(p.features),
          amount_cents: p.amount_cents,
          cycle: p.cycle,
        }))

  // Destaque o primeiro plano (no MVP é o único — "plano único").
  const principal = planos[0] ?? null

  // URLs de auth no host do app (app.*). Navegação simples — sem handoff de cookie.
  const appUrl = getAppUrl()
  const cadastroUrl = `${appUrl}/cadastro`
  const loginUrl = `${appUrl}/login`

  return (
    <main className="min-h-screen bg-background">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Wordmark size="md" />
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="#planos" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
              Planos
            </a>
            <a href={loginUrl} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
              Entrar
            </a>
            <a href={cadastroUrl} className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}>
              Teste grátis
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-3xl px-4 pt-16 pb-12 text-center">
        <span className="inline-block rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          7 dias grátis · sem cartão
        </span>
        <h1 className="mt-4 font-serif text-4xl leading-[1.07] tracking-tight sm:text-5xl">
          Sua clínica de optometria,
          <br />
          organizada de ponta a ponta.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground sm:text-base">
          Agenda, prontuário, receitas em PDF e evolução do grau — tudo num só lugar, feito para optometristas.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href={cadastroUrl} className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'shadow-md')}>
            Começar teste grátis
          </a>
          <a href="#planos" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
            Ver planos
          </a>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Comece grátis hoje · cobramos só quando você decidir assinar.
        </p>
      </section>

      {/* ── Benefícios ── */}
      <section className="border-t border-border bg-muted/30 py-14">
        <div className="mx-auto max-w-5xl px-4">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tudo que sua clínica precisa
          </p>
          <h2 className="mt-1 text-center font-serif text-3xl tracking-tight">Feito para optometria</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {BENEFICIOS.map(({ icon: Icon, titulo, descricao }) => (
              <div key={titulo} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold">{titulo}</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">{descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Planos ── */}
      <section id="planos" className="scroll-mt-16 border-t border-border py-14">
        <div className="mx-auto max-w-5xl px-4">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plano</p>
          <h2 className="mt-1 text-center font-serif text-3xl tracking-tight">Um preço, tudo incluído</h2>

          <div className="mt-8">
            {principal ? (
              <PlanoCard plano={principal} cadastroUrl={cadastroUrl} />
            ) : (
              // Estado "em breve": sem plano ativo (ou catálogo indisponível).
              <div className="mx-auto max-w-sm rounded-xl border border-dashed border-border p-7 text-center text-sm text-muted-foreground">
                <strong className="text-foreground">Planos chegando em breve.</strong>
                <br />
                Enquanto isso, crie sua conta e teste grátis por 7 dias.
                <div className="mt-5">
                  <a href={cadastroUrl} className={cn(buttonVariants({ variant: 'default' }), 'w-full')}>
                    Começar teste grátis de 7 dias
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-status-ok" /> Sem cartão para testar
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-status-ok" /> Cancele quando quiser
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-status-ok" /> Pagamento via Pix
            </span>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-border bg-muted/30 py-14">
        <div className="mx-auto max-w-xl px-4">
          <h2 className="text-center font-serif text-3xl tracking-tight">Perguntas frequentes</h2>
          <div className="mt-6">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="border-t border-border py-4 last:border-b">
                <p className="text-sm font-semibold">{q}</p>
                <p className="mt-1.5 text-[13px] text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="border-t border-border py-14 text-center">
        <h2 className="font-serif text-3xl tracking-tight">Comece hoje, sem cartão.</h2>
        <div className="mt-5">
          <a href={cadastroUrl} className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'shadow-md')}>
            Começar teste grátis de 7 dias
          </a>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Já tem conta?{' '}
          <a href={loginUrl} className="text-primary font-medium hover:underline underline-offset-2">
            Entrar
          </a>
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} OptoMax</span>
          <a href={loginUrl} className="hover:text-foreground">
            Entrar
          </a>
        </div>
      </footer>
    </main>
  )
}

// Card do plano em destaque — espelha o mockup (borda primary, preço grande,
// features com check, CTA para o teste grátis no app.*).
function PlanoCard({ plano, cadastroUrl }: { plano: PlanoVendavel; cadastroUrl: string }) {
  return (
    <div className="relative mx-auto max-w-sm rounded-xl border border-primary bg-card p-6 text-left shadow-lg ring-1 ring-primary">
      <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
        Plano único
      </span>

      <p className="text-sm font-semibold">{plano.name}</p>

      <p className="mt-2 text-[34px] font-bold leading-none tracking-tight">
        {formatarBRL(plano.amount_cents)}
        <span className="text-sm font-medium text-muted-foreground"> {rotuloCiclo(plano.cycle)}</span>
      </p>

      {plano.description && <p className="mt-2 text-xs text-muted-foreground">{plano.description}</p>}

      {plano.features.length > 0 && (
        <ul className="my-4 space-y-1.5 text-[13px]">
          {plano.features.map((feat, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-status-ok" />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      )}

      <a href={cadastroUrl} className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'mt-2 w-full shadow-md')}>
        Começar teste grátis de 7 dias
      </a>
    </div>
  )
}
