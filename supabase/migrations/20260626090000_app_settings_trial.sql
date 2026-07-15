-- Config editável do produto (Fase 5C): duração do teste grátis.
--
-- Hoje o trial é fixo no DEFAULT da coluna organizations.trial_ends_at
-- (now() + 7 dias), só mudável via DDL. Esta migration cria uma tabela
-- key/value (`app_settings`) e reescreve handle_new_user para ler a duração
-- de lá — assim o /admin/planos edita os dias do trial com um UPDATE simples,
-- sem precisar de DDL em runtime.
--
-- ⚠️ Toca o trigger de criação de conta em produção. Aplicar sob gate explícito
-- (pode ir junto da reabertura — Fase 6).

BEGIN;

-- 1. Tabela de configurações simples (uma linha por chave).
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS ON sem policies: ninguém via anon/auth. Só service_role (bypassa RLS)
-- lê/escreve — coerente com o resto do back-office.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 2. Seed da duração do trial (mantém os 7 dias atuais).
INSERT INTO public.app_settings (key, value)
VALUES ('trial_days', '7')
ON CONFLICT (key) DO NOTHING;

-- 3. handle_new_user passa a calcular trial_ends_at a partir de app_settings,
--    com fallback de 7 dias se a chave não existir. Demais inserts preservados.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id UUID;
  v_trial_days INT;
BEGIN
  SELECT COALESCE(NULLIF(value, '')::int, 7) INTO v_trial_days
  FROM public.app_settings WHERE key = 'trial_days';
  IF v_trial_days IS NULL THEN
    v_trial_days := 7;
  END IF;

  INSERT INTO public.organizations (nome_clinica, trial_ends_at)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'nome_clinica', 'Minha Clínica'),
    now() + (v_trial_days || ' days')::interval
  )
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, org_id)
  VALUES (NEW.id, new_org_id);

  INSERT INTO public.origens_paciente (org_id, nome) VALUES
    (new_org_id, 'Indicação'),
    (new_org_id, 'Instagram'),
    (new_org_id, 'Google'),
    (new_org_id, 'Facebook'),
    (new_org_id, 'Outro');

  RETURN NEW;
END;
$function$;

COMMIT;
