-- ════════════════════════════════════════════════════════════════════════════
-- BLOCO 1 — Assinatura ASAAS · Fase EXPAND (aditiva, segura)
-- ────────────────────────────────────────────────────────────────────────────
-- Desenho aprovado no GATE 2 (03-spec.md §1.2). Decisão técnica do Octavio
-- (schema é dele; Caio NÃO entra em dev — ver memória `papel-do-caio`).
--
-- Esta fase é ADITIVA: cria as tabelas de billing, amplia CHECKs e ajusta o
-- default do trial. NÃO remove nada (o drop de stripe_customer_id é a fase
-- CONTRACT, separada, só depois do código novo no ar).
--
-- ⚠️  NÃO aplicar em produção sem confirmação do Octavio. Preferir validar
--     numa branch Supabase antes. Após aplicar, rodar `supabase gen types`
--     para regenerar src/types/database.ts e `get_advisors` (regra do projeto:
--     policies / SECURITY DEFINER podem vazar para anon).
--
-- Entitlement continua sendo lido de `organizations` (plan / plan_status /
-- trial_ends_at). As tabelas abaixo são escritas SÓ pelo webhook (service_role);
-- o app nunca consulta o ASAAS em runtime.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── plans: catálogo de planos vendáveis (lido publicamente em /planos) ────────
CREATE TABLE IF NOT EXISTS public.plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,                                    -- mapeia para organizations.plan (ex. 'base')
  name         text NOT NULL,                                           -- "OptoMax Essencial"
  description  text,
  features     jsonb NOT NULL DEFAULT '[]'::jsonb,                      -- bullets exibidos no card de /planos
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),             -- dinheiro em inteiro (centavos), evita float
  cycle        text NOT NULL CHECK (cycle IN ('MONTHLY', 'QUARTERLY')), -- vocabulário ASAAS
  billing_type text NOT NULL DEFAULT 'PIX' CHECK (billing_type IN ('PIX', 'CREDIT_CARD')),
  is_active    boolean NOT NULL DEFAULT true,                           -- /planos só lista ativos
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plans_active_idx ON public.plans (is_active, sort_order);

COMMENT ON TABLE public.plans IS 'Catálogo de planos vendáveis. Único billing table com SELECT público (is_active=true) para /planos sem login.';
COMMENT ON COLUMN public.plans.slug IS 'Mapeia para organizations.plan (precisa estar no CHECK organizations_plan_check).';
COMMENT ON COLUMN public.plans.amount_cents IS 'Valor em centavos (inteiro). Nunca usar float para dinheiro.';

