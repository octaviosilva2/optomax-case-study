-- Fase 7 / PR1 (C2 + B1 + B2):
-- Garante unicidade do snapshot de prescription por (clinical_record, tipo)
-- e cria índices para os caminhos de leitura mais quentes.
--
-- Como aplicar:
--   - Supabase Dashboard → SQL Editor → cole o conteúdo deste arquivo.
--   - OU via Supabase CLI: `supabase db push` (se a CLI estiver configurada).
--
-- Idempotente: usa IF NOT EXISTS — pode rodar várias vezes sem efeito colateral.
--
-- Antes de aplicar em produção: se já existirem linhas duplicadas para o mesmo
-- (clinical_record_id, tipo), a criação do UNIQUE INDEX vai falhar. Verifique:
--
--   SELECT clinical_record_id, tipo, COUNT(*)
--   FROM public.prescriptions
--   GROUP BY 1, 2
--   HAVING COUNT(*) > 1;
--
-- Se voltar linhas, decida qual manter (geralmente a mais recente em
-- updated_at) e remova as outras antes de aplicar este script.

-- 1. Unicidade — bloqueia inserts duplicados por race condition no upsert.
CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_record_tipo_unique
  ON public.prescriptions (clinical_record_id, tipo);

-- 2. Listagem por paciente — usado em usePrescricoes (perfil do paciente).
CREATE INDEX IF NOT EXISTS prescriptions_patient_id_idx
  ON public.prescriptions (patient_id);

-- RLS de prescriptions movida para 20260510120000_enable_rls_prescriptions.sql
