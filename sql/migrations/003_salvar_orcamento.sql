-- BE-09: orçamento transacional (cabeçalho + itens em uma única transação)

CREATE OR REPLACE FUNCTION public.salvar_orcamento(
    p_loja_id BIGINT,
    p_cliente_id BIGINT DEFAULT NULL,
    p_criado_por UUID DEFAULT NULL,
    p_itens JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (orcamento_id BIGINT, ok BOOLEAN, erro TEXT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_orcamento_id BIGINT;
    v_item JSONB;
    v_qtd INT;
    v_preco NUMERIC(12,2);
BEGIN
    IF p_loja_id IS NULL THEN
        RETURN QUERY SELECT NULL::BIGINT, FALSE, 'loja_id obrigatório';
        RETURN;
    END IF;

    IF p_loja_id NOT IN (SELECT private.loja_ids_do_usuario()) THEN
        RETURN QUERY SELECT NULL::BIGINT, FALSE, 'Loja inválida para este usuário';
        RETURN;
    END IF;

    IF jsonb_array_length(coalesce(p_itens, '[]'::JSONB)) = 0 THEN
        RETURN QUERY SELECT NULL::BIGINT, FALSE, 'O orçamento está vazio';
        RETURN;
    END IF;

    IF p_cliente_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.clientes c
            WHERE c.id = p_cliente_id AND c.loja_id = p_loja_id
        ) THEN
            RETURN QUERY SELECT NULL::BIGINT, FALSE, 'Cliente inválido para esta loja';
            RETURN;
        END IF;
    END IF;

    INSERT INTO public.orcamentos (loja_id, cliente_id, status, criado_por)
    VALUES (p_loja_id, p_cliente_id, 'rascunho', p_criado_por)
    RETURNING id INTO v_orcamento_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_qtd := greatest(1, coalesce((v_item->>'quantidade')::INT, 1));
        v_preco := greatest(0, coalesce((v_item->>'preco_unitario')::NUMERIC, 0));

        INSERT INTO public.orcamento_itens (
            orcamento_id,
            produto_id,
            descricao_avulsa,
            quantidade,
            preco_unitario
        ) VALUES (
            v_orcamento_id,
            nullif(v_item->>'produto_id', '')::INT,
            CASE WHEN nullif(v_item->>'produto_id', '') IS NULL
                THEN left(coalesce(v_item->>'descricao', 'Item'), 255)
                ELSE NULL
            END,
            v_qtd,
            v_preco
        );
    END LOOP;

    IF p_cliente_id IS NOT NULL THEN
        UPDATE public.clientes
        SET ultima_compra_em = now()
        WHERE id = p_cliente_id AND loja_id = p_loja_id;
    END IF;

    RETURN QUERY SELECT v_orcamento_id, TRUE, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    -- Rollback automático da transação
    RETURN QUERY SELECT NULL::BIGINT, FALSE, SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_orcamento(BIGINT, BIGINT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_orcamento(BIGINT, BIGINT, UUID, JSONB) TO authenticated;
