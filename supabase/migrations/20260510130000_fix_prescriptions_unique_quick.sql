-- Fix: UNIQUE INDEX em (clinical_record_id, tipo) tratava cada NULL como distinto
-- após receitas rápidas (clinical_record_id NULL).
-- Solução: índice parcial — único somente quando clinical_record_id NÃO é NULL.
-- Receitas rápidas (clinical_record_id NULL) podem ter múltiplas com mesmo tipo
-- por paciente — comportamento correto, são reimpressões/atualizações manuais.

DROP INDEX IF EXISTS public.prescriptions_record_tipo_unique;

CREATE UNIQUE INDEX prescriptions_record_tipo_unique
  ON public.prescriptions (clinical_record_id, tipo)
  WHERE clinical_record_id IS NOT NULL;
