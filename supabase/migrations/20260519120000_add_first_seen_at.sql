-- Fase 6.5 — Coluna `profiles.first_seen_at` para coluna "Uso real" no /admin.
--
-- Diferença vs auth.users.created_at:
--   - auth.users.created_at = signup (criou conta)
--   - profiles.first_seen_at = primeiro acesso efetivo às rotas (app) após signup
--
-- Set 1x apenas no primeiro touch via touchLastSeen() — UPDATE separado com
-- `.is('first_seen_at', null)` garante idempotência (segundo touch é no-op).
--
-- NULL = signed up mas nunca acessou o app (vai aparecer como "—" no admin).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_first_seen_at ON profiles (first_seen_at);

COMMENT ON COLUMN profiles.first_seen_at IS
  'Set no primeiro touchLastSeen() — primeiro acesso ao app após signup. NULL = ainda não acessou.';
