-- ---------------------------------------------------------------------------
-- Portaria: so equipantes + controle de entrada (Patrick, 24/10/2026)
--
-- Ajuste da 20261024b/c depois de o Patrick ver a tela:
--  * a portaria e SO para equipantes (acampante saiu da lista e de todas as
--    funcoes da portaria);
--  * o que a tela controla e a ENTRADA: quem ja pagou (ou e isento) recebe a
--    pulseira e a portaria marca "Liberar entrada" -> vai para "Ja entrou";
--  * quem nao pagou usa "Pagar agora" (dinheiro/cartao) e, no mesmo passo, ja
--    pode liberar a entrada;
--  * a lista traz a area (e a cor) de cada equipante, para pesquisar por nome,
--    igreja ou area.
--
-- Entrada em portaria_entradas (uma por equipante). Liberar e desfazer ficam
-- tambem em portaria_registros. Pagamento feito na portaria so pode ser
-- desfeito depois de desfazer a entrada.
-- ---------------------------------------------------------------------------

create table if not exists public.portaria_entradas (
  equipante_id uuid primary key,
  entrou_em    timestamptz not null default now(),
  liberado_por text not null
);
alter table public.portaria_entradas enable row level security;
revoke all on table public.portaria_entradas from anon, authenticated;

alter table public.portaria_registros drop constraint if exists portaria_registros_acao_check;
alter table public.portaria_registros add constraint portaria_registros_acao_check
  check (acao in ('baixa', 'desfeita', 'entrada', 'entrada_desfeita'));

-- Lista: so equipantes da escala (ou que ja pagaram) ---------------------------
create or replace function public.portaria_lista()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if public._portaria_quem() is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;

  return jsonb_build_object('ok', true, 'pessoas', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tipo', 'equipante',
             'id', e.id,
             'nome', e.nome,
             'igreja', case when e.igreja = 'OUTRA' then coalesce(nullif(btrim(e.igreja_outra), ''), 'OUTRA')
                            else nullif(btrim(e.igreja), '') end,
             'areas', coalesce((
               select jsonb_agg(distinct s.area_alocada || coalesce(' · ' || nullif(btrim(s.cor), ''), ''))
                 from public.escalas s
                where s.equipante_id = e.id and s.area_alocada <> 'Não será escalado'), '[]'::jsonb),
             'na_escala', public._equipante_na_escala(e.id),
             'pago', lower(coalesce(e.status_pagamento, '')) in ('confirmado', 'pago', 'completed'),
             'metodo', lower(coalesce(e.metodo_pagamento, '')),
             'meio', e.pagamento_meio,
             'valor', e.pagamento_valor,
             'data_pagamento', e.data_pagamento,
             'confirmado_por', e.pagamento_confirmado_por,
             'entrou_em', en.entrou_em,
             'entrada_por', en.liberado_por,
             'observacao', o.texto,
             'observacao_por', o.atualizado_por,
             'observacao_em', o.atualizado_em)
           order by e.nome)
      from public.equipantes e
      left join public.portaria_entradas en on en.equipante_id = e.id
      left join public.portaria_observacoes o on o.tipo = 'equipante' and o.inscricao_id = e.id
     where e.tipo = 'equipante'
       and (public._equipante_na_escala(e.id)
            or lower(coalesce(e.status_pagamento, '')) in ('confirmado', 'pago', 'completed'))), '[]'::jsonb));
end;
$fn$;

-- Valor sugerido: so equipante ----------------------------------------------------
do $$
declare v_def text := pg_get_functiondef('public.portaria_valor_previsto(text, uuid)'::regprocedure);
begin
  if position('if p_tipo not in (''acampante'', ''equipante'') then' in v_def) = 0 then
    raise exception 'portaria_valor_previsto: trecho não encontrado';
  end if;
  execute replace(v_def,
    'if p_tipo not in (''acampante'', ''equipante'') then',
    'if p_tipo is distinct from ''equipante'' then');
end $$;

