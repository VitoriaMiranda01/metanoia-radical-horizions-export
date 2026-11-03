-- 20261103c: virada de edicao com as datas do projeto + aprovacao so de quem
-- se inscreveu na edicao.
--
-- Teste da virada no ambiente de teste (03/11/2026, Patrick):
--
--  1. Depois da virada, os 1000 equipantes da edicao 37 voltaram a
--     status = 'pendente' com inscrito = false (correto: a ficha fica, a
--     pessoa faz uma inscricao nova trazendo os dados pelo CPF). Mas a
--     Aprovacao, o contador do menu, a aprovacao em lote e o resumo antes da
--     escala oficial contavam todo "pendente" -- 1000 pessoas que nem se
--     reinscreveram apareciam para aprovar. Agora so conta/aprova quem tem
--     inscrito = true. Antes da virada isso nao aparecia porque todos com
--     status estavam inscritos (copia do oficial de 13/10: 0 com inscrito
--     false), entao no oficial nada muda hoje.
--
--  2. A virada nao mexia nas datas: a home da edicao 38 mostrava as datas da
--     37. Decisao do Patrick: as datas da edicao velha sao APAGADAS; a janela
--     da virada pede as datas do projeto (inicio, fim, limite de inscricao,
--     reunioes), todas opcionais ("informar depois"). Os periodos de preco
--     (lotes) de equipante e acampante ficam com o VALOR e perdem as datas
--     (start_date/end_date = null): sem data nenhum lote vale, entao a tela
--     mostra "Valores indisponiveis" e o servidor recusa a cobranca ate a
--     organizacao preencher as datas novas.
--     As reunioes deixam de ser obrigatorias na virada (eram desde 16/10).
--     Antes de apagar, a edicao velha e registrada na LGPD (lgpd_edicoes)
--     se ainda nao estiver -- o prazo de apagamento conta do fim dela.
--
-- Patch nas funcoes existentes (pg_get_functiondef + replace), com erro se o
-- trecho nao bater.

do $$
declare
  v_def  text;
  v_novo text;
