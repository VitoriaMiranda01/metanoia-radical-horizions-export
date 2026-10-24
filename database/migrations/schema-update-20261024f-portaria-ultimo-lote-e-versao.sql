-- ---------------------------------------------------------------------------
-- Portaria: ultimo lote + lista sempre atualizada (Patrick, 24/10/2026)
--
-- 1. "A portaria so abre nos dias do evento, entao sempre sera no ultimo
--    lote": o valor sugerido no "Pagar agora" vem do lote de data final mais
--    tarde (nao do lote de hoje), com o desconto automatico de pastor/
--    infiltrado por cima, como antes.
--
-- 2. Depois da escala oficial ha trocas de area (inclusive infiltrado com
--    alguem de outra area), e a portaria precisa ver a troca na hora. A lista
--    ja e calculada da escala a cada chamada, mas tem ~400 KB: em vez de
--    baixa-la a cada poucos segundos no celular, a tela pergunta a cada 5 s
--    portaria_versao() -- uma "assinatura" curta da escala, dos pagamentos,
--    das entradas e das observacoes -- e so recarrega quando ela muda.
-- ---------------------------------------------------------------------------

create or replace function public._valor_ultimo_lote(p_tipo text)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_periodos jsonb;
  v_item     jsonb;
  v_fim      date;
  v_melhor   date;
  v_valor    numeric;
begin
  select case when p_tipo = 'equipante' then c.equipante_pricing_periods
              else c.acampante_pricing_periods end
    into v_periodos
    from public.configuracoes c
   limit 1;

  if v_periodos is null or jsonb_typeof(v_periodos) <> 'array' then
    return null;
  end if;

  for v_item in select * from jsonb_array_elements(v_periodos) loop
    begin
      v_fim := to_date(v_item ->> 'end_date', 'DD/MM/YYYY');
    exception when others then
      continue;  -- periodo com data mal formada: ignora
    end;
    if v_melhor is null or v_fim > v_melhor then
      v_melhor := v_fim;
      v_valor := nullif(btrim(v_item ->> 'value'), '')::numeric;
    end if;
  end loop;

  return v_valor;
end;
$fn$;
revoke all on function public._valor_ultimo_lote(text) from public, anon, authenticated;

do $$
declare v_def text := pg_get_functiondef('public.portaria_valor_previsto(text, uuid)'::regprocedure);
begin
  if position('v_preco := public._valor_do_lote(p_tipo);' in v_def) = 0 then
    raise exception 'portaria_valor_previsto: trecho não encontrado';
  end if;
  execute replace(v_def, 'v_preco := public._valor_do_lote(p_tipo);',
                         'v_preco := public._valor_ultimo_lote(p_tipo);');
end $$;

-- Assinatura do que a lista mostra. Muda quando muda: area/cor/atuacao de
-- alguem, pagamento (PIX, em maos, isencao, desfazer), entrada, observacao.
create or replace function public.portaria_versao()
returns text
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select case when public._portaria_quem() is null then null else md5(concat_ws('|',
    (select string_agg(s.id::text || s.equipante_id::text || s.area_alocada || coalesce(s.cor, '') || coalesce(s.atuacao, ''),
                       ',' order by s.id) from public.escalas s),
    (select count(*) || ':' || coalesce(max(e.data_pagamento)::text, '') || ':' || coalesce(max(e.pagamento_desfeito_em)::text, '')
       from public.equipantes e
      where e.tipo = 'equipante' and lower(coalesce(e.status_pagamento, '')) in ('confirmado', 'pago', 'completed')),
    (select count(*) || ':' || coalesce(max(en.entrou_em)::text, '') from public.portaria_entradas en),
    (select coalesce(max(r.id), 0)::text from public.portaria_registros r),
    (select count(*) || ':' || coalesce(max(o.atualizado_em)::text, '') from public.portaria_observacoes o),
    (select count(*)::text from public.equipantes e where e.tipo = 'equipante')
  )) end;
$fn$;
revoke all on function public.portaria_versao() from public, anon;
grant execute on function public.portaria_versao() to authenticated;
