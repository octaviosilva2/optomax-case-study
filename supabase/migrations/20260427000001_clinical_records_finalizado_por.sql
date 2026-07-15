-- Fase 7 / PR2 (M2):
-- Adiciona coluna `finalizado_por` em clinical_records — guarda quem finalizou
-- o atendimento (autor responsável pela prescrição emitida).
--
-- Antes desta coluna, o PDF usava `last_edited_by`, que reflete a última
-- edição (qualquer auxiliar/assistente que abriu pra ajustar uma observação).
-- Isso podia trocar a autoria do documento legal involuntariamente.
--
-- Política:
--   - finalizado_por é setado no servidor durante finalizarAtendimento, com
--     auth.uid() do usuário logado.
--   - Permanece imutável após finalização (mesmo em edição pós-finalização).
--   - ON DELETE SET NULL: se o profile for excluído, o record continua,
--     o PDF cai para fallback (usuário atual ao gerar).
--
-- Backfill: linhas existentes ficam com NULL — tudo bem, o PDF tem fallback.
-- Como aplicar: SQL Editor do Supabase Dashboard. Idempotente (IF NOT EXISTS).

ALTER TABLE public.clinical_records
  ADD COLUMN IF NOT EXISTS finalizado_por uuid
  REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index para joins futuros (relatórios "atendimentos por profissional", etc.).
CREATE INDEX IF NOT EXISTS clinical_records_finalizado_por_idx
  ON public.clinical_records (finalizado_por);
