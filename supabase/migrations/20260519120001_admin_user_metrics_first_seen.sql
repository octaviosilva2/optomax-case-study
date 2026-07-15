-- Fase 6.5 — RPC admin_user_metrics agora retorna first_seen_at.
-- Coluna "Uso real" no /admin = dias desde profiles.first_seen_at.
--
-- Precisa DROP antes de CREATE porque mudou o RETURNS — Postgres não permite
-- alterar tipo de retorno de função existente via OR REPLACE.

DROP FUNCTION IF EXISTS public.admin_user_metrics();

CREATE FUNCTION public.admin_user_metrics()
RETURNS TABLE (
  user_id uuid,
  org_id uuid,
  org_nome text,
  org_status text,
  org_created_at timestamptz,
  profile_created_at timestamptz,
  nome_completo text,
  ultimo_login timestamptz,
  last_seen_at timestamptz,
  first_seen_at timestamptz,
  pacientes_ativos int,
  fichas_finalizadas int,
  pdfs_gerados int,
  fichas_abandonadas int
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH session_starts AS (
    SELECT user_id, MAX(created_at) AS ultimo
    FROM public.events
    WHERE event_name = 'session_started'
    GROUP BY user_id
  )
  SELECT
    p.id AS user_id,
    p.org_id,
    o.nome_clinica AS org_nome,
    o.plan_status AS org_status,
    o.created_at AS org_created_at,
    p.created_at AS profile_created_at,
    p.nome_completo,
    ss.ultimo AS ultimo_login,
    p.last_seen_at,
    p.first_seen_at,
    (SELECT count(*)::int FROM public.patients pa
       WHERE pa.org_id = p.org_id AND pa.deleted_at IS NULL),
    (SELECT count(*)::int FROM public.clinical_records cr
       WHERE cr.org_id = p.org_id AND cr.status = 'finalizado'),
    (SELECT count(*)::int FROM public.prescriptions pr
       WHERE pr.org_id = p.org_id AND pr.deleted_at IS NULL),
    (SELECT count(*)::int FROM public.clinical_records cr2
       WHERE cr2.org_id = p.org_id
         AND cr2.status = 'em_andamento'
         AND cr2.created_at < (now() - interval '1 day'))
  FROM public.profiles p
  JOIN public.organizations o ON o.id = p.org_id
  LEFT JOIN session_starts ss ON ss.user_id = p.id;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_user_metrics() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_user_metrics() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_metrics() TO service_role;
