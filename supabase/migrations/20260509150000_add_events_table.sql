-- Migration: Tabela de eventos para o painel /admin
--
-- Cria a tabela `events` que registra eventos comportamentais dos usuários
-- (login, criação de paciente, ficha aberta/finalizada, PDF gerado, etc.).
--
-- O painel /admin usa esta tabela para acompanhar engajamento dos testers
-- durante a fase de validação. Não substitui as tabelas de domínio
-- (patients, clinical_records, prescriptions) — apenas complementa com
-- dados temporais que não são derivados de estado.
--
-- RLS:
--   - SELECT: bloqueado para usuários comuns. O /admin acessa via supabaseAdmin.
--   - INSERT: usuário autenticado pode inserir eventos vinculados ao seu
--     próprio user_id e org_id (consistência com o profile autenticado).
--
-- Performance:
--   - Índices em (org_id, created_at) e (user_id, created_at) para queries
--     do painel admin.
--   - Índice em (event_name, created_at) para filtros por tipo de evento.

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_org_created_idx
  ON public.events (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS events_user_created_idx
  ON public.events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS events_name_created_idx
  ON public.events (event_name, created_at DESC);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policy de INSERT: usuário só pode logar eventos com seu próprio user_id e org_id
-- consistente com seu profile (defesa em profundidade — server actions também validam).
DROP POLICY IF EXISTS events_insert ON public.events;
CREATE POLICY events_insert ON public.events
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

-- Policy de SELECT: bloqueada para usuários comuns. O painel admin usa
-- supabaseAdmin (SERVICE_ROLE_KEY) para bypass de RLS.
-- Não criar policy de SELECT — sem policy = ninguém vê via cliente normal.
