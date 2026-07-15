-- Fase 8 (LGPD complementar): direito de eliminação (art. 18 LGPD)
-- Adiciona colunas para registrar pedido de exclusão de conta com carência de 30 dias.
-- Acesso é bloqueado imediatamente via plan_status='suspended'; hard-delete é
-- processado manualmente durante a fase de validação (registrado em decisions.md).

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

COMMENT ON COLUMN organizations.deletion_requested_at IS 'Quando o titular pediu exclusão (LGPD art. 18). Acesso bloqueado imediatamente via plan_status=suspended, hard-delete agendado em 30 dias.';
COMMENT ON COLUMN organizations.deletion_scheduled_for IS 'Data prevista do hard-delete (deletion_requested_at + 30 dias). Processamento manual durante validação.';
COMMENT ON COLUMN organizations.deletion_reason IS 'Motivo opcional preenchido pelo titular ao solicitar exclusão.';
