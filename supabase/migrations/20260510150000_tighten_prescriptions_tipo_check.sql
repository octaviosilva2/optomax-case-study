-- Aperta CHECK de prescriptions.tipo para bater com o Zod schema do app.
-- SLC 1.0 só usa 'oculos' e 'lente_contato'. Valores antigos ('longe', 'perto',
-- 'multifocal') ficaram no CHECK por herança de schema inicial, mas nunca foram
-- usados pelo produto.
--
-- Validado antes de aplicar: SELECT tipo, count(*) FROM prescriptions GROUP BY 1
--   → apenas 'oculos' (5 linhas). Nenhuma linha bloqueia o aperto.

ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_tipo_check;

ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_tipo_check
  CHECK (tipo IN ('oculos', 'lente_contato'));
