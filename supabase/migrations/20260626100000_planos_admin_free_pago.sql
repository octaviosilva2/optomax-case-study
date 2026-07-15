-- Modelo de planos revisado (decisão Octavio, 26/06/2026 — Fase 5).
-- Renomeia o ENUM de organizations.plan:
--   'beta' → 'free'   (gratuito: trial por prazo OU cortesia permanente)
--   'base' → 'pago'   (assinatura mensal ativa)
--   'admin' permanece (interno, só o fundador)
--
-- Coerente com src/lib/utils/status.ts (PLANS = admin/free/pago) e o webhook,
-- que passa a marcar plan='pago' ao confirmar um pagamento.
--
-- ⚠️ Toca dados de produção (renomeia o plano de ~30 clínicas reais). Aplicar
-- só sob gate explícito do Octavio (pode ir junto da reabertura — Fase 6).
-- A coluna `plans.slug` (catálogo vendável) NÃO muda aqui: 'base' segue sendo o
-- identificador do produto usado pelo checkout. Aqui muda só o tier da org.

BEGIN;

-- 1. Remove o CHECK atual para permitir os novos valores durante a migração.
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;

-- 2. Renomeia os valores legados.
UPDATE public.organizations SET plan = 'free' WHERE plan = 'beta';
UPDATE public.organizations SET plan = 'pago' WHERE plan = 'base';

-- 3. Novo CHECK: apenas admin/free/pago.
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_check CHECK (plan IN ('admin', 'free', 'pago'));

-- 4. Default para novos cadastros (handle_new_user herda do default da coluna).
ALTER TABLE public.organizations ALTER COLUMN plan SET DEFAULT 'free';

COMMIT;
