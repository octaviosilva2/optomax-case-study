-- Migration M-01: aceite de Termos e Política de Privacidade
-- Adiciona 3 colunas em organizations para registrar consentimento eletrônico
-- conforme exigência LGPD e §3.2 dos Termos de Uso v1.0.
-- Todas nullable: legado pré-checkbox terá NULL nestes campos.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_terms_ip text,
  ADD COLUMN IF NOT EXISTS accepted_terms_version text;

COMMENT ON COLUMN organizations.accepted_terms_at IS 'Timestamp do aceite dos termos durante signup. NULL = legado pré-checkbox.';
COMMENT ON COLUMN organizations.accepted_terms_version IS 'Versão dos documentos aceitos. Formato: "v1.0-2026-05-19".';
