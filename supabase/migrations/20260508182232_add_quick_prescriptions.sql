-- Migration: Adição de Receitas Rápidas e Soft Delete em Prescriptions
-- Descrição: 
-- 1. Torna clinical_record_id opcional (receitas rápidas não possuem ficha associada).
-- 2. Adiciona a coluna prescription_type para diferenciar ('from_record' ou 'quick').
-- 3. Adiciona a coluna deleted_at para soft delete, seguindo a regra inegociável do projeto.
-- 4. Expande a constraint prescriptions_tipo_check para incluir 'lente_contato'.

-- Passo 1: Tornar clinical_record_id opcional
ALTER TABLE public.prescriptions
  ALTER COLUMN clinical_record_id DROP NOT NULL;

-- Passo 2: Adicionar coluna prescription_type e sua constraint
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS prescription_type text NOT NULL DEFAULT 'from_record';

ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_prescription_type_check;

ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_prescription_type_check
  CHECK (prescription_type IN ('from_record', 'quick'));

-- Passo 3: Adicionar soft delete
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Passo 4: Atualizar a constraint de 'tipo' para suportar lentes de contato
ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_tipo_check;

ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_tipo_check
  CHECK (tipo = ANY (ARRAY['longe'::text, 'perto'::text, 'multifocal'::text, 'oculos'::text, 'lente_contato'::text]));