-- Observacao: so equipante --------------------------------------------------------
do $$
declare v_def text := pg_get_functiondef('public.portaria_salvar_observacao(text, uuid, text)'::regprocedure);
begin
  if position('if p_tipo not in (''acampante'', ''equipante'') then' in v_def) = 0 then
    raise exception 'portaria_salvar_observacao: trecho não encontrado';
  end if;
  execute replace(v_def,
    'if p_tipo not in (''acampante'', ''equipante'') then',
    'if p_tipo is distinct from ''equipante'' then');
end $$;

-- Pagar agora (so equipante; pode liberar a entrada no mesmo passo) -------------
drop function if exists public.portaria_dar_baixa(text, uuid, text, numeric);

create or replace function public.portaria_dar_baixa(p_tipo text, p_id uuid, p_meio text, p_valor numeric,
                                                     p_liberar_entrada boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem   text := public._portaria_quem();
  v_meio   text := nullif(lower(btrim(coalesce(p_meio, ''))), '');
  v_valor  numeric := round(p_valor, 2);
  v_status text;
  v_nome   text;
  v_n      int;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if p_tipo is distinct from 'equipante' then
    return jsonb_build_object('ok', false, 'erro', 'A portaria é só para equipantes.');
  end if;
  if v_meio is null or v_meio not in ('dinheiro', 'cartao') then
    return jsonb_build_object('ok', false, 'erro', 'Escolha se o pagamento foi em dinheiro ou cartão.');
  end if;
  if v_valor is null or v_valor <= 0 or v_valor > 5000 then
    return jsonb_build_object('ok', false, 'erro', 'Informe o valor recebido (maior que zero).');
  end if;

  select status_pagamento, nome into v_status, v_nome
    from public.equipantes where id = p_id and tipo = 'equipante' for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if lower(coalesce(v_status, '')) in ('confirmado', 'pago', 'completed') then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição já está paga.');
  end if;
  -- A portaria so recebe de equipante que esta na escala (mesma regra do PIX).
  if not public._equipante_na_escala(p_id) then
    return jsonb_build_object('ok', false, 'erro',
      'Este equipante não está na escala. Peça para ele procurar a organização.');
  end if;

  update public.equipantes set
    status_pagamento = 'confirmado', metodo_pagamento = 'manual', data_pagamento = now(),
    pagamento_valor = v_valor, pagamento_cupom = null, pagamento_desconto = null,
    pagamento_confirmado_por = v_quem, pagamento_meio = v_meio,
    pagamento_observacao = 'Baixa na portaria'
   where id = p_id and tipo = 'equipante';
  get diagnostics v_n = row_count;

  if v_n = 1 then
    insert into public.portaria_registros (quem, acao, tipo, inscricao_id, nome, meio, valor)
    values (v_quem, 'baixa', 'equipante', p_id, v_nome, v_meio, v_valor);

    if p_liberar_entrada then
      insert into public.portaria_entradas (equipante_id, entrou_em, liberado_por)
      values (p_id, now(), v_quem)
      on conflict (equipante_id) do nothing;
      if found then
        insert into public.portaria_registros (quem, acao, tipo, inscricao_id, nome)
        values (v_quem, 'entrada', 'equipante', p_id, v_nome);
      end if;
    end if;
  end if;

  return jsonb_build_object('ok', v_n = 1, 'nome', v_nome, 'confirmado_por', v_quem,
                            'valor', v_valor, 'meio', v_meio,
                            'entrada_liberada', coalesce(p_liberar_entrada, false) and v_n = 1);
end;
$fn$;
revoke all on function public.portaria_dar_baixa(text, uuid, text, numeric, boolean) from public, anon;
grant execute on function public.portaria_dar_baixa(text, uuid, text, numeric, boolean) to authenticated;

-- Desfazer pagamento da portaria (so equipante; precisa desfazer a entrada antes)
create or replace function public.portaria_desfazer_baixa(p_tipo text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem   text := public._portaria_quem();
  v_status text;
  v_metodo text;
  v_por    text;
  v_nome   text;
  v_meio   text;
  v_valor  numeric;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if p_tipo is distinct from 'equipante' then
    return jsonb_build_object('ok', false, 'erro', 'A portaria é só para equipantes.');
  end if;

  select status_pagamento, lower(coalesce(metodo_pagamento, '')), pagamento_confirmado_por, nome,
         pagamento_meio, pagamento_valor
    into v_status, v_metodo, v_por, v_nome, v_meio, v_valor
    from public.equipantes where id = p_id and tipo = 'equipante' for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if lower(coalesce(v_status, '')) not in ('confirmado', 'pago', 'completed') then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição não está como paga.');
  end if;
  if v_metodo <> 'manual' or coalesce(v_por, '') not like 'Portaria: %' then
    return jsonb_build_object('ok', false, 'erro',
      'Só dá para desfazer pagamento feito na portaria. Este pagamento é com a organização.');
  end if;
  if exists (select 1 from public.portaria_entradas where equipante_id = p_id) then
    return jsonb_build_object('ok', false, 'erro',
      'Esta pessoa já entrou. Desfaça a entrada antes de desfazer o pagamento.');
  end if;

  update public.equipantes set
    status_pagamento = 'pendente', data_pagamento = null,
    pagamento_valor = null, pagamento_cupom = null, pagamento_desconto = null,
    pagamento_confirmado_por = null, pagamento_meio = null, pagamento_observacao = null,
    pagamento_desfeito_em = now(), pagamento_desfeito_por = v_quem
   where id = p_id and tipo = 'equipante';

  insert into public.portaria_registros (quem, acao, tipo, inscricao_id, nome, meio, valor)
  values (v_quem, 'desfeita', 'equipante', p_id, v_nome, v_meio, v_valor);

  return jsonb_build_object('ok', true, 'nome', v_nome, 'desfeito_por', v_quem);
end;
$fn$;

-- Liberar a entrada (entrega da pulseira): so quem ja pagou ou e isento ---------
create or replace function public.portaria_liberar_entrada(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem   text := public._portaria_quem();
  v_status text;
  v_nome   text;
  v_ja     public.portaria_entradas%rowtype;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;

  select status_pagamento, nome into v_status, v_nome
    from public.equipantes where id = p_id and tipo = 'equipante' for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if lower(coalesce(v_status, '')) not in ('confirmado', 'pago', 'completed') then
    return jsonb_build_object('ok', false, 'erro',
      'O pagamento ainda está em aberto. Use "Pagar agora" antes de liberar a entrada.');
  end if;

  select * into v_ja from public.portaria_entradas where equipante_id = p_id;
  if v_ja.equipante_id is not null then
    return jsonb_build_object('ok', false, 'erro',
      format('Já entrou em %s (%s).',
             to_char(v_ja.entrou_em at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
             v_ja.liberado_por));
  end if;

  insert into public.portaria_entradas (equipante_id, entrou_em, liberado_por)
  values (p_id, now(), v_quem);
  insert into public.portaria_registros (quem, acao, tipo, inscricao_id, nome)
  values (v_quem, 'entrada', 'equipante', p_id, v_nome);

  return jsonb_build_object('ok', true, 'nome', v_nome, 'liberado_por', v_quem);
end;
$fn$;
revoke all on function public.portaria_liberar_entrada(uuid) from public, anon;
grant execute on function public.portaria_liberar_entrada(uuid) to authenticated;

-- Desfazer a entrada (engano) -----------------------------------------------------
create or replace function public.portaria_desfazer_entrada(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem text := public._portaria_quem();
  v_nome text;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;

  delete from public.portaria_entradas where equipante_id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está como "já entrou".');
  end if;

  select nome into v_nome from public.equipantes where id = p_id;
  insert into public.portaria_registros (quem, acao, tipo, inscricao_id, nome)
  values (v_quem, 'entrada_desfeita', 'equipante', p_id, v_nome);

  return jsonb_build_object('ok', true, 'nome', v_nome);
end;
$fn$;
revoke all on function public.portaria_desfazer_entrada(uuid) from public, anon;
grant execute on function public.portaria_desfazer_entrada(uuid) to authenticated;
