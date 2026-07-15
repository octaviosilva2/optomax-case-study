-- Ultrareview #002:
-- Versiona oficialmente as colunas de edição pós-finalização em clinical_records.
-- As colunas já existem em produção (criadas via Supabase Dashboard durante
-- desenvolvimento da Fase 7), mas não estavam em nenhuma migration `.sql`.
-- Esta migration é idempotente — não recria nem altera nada se as colunas já
-- estiverem presentes. Serve como fonte da verdade declarativa para disaster
-- recovery e ambientes futuros (staging, branches).
--
-- Política:
--   - `editado` (bool): marca se a ficha foi alterada após `finalizado_em`.
--   - `editado_em` (timestamptz): última edição pós-finalização.
--   - `last_edited_by` (uuid → profiles): autor da última edição. Diferente de
--     `finalizado_por`, que permanece imutável após finalização.
--   - Todas NULL na criação inicial. Setadas apenas quando ocorre re-edição.
--
-- Como aplicar: SQL Editor do Supabase Dashboard. Idempotente (IF NOT EXISTS).

ALTER TABLE public.clinical_records
  ADD COLUMN IF NOT EXISTS editado boolean DEFAULT false;

ALTER TABLE public.clinical_records
  ADD COLUMN IF NOT EXISTS editado_em timestamp with time zone;

ALTER TABLE public.clinical_records
  ADD COLUMN IF NOT EXISTS last_edited_by uuid
  REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index para joins futuros em relatórios de auditoria por profissional.
CREATE INDEX IF NOT EXISTS clinical_records_last_edited_by_idx
  ON public.clinical_records (last_edited_by);
