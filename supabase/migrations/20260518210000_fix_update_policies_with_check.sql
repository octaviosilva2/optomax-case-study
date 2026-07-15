-- F6-C01: adiciona WITH CHECK nas 3 policies UPDATE em public que estavam sem.
-- Sem WITH CHECK, user pode mudar org_id/id da row no UPDATE — sequestro
-- cross-tenant ou bypass de ownership.
--
-- Tabelas afetadas:
-- - prescriptions: org_id pode ser movido pra outra org
-- - organizations: id pode ser mudado (pequeno risco; defesa em profundidade)
-- - profiles: id pode ser mudado (pequeno risco; defesa em profundidade)

DROP POLICY IF EXISTS "prescriptions_update_org" ON public.prescriptions;
CREATE POLICY "prescriptions_update_org" ON public.prescriptions
  FOR UPDATE
  USING (
    org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "org_update" ON public.organizations;
CREATE POLICY "org_update" ON public.organizations
  FOR UPDATE
  USING (
    id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE
  USING (
    id = (SELECT auth.uid())
  )
  WITH CHECK (
    id = (SELECT auth.uid())
  );
