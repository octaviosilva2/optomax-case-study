-- Reverte 20260510130000_fix_prescriptions_unique_quick.sql
--
-- Motivo: o índice parcial (WHERE clinical_record_id IS NOT NULL) quebrou o
-- UPSERT em src/app/(app)/atendimento/[id]/actions.ts -> upsertPrescricaoSnapshot.
-- PostgreSQL exige que o WHERE do ON CONFLICT case com o WHERE do partial index,
-- mas o supabase-js só envia o nome das colunas (onConflict: 'clinical_record_id,tipo'),
-- sem suportar predicate. Resultado: "there is no unique or exclusion constraint
-- matching the ON CONFLICT specification" ao finalizar atendimento.
--
-- O partial não era necessário em primeiro lugar: por padrão UNIQUE no Postgres
-- trata NULLs como distintos (NULL != NULL), então múltiplas receitas rápidas
-- (clinical_record_id NULL) com mesmo tipo já seriam permitidas em um UNIQUE
-- completo. A migration M8 partia de uma premissa incorreta.

DROP INDEX IF EXISTS public.prescriptions_record_tipo_unique;

CREATE UNIQUE INDEX prescriptions_record_tipo_unique
  ON public.prescriptions (clinical_record_id, tipo);
