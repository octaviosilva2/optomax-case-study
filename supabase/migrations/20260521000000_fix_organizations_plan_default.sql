-- Corrige DEFAULT que ficou desalinhado com CHECK em 20260520000000_add_check_constraints.sql
-- Bug: signup quebrava com "organizations_plan_check violation" porque DEFAULT continuou 'free'
-- após o CHECK ser atualizado para aceitar apenas trial/base/pro/enterprise.
ALTER TABLE public.organizations ALTER COLUMN plan SET DEFAULT 'trial';
