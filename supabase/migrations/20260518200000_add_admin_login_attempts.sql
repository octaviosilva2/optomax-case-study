-- M-07: tabela pra rate limit persistente do /admin/login
-- Substitui o Map<ip, count> in-memory que zerava no cold start do Vercel.
-- Chave = email_attempted (atacante nao consegue burlar rotacionando IPs).
-- Janela 15min, max 5 falhas (definido no codigo).
-- Acesso so via SERVICE_ROLE (RLS habilitada sem policies).

CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_attempted text NOT NULL,
  ip text NOT NULL,
  user_agent text,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_login_attempts_email_created_idx
  ON public.admin_login_attempts (email_attempted, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_login_attempts_created_idx
  ON public.admin_login_attempts (created_at DESC);

ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.admin_login_attempts IS
  'Rate limit persistente para /admin/login. Chave = email_attempted. Janela 15min, max 5 falhas.';
