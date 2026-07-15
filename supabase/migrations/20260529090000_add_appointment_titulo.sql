-- Adiciona coluna `titulo` em appointments: nome/rótulo opcional do atendimento,
-- informado ao iniciar atendimento (walk-in). Nullable — atendimentos e
-- agendamentos existentes (e os sem nome) ficam null e a UI mostra um fallback.
-- Aditiva e não-destrutiva: não afeta linhas existentes.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS titulo text;

COMMENT ON COLUMN appointments.titulo IS 'Nome/rotulo opcional do atendimento, informado ao iniciar (walk-in).';