-- ── subscriptions: assinatura ASAAS de uma org (1 ativa por org no MVP) ───────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id               uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  asaas_subscription_id text UNIQUE,                                    -- 'sub_...' (nullable até criar no ASAAS)
  status                text NOT NULL DEFAULT 'pending',                -- espelha estado ASAAS (informativo)
  billing_type          text NOT NULL CHECK (billing_type IN ('PIX', 'CREDIT_CARD')),
  amount_cents          integer NOT NULL CHECK (amount_cents >= 0),
  cycle                 text NOT NULL CHECK (cycle IN ('MONTHLY', 'QUARTERLY')),
  current_period_end    timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_org_idx ON public.subscriptions (org_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions (status);
-- Índice de cobertura da FK plan_id (apontado pelo get_advisors no branch de teste:
-- unindexed_foreign_keys). Mantém JOIN/DELETE em plans performático.
CREATE INDEX IF NOT EXISTS subscriptions_plan_id_idx ON public.subscriptions (plan_id);

COMMENT ON TABLE public.subscriptions IS 'Assinatura ASAAS de uma org. Escrita só pelo webhook/checkout (service_role). Estado informativo; entitlement vive em organizations.';

-- ── payments: cada cobrança ASAAS (Pix avulso ou parcela da assinatura) ───────
CREATE TABLE IF NOT EXISTS public.payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id  uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  asaas_payment_id text NOT NULL UNIQUE,                               -- 'pay_...'
  status           text NOT NULL,                                      -- status ASAAS cru (CONFIRMED/RECEIVED/OVERDUE/...)
  billing_type     text,
  amount_cents     integer NOT NULL CHECK (amount_cents >= 0),
  net_amount_cents integer,
  due_date         date,
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_subscription_idx ON public.payments (subscription_id);
CREATE INDEX IF NOT EXISTS payments_org_idx ON public.payments (org_id);

COMMENT ON TABLE public.payments IS 'Cada cobrança ASAAS. UPSERT por asaas_payment_id pelo webhook (service_role).';

-- ── webhook_events: idempotência + auditoria (PK = id do evento ASAAS) ────────
-- CONFIRMADO na doc ASAAS (2026-06-23): cada evento tem `id` PRÓPRIO e ESTÁVEL
-- entre reenvios ("remains the same if it is the same event"). A PK é esse
-- event.id direto — não é preciso compor {event}:{payment.id}. Ver spec §2.2.
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id               text PRIMARY KEY,                                   -- event.id do ASAAS (chave idempotente)
  event_type       text NOT NULL,                                      -- PAYMENT_CONFIRMED, ...
  asaas_payment_id text,
  payload          jsonb NOT NULL,                                     -- corpo cru recebido (parser tolerante)
  processed_at     timestamptz,                                        -- null = recebido, não processado ainda
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_events_payment_idx ON public.webhook_events (asaas_payment_id);
-- Índice parcial dos não-processados: monitorar acúmulo (fila do ASAAS para após
-- 15 falhas consecutivas — ver ASAAS-API.md §3 / spec §2.4).
CREATE INDEX IF NOT EXISTS webhook_events_unprocessed_idx ON public.webhook_events (created_at) WHERE processed_at IS NULL;

COMMENT ON TABLE public.webhook_events IS 'Idempotência + auditoria dos webhooks ASAAS. PK = event.id (estável entre reenvios). Escrita só pelo webhook (service_role).';

-- ── organizations: ampliações aditivas (EXPAND) ──────────────────────────────
-- Default trial 15→7 (decisão GATE1 #1). NÃO reescreve datas existentes — só
-- vale para cadastros novos (orgs atuais mantêm o trial_ends_at já gravado).
ALTER TABLE public.organizations
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '7 days');

-- CPF/CNPJ do titular da assinatura — OBRIGATÓRIO pelo ASAAS para gerar a
-- cobrança Pix (validado no sandbox em 25/06/2026: customer cria sem, mas a
-- cobrança exige). Capturado no checkout /assinar, guardado só em dígitos.
-- Nullable: só preenchido por quem assina (não engorda o cadastro dos betas).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS cpf_cnpj text;
COMMENT ON COLUMN public.organizations.cpf_cnpj IS 'CPF/CNPJ do titular (só dígitos) — exigido pelo ASAAS no Pix. Preenchido no checkout.';

-- Amplia o CHECK de plan para aceitar o slug pago 'base' (aditivo: mantém
-- beta/admin). Slug confirmado no GATE 2 (#1). Planos futuros (ex. 'pro')
-- entram ampliando este CHECK + linha em plans.
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_check CHECK (plan IN ('beta', 'admin', 'base'));

-- ── RLS: padrão admin_audit_log (RLS ON; sem policy de escrita p/ ninguém) ────
-- O app NÃO lê billing direto — lê entitlement de organizations (que já tem a
-- policy de SELECT por org). subscriptions/payments/webhook_events ficam SEM
-- policy → só service_role (admin client) escreve/lê. plans é a exceção: SELECT
-- público dos ativos para a landing /planos sem login.
ALTER TABLE public.subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans públicos para leitura" ON public.plans;
CREATE POLICY "plans públicos para leitura" ON public.plans
  FOR SELECT USING (is_active = true);

-- ── Seed: plano mensal (preço definido pelo Octavio, 25/06/2026) ─────────────
-- 1 plano mensal a R$ 59,97. Trimestral entra depois (linha nova com cycle='QUARTERLY').
INSERT INTO public.plans (slug, name, description, features, amount_cents, cycle, billing_type, is_active, sort_order)
VALUES (
  'base',
  'OptoMax',
  'Plano mensal — gestão clínica completa para optometria.',
  '["Agenda e pacientes ilimitados", "Fichas clínicas e evolução do grau", "Prescrições em PDF", "Suporte por WhatsApp"]'::jsonb,
  5997,                 -- R$ 59,97 (preço real — decisão do Octavio em 25/06/2026).
  'MONTHLY',
  'PIX',
  true,
  0
)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
