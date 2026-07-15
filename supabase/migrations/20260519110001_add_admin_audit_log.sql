-- M-04: Tabela admin_audit_log
-- Auditoria de acessos administrativos ao painel /admin.
-- RLS ON sem policies — apenas SERVICE_ROLE acessa.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  target_org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  target_user_id uuid,
  admin_identifier text NOT NULL,
  ip text,
  user_agent text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_org_created_idx ON admin_audit_log (target_org_id, created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE admin_audit_log IS 'Auditoria de acessos administrativos ao painel /admin. Acesso via SERVICE_ROLE.';
