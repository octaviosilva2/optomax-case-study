-- Reorganização "Novo Atendimento" (S1): liga uma receita standalone ao
-- agendamento que a originou, para que a finalização da receita marque o
-- agendamento como concluído SEM precisar criar uma ficha clínica.
--
-- Aditiva e reversível (DROP COLUMN), sem backfill: receitas legadas e
-- receitas rápidas puras ficam com appointment_id NULL (comportamento
-- inalterado). ON DELETE SET NULL: se o agendamento for apagado, a receita
-- continua existindo como standalone (não some).
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS appointment_id uuid NULL REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS prescriptions_appointment_id_idx
  ON public.prescriptions (appointment_id) WHERE appointment_id IS NOT NULL;
