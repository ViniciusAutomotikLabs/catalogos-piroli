-- ERP 2.0 — Bucket privado de fotos de pessoas + políticas por organização.
-- Fotos capturadas por webcam (must-have) e uploads. Bucket PRIVADO: acesso só via
-- signed URL gerada server-side para membros da organização dona do arquivo.
-- Convenção de path: `${organizacao_id}/${pessoa_id|tmp}/arquivo`.

INSERT INTO storage.buckets (id, name, public)
VALUES ('pessoas', 'pessoas', false)
ON CONFLICT (id) DO NOTHING;

-- Leitura/escrita restrita à organização do usuário (primeiro segmento do path).
DROP POLICY IF EXISTS pessoas_bucket_select ON storage.objects;
CREATE POLICY pessoas_bucket_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'pessoas'
        AND (storage.foldername(name))[1] ~ '^[0-9]+$'
        AND ((storage.foldername(name))[1])::bigint IN (SELECT private.organizacao_ids_do_usuario())
    );

DROP POLICY IF EXISTS pessoas_bucket_insert ON storage.objects;
CREATE POLICY pessoas_bucket_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'pessoas'
        AND (storage.foldername(name))[1] ~ '^[0-9]+$'
        AND ((storage.foldername(name))[1])::bigint IN (SELECT private.organizacao_ids_do_usuario())
    );

DROP POLICY IF EXISTS pessoas_bucket_delete ON storage.objects;
CREATE POLICY pessoas_bucket_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'pessoas'
        AND (storage.foldername(name))[1] ~ '^[0-9]+$'
        AND ((storage.foldername(name))[1])::bigint IN (SELECT private.organizacao_ids_do_usuario())
    );
