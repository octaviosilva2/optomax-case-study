-- Fase 5 — Métrica "Última atividade" no /admin (substitui "Último login").
--
-- Bug que motivou: a coluna "Último login" no painel admin lia o último evento
-- `session_started`. Se um tester já estava logado e navegava normalmente, o
-- timestamp NÃO atualizava — métrica enganosa pra acompanhar engajamento real.
--
-- Solução: `last_seen_at` é atualizado a cada request autenticada (em
-- (app)/layout.tsx via helper touchLastSeen), com throttle de 60s no próprio
-- WHERE da UPDATE — só efetiva 1x/minuto/user. Custo desprezível.
--
-- Nullable: profiles legados (pré-fase-5) ficam NULL → admin faz fallback pra
-- `profiles.created_at` na exibição.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON profiles (last_seen_at DESC NULLS LAST);

COMMENT ON COLUMN profiles.last_seen_at IS
  'Atualizado a cada request autenticada (throttle 60s via WHERE no UPDATE). NULL = legado pré-fase-5.';
