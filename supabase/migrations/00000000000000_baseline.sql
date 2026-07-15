-- =====================================================================
-- BASELINE: schema canonical de public em producao em 2026-05-18.
--
-- Gerado retroativamente porque as tabelas-base do projeto foram criadas
-- via Supabase Dashboard antes da convencao de migrations versionadas
-- (F6-C02 recorrente desde ultrareview #001).
--
-- NAO APLICAR em prod (o schema ja existe — esta migration nunca esteve
-- no historico de prod, ela apenas documenta o que esta la).
--
-- Usar em:
--   - supabase db push em ambientes novos (staging, branches, local)
--   - disaster recovery (recriar schema vazio do zero)
--   - revisao de schema historico
--
-- Conteudo:
--   - Extension pg_trgm (para busca por similaridade em patients.nome)
--   - Funcoes helper: update_updated_at, handle_new_user
--   - 12 tabelas em public (organizations, profiles, patients, appointments,
--     clinical_records, prescriptions, tipos_consulta, origens_paciente,
--     events, organization_notes, admin_audit_log, admin_login_attempts)
--   - RLS habilitada em todas as tabelas + policies
--   - Indexes incluindo unique parciais e GIN trigram em patients.nome
--   - Triggers update_updated_at_X em 6 tabelas + on_auth_user_created
--   - RPC admin_user_metrics (SECURITY DEFINER + GRANT EXECUTE ao service_role)
--
-- Apos este baseline, as migrations versionadas em supabase/migrations/
-- aplicam apenas alteracoes incrementais (ALTERs, novas policies, etc).
-- =====================================================================

-- ---------- Extensions ----------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- Funcoes helper ----------

-- Trigger universal de updated_at: usada em 6 tabelas.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger no signup: cria profile + organization + tipos_consulta + origens_paciente
-- defaults pro novo user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  INSERT INTO public.organizations (nome_clinica)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'nome_clinica', 'Minha Clínica'))
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, org_id)
  VALUES (NEW.id, new_org_id);

  INSERT INTO public.tipos_consulta (org_id, nome, duracao) VALUES
    (new_org_id, 'Consulta Optométrica', 45),
    (new_org_id, 'Retorno', 30),
    (new_org_id, 'Adaptação de LC', 60);

  INSERT INTO public.origens_paciente (org_id, nome) VALUES
    (new_org_id, 'Indicação'),
    (new_org_id, 'Instagram'),
    (new_org_id, 'Google'),
    (new_org_id, 'Facebook'),
    (new_org_id, 'Outro');

  RETURN NEW;
END;
$$;

-- ---------- Tabelas ----------

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_clinica text NOT NULL,
  slug text UNIQUE,
  endereco text,
  telefone text,
  horario_funcionamento jsonb NOT NULL DEFAULT '{"dom": {"fim": "12:00", "ativo": false, "inicio": "08:00"}, "qua": {"fim": "18:00", "ativo": true, "inicio": "08:00"}, "qui": {"fim": "18:00", "ativo": true, "inicio": "08:00"}, "sab": {"fim": "12:00", "ativo": false, "inicio": "08:00"}, "seg": {"fim": "18:00", "ativo": true, "inicio": "08:00"}, "sex": {"fim": "18:00", "ativo": true, "inicio": "08:00"}, "ter": {"fim": "18:00", "ativo": true, "inicio": "08:00"}}'::jsonb,
  plan text NOT NULL DEFAULT 'trial',
  plan_status text NOT NULL DEFAULT 'trialing',
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  asaas_customer_id text UNIQUE,
  stripe_customer_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_terms_at timestamptz,
  accepted_terms_ip text,
  accepted_terms_version text,
  deletion_requested_at timestamptz,
  deletion_scheduled_for timestamptz,
  deletion_reason text
);
COMMENT ON COLUMN public.organizations.accepted_terms_at IS 'Timestamp do aceite dos termos durante signup. NULL = legado pré-checkbox.';
COMMENT ON COLUMN public.organizations.accepted_terms_version IS 'Versão dos documentos aceitos. Formato: "v1.0-2026-05-19".';
COMMENT ON COLUMN public.organizations.deletion_requested_at IS 'Quando o titular pediu exclusão (LGPD art. 18). Acesso bloqueado imediatamente via plan_status=suspended, hard-delete agendado em 30 dias.';
COMMENT ON COLUMN public.organizations.deletion_scheduled_for IS 'Data prevista do hard-delete (deletion_requested_at + 30 dias). Processamento manual durante validação.';
COMMENT ON COLUMN public.organizations.deletion_reason IS 'Motivo opcional preenchido pelo titular ao solicitar exclusão.';

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome_completo text,
  cro_cboo text,
  formacoes text[] DEFAULT '{}'::text[],
  intervalo_consulta integer DEFAULT 30,
  onboarded boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  signature_url text,
  last_seen_at timestamptz,
  first_seen_at timestamptz
);
COMMENT ON COLUMN public.profiles.last_seen_at IS 'Atualizado a cada request autenticada (throttle 60s via WHERE no UPDATE). NULL = legado pré-fase-5.';
COMMENT ON COLUMN public.profiles.first_seen_at IS 'Set no primeiro touchLastSeen() — primeiro acesso ao app após signup. NULL = ainda não acessou.';

