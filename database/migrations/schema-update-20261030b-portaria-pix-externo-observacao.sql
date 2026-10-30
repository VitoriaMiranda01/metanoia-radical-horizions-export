-- Portaria: Pix externo exige observacao (30/10/2026, pedido do Patrick).
--
-- Quem recebe por Pix externo precisa anotar o que conferiu (data, hora e valor
-- do comprovante). Basta nao estar vazia. Dinheiro e cartao seguem com
-- observacao opcional. portaria_dar_baixa ganha p_observacao; o texto vai para
-- portaria_observacoes (o mesmo campo "Observacao" do cartao da pessoa), e se ja
-- houver uma observacao a nova entra embaixo dela.
-- Assinatura nova (6 parametros): a antiga (5) e removida.
do $mig$
declare
  v text;
begin
  v := pg_get_functiondef('public.portaria_dar_baixa(text, uuid, text, numeric, boolean)'::regprocedure);

  if position($a$p_liberar_entrada boolean DEFAULT false)$a$ in v) = 0
     or position($a$  v_n      int;$a$ in v) = 0
     or position($a$  select status_pagamento, nome into v_status, v_nome$a$ in v) = 0
     or position($a$values (v_quem, 'baixa', 'equipante', p_id, v_nome, v_meio, v_valor);$a$ in v) = 0 then
    raise exception 'portaria_dar_baixa: trecho nao encontrado';
  end if;

  v := replace(v, $a$p_liberar_entrada boolean DEFAULT false)$a$,
                  $b$p_liberar_entrada boolean DEFAULT false, p_observacao text DEFAULT NULL)$b$);
  v := replace(v, $a$  v_n      int;$a$,
                  $b$  v_n      int;
  v_obs    text := left(nullif(btrim(coalesce(p_observacao, '')), ''), 500);$b$);
  v := replace(v, $a$  select status_pagamento, nome into v_status, v_nome$a$,
                  $b$  if v_meio = 'pix' and v_obs is null then
    return jsonb_build_object('ok', false, 'erro',
      'No Pix externo, anote na observação a data, a hora e o valor que você conferiu no comprovante.');
  end if;

  select status_pagamento, nome into v_status, v_nome$b$);
  v := replace(v, $a$values (v_quem, 'baixa', 'equipante', p_id, v_nome, v_meio, v_valor);$a$,
                  $b$values (v_quem, 'baixa', 'equipante', p_id, v_nome, v_meio, v_valor);

    if v_obs is not null then
      insert into public.portaria_observacoes (tipo, inscricao_id, texto, atualizado_em, atualizado_por)
      values ('equipante', p_id, v_obs, now(), v_quem)
      on conflict (tipo, inscricao_id) do update
        set texto = left(portaria_observacoes.texto || E'\n' || excluded.texto, 500),
            atualizado_em = now(), atualizado_por = excluded.atualizado_por;
    end if;$b$);

  drop function public.portaria_dar_baixa(text, uuid, text, numeric, boolean);
  execute v;
end
$mig$;

revoke all on function public.portaria_dar_baixa(text, uuid, text, numeric, boolean, text) from public, anon;
grant execute on function public.portaria_dar_baixa(text, uuid, text, numeric, boolean, text) to authenticated;
