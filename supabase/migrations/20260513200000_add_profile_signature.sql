-- Assinatura digital do profissional (opção 1: imagem PNG embutida no PDF)
-- Coluna signature_url armazena o PATH dentro do bucket "signatures", não URL completa.
-- Ex: "abc-123-uuid/signature.png" — onde "abc-123-uuid" é o auth.uid() do profissional.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Bucket privado para assinaturas. Acesso server-side via service role (para embutir no PDF)
-- e via signed URL temporária no preview do dashboard.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signatures',
  'signatures',
  false,                              -- privado
  524288,                             -- 500 KB
  ARRAY['image/png']                  -- só PNG (transparência preservada)
)
ON CONFLICT (id) DO NOTHING;

-- RLS: cada profile só acessa arquivos da própria pasta ({user_id}/...)
-- storage.foldername(name)[1] retorna o primeiro segmento do path.

DROP POLICY IF EXISTS "signatures_select_own" ON storage.objects;
CREATE POLICY "signatures_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "signatures_insert_own" ON storage.objects;
CREATE POLICY "signatures_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "signatures_update_own" ON storage.objects;
CREATE POLICY "signatures_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "signatures_delete_own" ON storage.objects;
CREATE POLICY "signatures_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
