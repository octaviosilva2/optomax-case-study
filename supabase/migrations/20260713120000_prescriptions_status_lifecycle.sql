-- Unificar Ficha e Receita (B3): ciclo de vida da receita AVULSA (rascunho → finalizada).
--
-- Aditiva e reversível (DROP COLUMN / DROP INDEX), SEM backfill manual:
-- o DEFAULT 'finalizada' preenche automaticamente TODAS as linhas já existentes
-- (comportamento nativo do Postgres em ADD COLUMN ... NOT NULL DEFAULT). Assim
-- todas as receitas legadas e as vinculadas a ficha continuam 'finalizada'
-- (zero mudança de comportamento) — só a receita avulsa nova nasce 'rascunho'.
--
-- Idempotente (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS): pode
-- reaplicar sem erro. RLS de `prescriptions` inalterado (nenhuma policy tocada).

-- status: distingue rascunho (receita avulsa em preenchimento) de finalizada.
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'finalizada'
    CHECK (status IN ('rascunho', 'finalizada'));

-- Momento da finalização (paralelo a clinical_records.finalizado_em).
-- NULL para rascunhos e para o legado (que nunca passou por finalizarReceita).
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS finalizada_em timestamptz NULL;

-- Índice parcial p/ listar rascunhos ativos rápido (são poucos, mas evita scan
-- na lista de receitas quando filtra os "Em andamento").
CREATE INDEX IF NOT EXISTS prescriptions_rascunho_idx
  ON public.prescriptions (org_id)
  WHERE status = 'rascunho' AND deleted_at IS NULL;
