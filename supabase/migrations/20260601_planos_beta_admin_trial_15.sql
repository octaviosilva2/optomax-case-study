-- Planos 'beta' / 'admin' + trial padrão de 15 dias.
-- Decisão Octavio (01/06/2026):
--   - Dois planos no estágio atual:
--       'beta'  → testador. Nasce com trial de 15 dias (trial_ends_at).
--       'admin' → acesso ilimitado, sem prazo. Atribuído manualmente no /admin.
--   - Novos cadastros nascem 'beta' com 15 dias de trial.
--   - Migração de dados: todas as orgs existentes viram 'beta', EXCETO a conta
--     de octaviokcs@gmail.com, que vira 'admin' (o resto é promovido manualmente
--     pelo painel quando necessário).
-- Substitui o CHECK organizations_plan_check (antes: trial/base/pro/enterprise).

BEGIN;

-- 1. Remove o CHECK antigo para permitir os novos valores durante a migração.
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;

-- 2. Conta do fundador (octaviokcs@gmail.com) → admin (ilimitado).
UPDATE public.organizations
SET plan = 'admin'
WHERE id IN (
  SELECT p.org_id
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email = 'octaviokcs@gmail.com'
);

-- 3. Todas as demais clínicas → beta.
UPDATE public.organizations SET plan = 'beta' WHERE plan <> 'admin';

-- 4. Novo CHECK: apenas 'beta' e 'admin'.
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_check CHECK (plan IN ('beta', 'admin'));

-- 5. Defaults para novos cadastros (handle_new_user não seta plan/trial_ends_at,
--    então herdam destes defaults da coluna).
ALTER TABLE public.organizations ALTER COLUMN plan SET DEFAULT 'beta';
ALTER TABLE public.organizations ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '15 days');

COMMIT;
