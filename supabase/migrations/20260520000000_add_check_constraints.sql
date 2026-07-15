-- =========================================================================
-- Fase 11.2 — CHECK constraints alinhando enums entre código e banco
-- Referência: ultrareview-003/findings/06-banco-schema.md (F6-A02 a F6-A06)
--
-- Pre-flight 2026-05-18 (via MCP execute_sql):
--   appointments.status:      16 agendado / 4 cancelado / 10 concluido / 1 confirmado
--                             (zero 'atendido' ou 'finalizado' — UPDATE abaixo é defesa)
--   clinical_records.status:  6 em_andamento / 11 finalizado          → limpo
--   organizations.plan_status: 4 inactive / 2 trialing                  → limpo
--   organizations.plan:        6 free                                  → NORMALIZADO PRA 'trial'
--   prescriptions:            11 from_record c/ record + 8 quick s/ record → consistente
--
-- Estado pré-existente das constraints (verificado em pg_constraint):
--   appointments_status_check JÁ EXISTIA com 'atendido' incluído — drop e
--     recreate sem 'atendido' (com 'em_andamento' como destino possível).
--   clinical_records_status_check JÁ EXISTE igual ao alvo — sem ação.
--   organizations.plan / plan_status: SEM check — criar.
--   prescriptions_prescription_type_check JÁ EXISTE — sem ação.
--   prescriptions consistency tipo↔record_id: SEM check — criar.
-- =========================================================================

-- F6-A02: appointments.status
-- Normaliza valores legados antes do CHECK (defesa em camadas).
UPDATE public.appointments
SET status = 'concluido'
WHERE status IN ('atendido', 'finalizado');

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('agendado', 'confirmado', 'em_andamento', 'concluido', 'cancelado', 'faltou'));

-- F6-A03: clinical_records.status (idempotente — já existe igual)
ALTER TABLE public.clinical_records DROP CONSTRAINT IF EXISTS clinical_records_status_check;
ALTER TABLE public.clinical_records
  ADD CONSTRAINT clinical_records_status_check
  CHECK (status IN ('em_andamento', 'finalizado'));

-- F6-A04: organizations.plan_status (superset canônico)
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_status_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_status_check
  CHECK (plan_status IN ('trialing', 'active', 'past_due', 'inactive', 'suspended', 'cancelled', 'expired'));

-- F6-A05 pre-flight: 6 orgs com plan='free' (default antigo da trigger
-- handle_new_user / seed inicial — created_at entre 2026-04-14 e 2026-05-18).
-- Normaliza pra 'trial' antes do CHECK — 'free' não está no vocabulário
-- canônico de Termos/Política de Privacidade.
UPDATE public.organizations SET plan = 'trial' WHERE plan = 'free';

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN ('trial', 'base', 'pro', 'enterprise'));

-- F6-A06: consistência prescription_type ↔ clinical_record_id
-- 'quick' → SEM clinical_record_id | 'from_record' → COM clinical_record_id
ALTER TABLE public.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_type_record_consistency_check;
ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_type_record_consistency_check
  CHECK (
    (prescription_type = 'quick' AND clinical_record_id IS NULL) OR
    (prescription_type = 'from_record' AND clinical_record_id IS NOT NULL)
  );
