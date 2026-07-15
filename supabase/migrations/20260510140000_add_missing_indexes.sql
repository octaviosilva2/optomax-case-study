-- Índices faltantes em tabelas tenant-scoped para acelerar listagens.
-- Sem esses índices, RLS faz scan completo antes de filtrar — latência cresce
-- com número de orgs/registros.
--
-- Observação: índices simples em (org_id) já existiam em patients/appointments/
-- clinical_records/prescriptions. Os criados aqui são compostos ou parciais,
-- direcionados aos caminhos de leitura quentes do app.

-- patients: lista filtra org_id + deleted_at IS NULL em toda navegação
CREATE INDEX IF NOT EXISTS patients_org_active_idx
  ON public.patients (org_id) WHERE deleted_at IS NULL;

-- appointments: lista agenda filtra (org_id, data_hora) ordenada
CREATE INDEX IF NOT EXISTS appointments_org_data_idx
  ON public.appointments (org_id, data_hora);

-- clinical_records: lista de atendimentos filtra (org_id, status) ordenada por created_at desc
CREATE INDEX IF NOT EXISTS clinical_records_org_status_idx
  ON public.clinical_records (org_id, status, created_at DESC);

-- clinical_records: histórico do paciente ordena por finalizado_em desc
CREATE INDEX IF NOT EXISTS clinical_records_patient_finalizado_idx
  ON public.clinical_records (patient_id, finalizado_em DESC);

-- prescriptions: lista de receitas filtra (org_id) com deleted_at IS NULL
CREATE INDEX IF NOT EXISTS prescriptions_org_active_idx
  ON public.prescriptions (org_id) WHERE deleted_at IS NULL;