begin
  -- 1a. contadores_do_menu
  v_def := pg_get_functiondef('public.contadores_do_menu()'::regprocedure);
  v_novo := replace(v_def,
    $a$select count(*) from public.equipantes where lower(coalesce(status, '')) = 'pendente'$a$,
    $a$select count(*) from public.equipantes where lower(coalesce(status, '')) = 'pendente' and inscrito is true$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em contadores_do_menu'; end if;
  execute v_novo;

  -- 1b. resumo_antes_da_oficial (aguardando e a_escalar)
  v_def := pg_get_functiondef('public.resumo_antes_da_oficial()'::regprocedure);
  v_novo := replace(v_def,
    $a$from public.equipantes q where q.tipo = 'equipante' and q.status = 'pendente')$a$,
    $a$from public.equipantes q where q.tipo = 'equipante' and q.status = 'pendente' and q.inscrito is true)$a$);
  if v_novo = v_def then raise exception 'trecho 1 não encontrado em resumo_antes_da_oficial'; end if;
  v_def := v_novo;
  v_novo := replace(v_def,
    $a$where q.tipo = 'equipante' and q.status = 'aprovado' and q.so_domingo is not true$a$,
    $a$where q.tipo = 'equipante' and q.status = 'aprovado' and q.inscrito is true and q.so_domingo is not true$a$);
  if v_novo = v_def then raise exception 'trecho 2 não encontrado em resumo_antes_da_oficial'; end if;
  execute v_novo;

  -- 1c. aprovar_em_lote
  v_def := pg_get_functiondef('public.aprovar_em_lote(uuid[],text,text)'::regprocedure);
  v_novo := replace(v_def,
    $a$where e.id = any(v_ids) and e.tipo = 'equipante' and e.status = 'pendente'$a$,
    $a$where e.id = any(v_ids) and e.tipo = 'equipante' and e.status = 'pendente' and e.inscrito is true$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em aprovar_em_lote'; end if;
  execute v_novo;

  -- 1d. decidir_inscricao: nao aprova/rejeita quem nao se inscreveu
  v_def := pg_get_functiondef('public.decidir_inscricao(uuid,text)'::regprocedure);
  v_novo := replace(v_def,
    $a$    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
$a$,
    $a$    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  -- 20261103c: ficha de edicao anterior (inscrito = false) nao e inscricao.
  if v_alvo.inscrito is not true and v_status <> 'pendente' then
    return jsonb_build_object('ok', false, 'erro',
      'Esta pessoa ainda não se inscreveu nesta edição.');
  end if;
$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em decidir_inscricao'; end if;
  execute v_novo;

  -- 2. resetar_para_nova_edicao: datas opcionais, datas velhas apagadas
  v_def := pg_get_functiondef('public.resetar_para_nova_edicao(integer,date,date)'::regprocedure);

  v_novo := replace(v_def,
    $a$public.resetar_para_nova_edicao(p_nova_edicao integer, p_reuniao_inscricao date, p_reuniao_leitura date)$a$,
    $a$public.resetar_para_nova_edicao(p_nova_edicao integer, p_reuniao_inscricao date DEFAULT NULL::date, p_reuniao_leitura date DEFAULT NULL::date, p_evento_inicio date DEFAULT NULL::date, p_evento_fim date DEFAULT NULL::date, p_limite_inscricao date DEFAULT NULL::date)$a$);
  if v_novo = v_def then raise exception 'cabeçalho não encontrado em resetar_para_nova_edicao'; end if;
  v_def := v_novo;

  v_novo := replace(v_def,
    $a$  if p_reuniao_inscricao is null or p_reuniao_leitura is null then
    return jsonb_build_object('ok', false, 'erro',
      'Informe as datas da Reunião de Inscrição e da Reunião de Leitura de Escala da nova edição.');
  end if;
$a$,
    $a$  -- 20261103c: as datas da edicao nova sao opcionais ("informar depois").
  if p_evento_inicio is not null and p_evento_fim is not null and p_evento_fim < p_evento_inicio then
    return jsonb_build_object('ok', false, 'erro',
      'A data de fim do evento não pode ser antes da data de início.');
  end if;
$a$);
  if v_novo = v_def then raise exception 'trava das reuniões não encontrada em resetar_para_nova_edicao'; end if;
  v_def := v_novo;

  v_novo := replace(v_def,
    $a$  update public.configuracoes set
    edicao_numero          = p_nova_edicao,$a$,
    $a$  -- 20261103c: a edicao que acaba entra na LGPD antes de a data sumir.
  insert into public.lgpd_edicoes (numero, evento_fim)
  select c.edicao_numero, c.data_evento_fim
    from public.configuracoes c
   where c.edicao_numero is not null and c.data_evento_fim is not null
   limit 1
  on conflict (numero) do nothing;

  update public.configuracoes set
    data_evento_inicio     = p_evento_inicio,
    data_evento_fim        = p_evento_fim,
    data_limite_inscricao_pagamento = p_limite_inscricao,
    -- lotes: fica o valor, saem as datas (20261103c)
    equipante_pricing_periods = (
      select coalesce(jsonb_agg(x || jsonb_build_object('start_date', null, 'end_date', null)), '[]'::jsonb)
        from jsonb_array_elements(case when jsonb_typeof(equipante_pricing_periods) = 'array'
                                       then equipante_pricing_periods else '[]'::jsonb end) x),
    acampante_pricing_periods = (
      select coalesce(jsonb_agg(x || jsonb_build_object('start_date', null, 'end_date', null)), '[]'::jsonb)
        from jsonb_array_elements(case when jsonb_typeof(acampante_pricing_periods) = 'array'
                                       then acampante_pricing_periods else '[]'::jsonb end) x),
    edicao_numero          = p_nova_edicao,$a$);
  if v_novo = v_def then raise exception 'update de configuracoes não encontrado em resetar_para_nova_edicao'; end if;

  drop function public.resetar_para_nova_edicao(integer, date, date);
  execute v_novo;
end $$;

revoke all on function public.resetar_para_nova_edicao(integer, date, date, date, date, date) from public, anon;
grant execute on function public.resetar_para_nova_edicao(integer, date, date, date, date, date) to authenticated;