CREATE TABLE IF NOT EXISTS public.tipos_consulta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  duracao integer NOT NULL DEFAULT 30,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.origens_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text,
  whatsapp text,
  data_nascimento date,
  responsavel_legal text,
  origem_id uuid REFERENCES public.origens_paciente(id) ON DELETE SET NULL,
  observacoes text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  email text,
  endereco text,
  sexo_biologico text CHECK (sexo_biologico = ANY (ARRAY['M'::text, 'F'::text]))
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  tipo_consulta_id uuid NOT NULL REFERENCES public.tipos_consulta(id) ON DELETE RESTRICT,
  data_hora timestamptz NOT NULL,
  duracao integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'agendado'
    CHECK (status = ANY (ARRAY['agendado'::text, 'confirmado'::text, 'atendido'::text, 'concluido'::text, 'faltou'::text, 'cancelado'::text])),
  walkin boolean DEFAULT false,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  modelo text NOT NULL DEFAULT 'resumido'
    CHECK (modelo = ANY (ARRAY['resumido'::text, 'completo'::text])),
  clinical_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'em_andamento'
    CHECK (status = ANY (ARRAY['em_andamento'::text, 'finalizado'::text])),
  finalizado_em timestamptz,
  editado boolean DEFAULT false,
  editado_em timestamptz,
  last_edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalizado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinical_record_id uuid REFERENCES public.clinical_records(id) ON DELETE SET NULL,
  dados_prescricao jsonb NOT NULL DEFAULT '{}'::jsonb,
  tipo text NOT NULL
    CHECK (tipo = ANY (ARRAY['oculos'::text, 'lente_contato'::text])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  prescription_type text NOT NULL DEFAULT 'from_record'
    CHECK (prescription_type = ANY (ARRAY['from_record'::text, 'quick'::text])),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_admin text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.organization_notes IS 'Notas internas do admin sobre cada org. Imutavel (sem UPDATE/DELETE no front). Acesso via SERVICE_ROLE.';

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  target_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  target_user_id uuid,
  admin_identifier text NOT NULL,
  ip text,
  user_agent text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.admin_audit_log IS 'Auditoria de acessos administrativos ao painel /admin. Acesso via SERVICE_ROLE.';

CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_attempted text NOT NULL,
  ip text NOT NULL,
  user_agent text,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.admin_login_attempts IS 'Rate limit persistente para /admin/login. Chave = email_attempted. Janela 15min, max 5 falhas.';

-- ---------- RLS habilitada em todas ----------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_consulta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.origens_paciente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

-- ---------- Policies ----------
-- organizations
DROP POLICY IF EXISTS "org_select" ON public.organizations;
CREATE POLICY "org_select" ON public.organizations FOR SELECT
  USING (id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "org_update" ON public.organizations;
CREATE POLICY "org_update" ON public.organizations FOR UPDATE
  USING (id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())))
  WITH CHECK (id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())));

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- tipos_consulta, origens_paciente, patients, appointments, clinical_records: policy ALL unica
DROP POLICY IF EXISTS "tipos_consulta_all" ON public.tipos_consulta;
CREATE POLICY "tipos_consulta_all" ON public.tipos_consulta FOR ALL
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "origens_paciente_all" ON public.origens_paciente;
CREATE POLICY "origens_paciente_all" ON public.origens_paciente FOR ALL
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "patients_all" ON public.patients;
CREATE POLICY "patients_all" ON public.patients FOR ALL
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "appointments_all" ON public.appointments;
CREATE POLICY "appointments_all" ON public.appointments FOR ALL
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "clinical_records_all" ON public.clinical_records;
CREATE POLICY "clinical_records_all" ON public.clinical_records FOR ALL
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())));

