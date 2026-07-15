-- Fecha funcoes SECURITY DEFINER que estavam executaveis por anon/authenticated.
--
-- Motivo: advisor de seguranca do Supabase apontou que public.admin_user_metrics()
-- (SECURITY DEFINER, roda como postgres) tinha GRANT EXECUTE para `anon`. Como a
-- anon key e publica (vai no bundle do cliente), qualquer um podia chamar
-- POST /rest/v1/rpc/admin_user_metrics sem login e baixar nome de TODAS as clinicas,
-- nome dos profissionais, status de plano e metricas de uso de todos os tenants.
--
-- handle_new_user() e rls_auto_enable() tambem estavam executaveis por anon/authenticated
-- (sao triggers; nao retornam dados, mas fechamos por higiene de seguranca).
--
-- O painel /admin acessa essas funcoes via service_role, cujo grant permanece intacto.
-- Triggers continuam funcionando (rodam com privilegio do dono, nao do invocador).

REVOKE EXECUTE ON FUNCTION public.admin_user_metrics() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- rls_auto_enable() não é criada por nenhuma migration versionada deste repo
-- (drift: existe na prod, mas fora do histórico — mesmo padrão já documentado
-- em 20260601000000_reconcile_prod_schema.sql). DO block evita erro no replay
-- local, onde a função não existe.
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;
