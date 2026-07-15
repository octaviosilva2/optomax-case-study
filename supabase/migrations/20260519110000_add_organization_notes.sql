-- M-03: Tabela organization_notes
-- Notas internas do admin sobre cada org. Imutável (sem UPDATE/DELETE no front).
-- RLS ON sem policies — apenas SERVICE_ROLE acessa via /admin.

CREATE TABLE IF NOT EXISTS organization_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_admin text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_notes_org_created_idx ON organization_notes (org_id, created_at DESC);

ALTER TABLE organization_notes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE organization_notes IS 'Notas internas do admin sobre cada org. Imutavel (sem UPDATE/DELETE no front). Acesso via SERVICE_ROLE.';