-- prescriptions: SELECT/INSERT/UPDATE separadas (DELETE so via service_role)
DROP POLICY IF EXISTS "prescriptions_select_org" ON public.prescriptions;
CREATE POLICY "prescriptions_select_org" ON public.prescriptions FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "prescriptions_insert_org" ON public.prescriptions;
CREATE POLICY "prescriptions_insert_org" ON public.prescriptions FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "prescriptions_update_org" ON public.prescriptions;
CREATE POLICY "prescriptions_update_org" ON public.prescriptions FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- events: so INSERT (SELECT via service_role no /admin)
DROP POLICY IF EXISTS "events_insert" ON public.events;
CREATE POLICY "events_insert" ON public.events FOR INSERT
  WITH CHECK (user_id = auth.uid() AND org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- organization_notes, admin_audit_log, admin_login_attempts: sem policies (RLS on, so service_role)

-- ---------- Indexes ----------

-- admin_audit_log
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_org_created_idx ON public.admin_audit_log (target_org_id, created_at DESC);

-- admin_login_attempts
CREATE INDEX IF NOT EXISTS admin_login_attempts_created_idx ON public.admin_login_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_login_attempts_email_created_idx ON public.admin_login_attempts (email_attempted, created_at DESC);

-- appointments
CREATE INDEX IF NOT EXISTS appointments_org_data_idx ON public.appointments (org_id, data_hora);
CREATE INDEX IF NOT EXISTS appointments_org_id_idx ON public.appointments (org_id);
CREATE INDEX IF NOT EXISTS appointments_patient_id_idx ON public.appointments (patient_id);
CREATE INDEX IF NOT EXISTS appointments_tipo_consulta_id_idx ON public.appointments (tipo_consulta_id);

-- clinical_records
CREATE INDEX IF NOT EXISTS clinical_records_appointment_id_idx ON public.clinical_records (appointment_id);
CREATE INDEX IF NOT EXISTS clinical_records_finalizado_por_idx ON public.clinical_records (finalizado_por);
CREATE INDEX IF NOT EXISTS clinical_records_last_edited_by_idx ON public.clinical_records (last_edited_by);
CREATE INDEX IF NOT EXISTS clinical_records_org_id_idx ON public.clinical_records (org_id);
CREATE INDEX IF NOT EXISTS clinical_records_org_status_idx ON public.clinical_records (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS clinical_records_patient_finalizado_idx ON public.clinical_records (patient_id, finalizado_em DESC);
CREATE INDEX IF NOT EXISTS clinical_records_patient_id_idx ON public.clinical_records (patient_id);

-- events
CREATE INDEX IF NOT EXISTS events_name_created_idx ON public.events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS events_org_created_idx ON public.events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_user_created_idx ON public.events (user_id, created_at DESC);

-- organization_notes
CREATE INDEX IF NOT EXISTS organization_notes_org_created_idx ON public.organization_notes (org_id, created_at DESC);

-- origens_paciente
CREATE INDEX IF NOT EXISTS origens_paciente_org_id_idx ON public.origens_paciente (org_id);

-- patients
CREATE INDEX IF NOT EXISTS patients_nome_trgm_idx ON public.patients USING gin (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS patients_org_active_idx ON public.patients (org_id) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS patients_org_cpf_active_unique ON public.patients (org_id, cpf) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS patients_origem_id_idx ON public.patients (origem_id);

-- prescriptions
CREATE INDEX IF NOT EXISTS prescriptions_clinical_record_id_idx ON public.prescriptions (clinical_record_id);
CREATE INDEX IF NOT EXISTS prescriptions_org_active_idx ON public.prescriptions (org_id) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS prescriptions_org_id_idx ON public.prescriptions (org_id);
CREATE INDEX IF NOT EXISTS prescriptions_patient_id_idx ON public.prescriptions (patient_id);
CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_record_tipo_unique ON public.prescriptions (clinical_record_id, tipo);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_first_seen_at ON public.profiles (first_seen_at);
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON public.profiles (last_seen_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS profiles_org_id_idx ON public.profiles (org_id);

-- tipos_consulta
CREATE INDEX IF NOT EXISTS tipos_consulta_org_id_idx ON public.tipos_consulta (org_id);

-- ---------- Triggers ----------

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_patients_updated_at ON public.patients;
CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_clinical_records_updated_at ON public.clinical_records;
CREATE TRIGGER trg_clinical_records_updated_at BEFORE UPDATE ON public.clinical_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_prescriptions_updated_at ON public.prescriptions;
CREATE TRIGGER trg_prescriptions_updated_at BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger no signup do Supabase Auth: cria profile/org/defaults pro novo user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- RPC admin_user_metrics (SECURITY DEFINER) ----------
-- Versao corrente em prod (com first_seen_at + last_seen_at). Migrations
-- versionadas em supabase/migrations/ rastreiam as evolucoes desta RPC.

CREATE OR REPLACE FUNCTION public.admin_user_metrics()
RETURNS TABLE(
  user_id uuid,
  org_id uuid,
  org_nome text,
  org_status text,
  org_created_at timestamptz,
  profile_created_at timestamptz,
  nome_completo text,
  ultimo_login timestamptz,
  last_seen_at timestamptz,
  first_seen_at timestamptz,
  pacientes_ativos integer,
  fichas_finalizadas integer,
  pdfs_gerados integer,
  fichas_abandonadas integer
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH session_starts AS (
    SELECT user_id, MAX(created_at) AS ultimo
    FROM public.events
    WHERE event_name = 'session_started'
    GROUP BY user_id
  )
  SELECT
    p.id AS user_id,
    p.org_id,
    o.nome_clinica AS org_nome,
    o.plan_status AS org_status,
    o.created_at AS org_created_at,
    p.created_at AS profile_created_at,
    p.nome_completo,
    ss.ultimo AS ultimo_login,
    p.last_seen_at,
    p.first_seen_at,
    (SELECT count(*)::int FROM public.patients pa
       WHERE pa.org_id = p.org_id AND pa.deleted_at IS NULL),
    (SELECT count(*)::int FROM public.clinical_records cr
       WHERE cr.org_id = p.org_id AND cr.status = 'finalizado'),
    (SELECT count(*)::int FROM public.prescriptions pr
       WHERE pr.org_id = p.org_id AND pr.deleted_at IS NULL),
    (SELECT count(*)::int FROM public.clinical_records cr2
       WHERE cr2.org_id = p.org_id
         AND cr2.status = 'em_andamento'
         AND cr2.created_at < (now() - interval '1 day'))
  FROM public.profiles p
  JOIN public.organizations o ON o.id = p.org_id
  LEFT JOIN session_starts ss ON ss.user_id = p.id;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_user_metrics() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_user_metrics() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_metrics() TO service_role;
