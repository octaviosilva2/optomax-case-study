-- Habilita RLS na tabela prescriptions e cria policies de tenant isolation.
-- Originalmente comentado em 20260427_prescriptions_indexes.sql (M1).
-- Aplicado manualmente via SQL Editor antes desta migration ser commitada,
-- então usa IF NOT EXISTS / DROP POLICY IF EXISTS para ser idempotente.
--
-- Observação: o estado inicial em produção tinha uma policy única "prescriptions_all"
-- (FOR ALL) que permitia DELETE — substituída pelas 3 policies abaixo (SELECT,
-- INSERT, UPDATE). DELETE fica restrito a admin via service-role.

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Remove policy legada FOR ALL caso ainda exista em ambientes não atualizados.
DROP POLICY IF EXISTS "prescriptions_all" ON public.prescriptions;

DROP POLICY IF EXISTS "prescriptions_select_org" ON public.prescriptions;
CREATE POLICY "prescriptions_select_org" ON public.prescriptions
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "prescriptions_insert_org" ON public.prescriptions;
CREATE POLICY "prescriptions_insert_org" ON public.prescriptions
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "prescriptions_update_org" ON public.prescriptions;
CREATE POLICY "prescriptions_update_org" ON public.prescriptions
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );
