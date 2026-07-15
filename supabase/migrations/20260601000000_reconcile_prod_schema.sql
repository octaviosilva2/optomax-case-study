-- ============================================================================
-- Reconciliação do repositório de migrations com o schema de PRODUÇÃO.
--
-- Contexto (Ultrareview #005, 01/06/2026): estas colunas/constraints já existem
-- no banco de produção (foram aplicadas direto, sem arquivo versionado), mas
-- nenhuma migration as cria. Resultado: recriar o banco do zero (CI, novo
-- ambiente, disaster recovery) gera um schema DIVERGENTE de produção e quebra
-- arquivamento de fichas, geração de PDF e data de retorno.
--
-- Esta migration é ADITIVA e IDEMPOTENTE (tudo IF NOT EXISTS / DROP+ADD):
--   - em PRODUÇÃO é no-op (os objetos já existem);
--   - em banco NOVO, reproduz fielmente o estado de produção.
--
-- Tipos confirmados via information_schema em 01/06/2026.
-- NÃO aplicar sem revisão de schema (Octavio + Caio) — ver regra do projeto.
-- ============================================================================

-- 1) clinical_records.deleted_at — soft-delete (arquivamento de ficha).
ALTER TABLE public.clinical_records
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2) clinical_records.retorno_previsto_em — data de retorno definida na finalização.
ALTER TABLE public.clinical_records
  ADD COLUMN IF NOT EXISTS retorno_previsto_em date;

-- 3) prescriptions.pdf_gerado_em — marca quando o PDF foi gerado.
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS pdf_gerado_em timestamptz;

-- 4) Índice parcial: listagens filtram clinical_records ativas (deleted_at IS NULL).
CREATE INDEX IF NOT EXISTS clinical_records_org_active_idx
  ON public.clinical_records (org_id) WHERE deleted_at IS NULL;

-- 5) Índice parcial: lembrete de retorno por org.
CREATE INDEX IF NOT EXISTS idx_clinical_records_retorno_previsto
  ON public.clinical_records (org_id, retorno_previsto_em) WHERE retorno_previsto_em IS NOT NULL;

-- 6) CHECK de appointments.status: a baseline não inclui 'em_andamento', mas o
--    código transiciona o agendamento para esse estado ao iniciar a ficha.
--    Produção já tem o CHECK correto; alinhamos o versionado.
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status = ANY (ARRAY[
    'agendado'::text,
    'confirmado'::text,
    'em_andamento'::text,
    'concluido'::text,
    'cancelado'::text,
    'faltou'::text
  ]));
