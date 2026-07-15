-- Migration: remoção da coluna logo_url da tabela organizations
-- Motivo: recurso de upload de logo da clínica foi removido por decisão de produto
-- antes do deploy (Fase 8). Toda a UI, types e PDF de prescrição já não usam mais.

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS logo_url;
