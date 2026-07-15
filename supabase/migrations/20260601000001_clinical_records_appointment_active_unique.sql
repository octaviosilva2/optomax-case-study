-- A2 (Ultrareview #005): garante no máximo UMA ficha ATIVA por agendamento.
-- Elimina a corrida (duas abas / clique duplo) que criava fichas duplicadas no
-- mesmo atendimento — antes só havia índice não-único em appointment_id.
--
-- Índice PARCIAL (deleted_at IS NULL): fichas arquivadas não contam, então
-- arquivar um atendimento e reiniciá-lo continua funcionando normalmente.
--
-- NOTA DE EVOLUÇÃO: quando o produto passar a permitir duas fichas por
-- atendimento (resumida + completa), trocar este índice por
--   UNIQUE (appointment_id, modelo) WHERE deleted_at IS NULL
-- para acomodar o novo modelo sem perder a proteção.
CREATE UNIQUE INDEX IF NOT EXISTS clinical_records_appointment_active_unique
  ON public.clinical_records (appointment_id)
  WHERE deleted_at IS NULL AND appointment_id IS NOT NULL;
