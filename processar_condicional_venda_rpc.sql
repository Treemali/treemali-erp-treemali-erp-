-- ══════════════════════════════════════════════════════════════════
-- TREEMALI ERP — RPC: processar_condicional_venda
-- Processa a conversão de uma condicional em venda de forma ATÔMICA.
-- Tudo acontece dentro de uma única transação: se qualquer passo
-- falhar, NADA é gravado (rollback automático).
--
-- Rode este script no Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION processar_condicional_venda(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venda_id        bigint;
  v_item            jsonb;
  v_condicional_id  bigint;
  v_novo_status     text;
  v_usuario_id      bigint;
  v_venda           jsonb;
  v_vendidos        jsonb;
  v_devolvidos      jsonb;
BEGIN
  -- Extrai os blocos do payload
  v_venda           := payload->'venda';
  v_vendidos        := COALESCE(payload->'vendidos',  '[]'::jsonb);
  v_devolvidos      := COALESCE(payload->'devolvidos','[]'::jsonb);
  v_novo_status     := payload->>'novo_status';
  v_condicional_id  := (v_venda->>'condicional_id')::bigint;
  v_usuario_id      := NULLIF(payload->>'usuario_id', 'null')::bigint;

  -- ── 1. Cria a venda (somente se houver itens vendidos) ──────────
  IF jsonb_array_length(v_vendidos) > 0 THEN

    INSERT INTO vendas (
      cliente_id, vendedor_id, tipo, forma_pagamento,
      parcelas, bandeira_id, valor_total, origem,
      condicional_id, status
    ) VALUES (
      (v_venda->>'cliente_id')::bigint,
      NULLIF(v_venda->>'vendedor_id', 'null')::bigint,
      'normal',
      v_venda->>'forma_pagamento',
      COALESCE(NULLIF(v_venda->>'parcelas','null')::int, 1),
      NULLIF(v_venda->>'bandeira_id', 'null')::bigint,
      (v_venda->>'total')::numeric,
      'condicional',
      v_condicional_id,
      'concluida'
    )
    RETURNING id INTO v_venda_id;

    -- ── 2. Insere itens_venda em lote ───────────────────────────
    INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unit, subtotal)
    SELECT
      v_venda_id,
      (item->>'produto_id')::bigint,
      (item->>'qtd_venda')::int,
      (item->>'preco_unit')::numeric,
      (item->>'preco_unit')::numeric * (item->>'qtd_venda')::int
    FROM jsonb_array_elements(v_vendidos) AS item;

    -- ── 3. Atualiza itens_condicional + estoque + movimentação ──
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_vendidos) LOOP

      UPDATE itens_condicional
        SET status = 'vendido',
            quantidade_atual = (v_item->>'qtd_venda')::int
        WHERE id = (v_item->>'item_cond_id')::bigint;

      UPDATE produtos
        SET estoque_atual = GREATEST(0, estoque_atual - (v_item->>'qtd_venda')::int),
            updated_at    = now()
        WHERE id = (v_item->>'produto_id')::bigint;

      INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, referencia, usuario_id)
      VALUES (
        (v_item->>'produto_id')::bigint,
        'saida_venda',
        (v_item->>'qtd_venda')::int,
        'Venda #' || v_venda_id || ' (Condicional #' || v_condicional_id || ')',
        v_usuario_id
      );

    END LOOP;
  END IF;

  -- ── 4. Processa devoluções ──────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_devolvidos) LOOP

    UPDATE itens_condicional
      SET status = 'devolvido',
          quantidade_atual = 0
      WHERE id = (v_item->>'item_cond_id')::bigint;

    UPDATE produtos
      SET estoque_atual = estoque_atual + (v_item->>'qtd_devolver')::int,
          updated_at    = now()
      WHERE id = (v_item->>'produto_id')::bigint;

    INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, referencia, usuario_id)
    VALUES (
      (v_item->>'produto_id')::bigint,
      'retorno_condicional',
      (v_item->>'qtd_devolver')::int,
      'Retorno condicional #' || v_condicional_id || ' (Conversão Venda)',
      v_usuario_id
    );

  END LOOP;

  -- ── 5. Atualiza status da condicional ──────────────────────────
  UPDATE condicionais
    SET status     = v_novo_status,
        updated_at = now(),
        venda_id   = CASE WHEN v_venda_id IS NOT NULL THEN v_venda_id ELSE venda_id END
    WHERE id = v_condicional_id;

  -- ── 6. Histórico ───────────────────────────────────────────────
  INSERT INTO historico_condicional (condicional_id, acao, descricao, usuario_id)
  VALUES (
    v_condicional_id,
    v_novo_status,
    payload->>'descricao_historico',
    v_usuario_id
  );

  RETURN jsonb_build_object(
    'venda_id',  v_venda_id,
    'status',    v_novo_status,
    'ok',        true
  );

EXCEPTION WHEN OTHERS THEN
  -- Rollback automático — retorna o erro para o JS tratar
  RAISE EXCEPTION '%', SQLERRM;
END;
$$;
