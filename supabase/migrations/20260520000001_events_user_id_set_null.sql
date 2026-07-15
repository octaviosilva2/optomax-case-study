-- =========================================================================
-- Fase 11.2 — F6-A07: events.user_id ON DELETE SET NULL preserva histórico
--
-- Antes: ON DELETE CASCADE apaga todos os events do user excluído.
-- Depois: ON DELETE SET NULL preserva linhas, anonimizando o user_id.
-- Especialmente sensível na Fase 8 (LGPD): exclusão pedida por um tester
-- apagaria o rastro de uso usado pelo painel /admin (séries temporais).
--
-- Nome real da FK confirmado via pg_constraint: events_user_id_fkey.
-- =========================================================================

-- Permite NULL na coluna (ON DELETE SET NULL precisa)
ALTER TABLE public.events ALTER COLUMN user_id DROP NOT NULL;

-- Recria FK com ação correta
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_user_id_fkey;

ALTER TABLE public.events
  ADD CONSTRAINT events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
