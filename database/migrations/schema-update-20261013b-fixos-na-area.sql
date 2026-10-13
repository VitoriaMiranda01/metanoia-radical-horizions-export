-- ---------------------------------------------------------------------------
-- Fixos na area (Patrick, 13/10/2026).
--
-- O "core" de cada area -- gente de confianca que quase nunca muda -- fica
-- marcado com um alfinete (📌). A marca mora na FICHA do equipante (a linha
-- de equipantes atravessa as edicoes), nao na escala: a virada de edicao apaga
-- a escala, mas os fixos continuam marcados.
--
-- Regras combinadas:
--  * So Raquel, Dudu e Desenvolvedores marcam/desmarcam (_gere_escala).
--  * Uma pessoa pode ser fixa em mais de uma area.
--  * "Alocar automático" ganha a PASSADA ZERO: todo aprovado que esta na fila
--    vai para as suas areas fixas antes de qualquer outra pessoa, sem olhar as
--    3 opcoes da inscricao e passando na frente do limite da area ("os outros
--    e que sao remanejados"). Quem ja esta escalado nao e tocado, como sempre.
--  * Fixar alguem numa area em que ele ainda nao esta ja coloca a pessoa la.
--  * "Desfazer alocação automática" nunca tira um fixo da sua area fixa.
--  * "Limpar área": tira todo mundo de uma area (fixos inclusive -- a marca
--    fica, e o proximo automatico os devolve). So antes de lancar a escala.
-- ---------------------------------------------------------------------------

create table if not exists public.equipantes_areas_fixas (
  equipante_id uuid not null references public.equipantes(id) on delete cascade,
  area         text not null,
  marcado_por  text,
  marcado_em   timestamptz not null default now(),
  primary key (equipante_id, area)
);

alter table public.equipantes_areas_fixas enable row level security;
revoke all on public.equipantes_areas_fixas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lista dos fixos (qualquer organizador ve o alfinete).
-- ---------------------------------------------------------------------------
create or replace function public.areas_fixas()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador() then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'equipante_id', f.equipante_id,
             'area',         f.area,
             'nome',         q.nome,
             'status',       q.status,
             'inscrito',     q.inscrito,
             'marcado_por',  f.marcado_por)
           order by f.area, q.nome)
      from public.equipantes_areas_fixas f
      join public.equipantes q on q.id = f.equipante_id
  ), '[]'::jsonb);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Marcar / desmarcar
-- ---------------------------------------------------------------------------
create or replace function public.marcar_area_fixa(p_equipante_id uuid, p_area text, p_fixo boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_area     text := public._area_canonica(p_area);
  v_status   text;
  v_especial text;
  v_alocado  boolean := false;
  v_aviso    text;
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro',
      'Só Desenvolvedores, Raquel e Dudu podem marcar alguém como fixo.');
  end if;

  if v_area is null or not exists (select 1 from public.limites_areas l where l.area_nome = v_area) then
    return jsonb_build_object('ok', false, 'erro', 'Área inválida.');
  end if;

  select q.status into v_status
    from public.equipantes q where q.id = p_equipante_id and q.tipo = 'equipante';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Equipante não encontrado.');
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  if not coalesce(p_fixo, false) then
    delete from public.equipantes_areas_fixas
     where equipante_id = p_equipante_id and area = v_area;
    return jsonb_build_object('ok', true, 'fixo', false, 'area', v_area);
  end if;

  insert into public.equipantes_areas_fixas (equipante_id, area, marcado_por)
  values (p_equipante_id, v_area, public._nome_organizador_logado())
  on conflict (equipante_id, area) do nothing;

  if v_status = 'aprovado'
     and not exists (select 1 from public.escalas e
                      where e.equipante_id = p_equipante_id and e.area_alocada = v_area) then
    if public._area_especial(v_area) then
      select e.area_alocada into v_especial
        from public.escalas e
       where e.equipante_id = p_equipante_id and public._area_especial(e.area_alocada)
       limit 1;
    end if;

    if v_especial is not null then
      v_aviso := format('Ficou marcado, mas não entrou em %s agora: já está em %s, e cada pessoa só pode ter um dos papéis especiais.',
                        v_area, v_especial);
    else
      insert into public.escalas (equipante_id, area_alocada, atuacao)
      values (p_equipante_id, v_area, public._atuacao_padrao(v_area));
      update public.equipantes set scale_status = 'ok' where id = p_equipante_id;
      v_alocado := true;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'fixo', true, 'area', v_area,
                            'alocado', v_alocado, 'aviso', v_aviso);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Limpar area: tira todo mundo de uma area.
-- ---------------------------------------------------------------------------
create or replace function public.limpar_area(p_area text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_area   text := public._area_canonica(p_area);
  v_ids    uuid[];
  v_fila   int;
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro',
      'Só Desenvolvedores, Raquel e Dudu podem limpar uma área.');
  end if;
  if (select escala_lancada_em from public.configuracoes limit 1) is not null then
    return jsonb_build_object('ok', false, 'erro',
      'A escala provisória já foi lançada: não dá mais para limpar a área de uma vez. Tire as pessoas uma a uma.');
  end if;
  if v_area is null then
    return jsonb_build_object('ok', false, 'erro', 'Área não informada.');
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  with apagados as (
    delete from public.escalas e where e.area_alocada = v_area
    returning e.equipante_id
  )
  select coalesce(array_agg(equipante_id), '{}') into v_ids from apagados;

  with voltaram as (
    update public.equipantes q set scale_status = 'pendente'
     where q.id = any(v_ids)
       and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
    returning q.id
  )
  select count(*) into v_fila from voltaram;

  return jsonb_build_object('ok', true, 'area', v_area,
                            'removidos', coalesce(array_length(v_ids, 1), 0),
                            'voltaram_fila', v_fila);
end;
$fn$;

revoke all on function public.areas_fixas()                          from public, anon;
revoke all on function public.marcar_area_fixa(uuid, text, boolean)  from public, anon;
revoke all on function public.limpar_area(text)                      from public, anon;
grant execute on function public.areas_fixas()                         to authenticated;
grant execute on function public.marcar_area_fixa(uuid, text, boolean) to authenticated;
grant execute on function public.limpar_area(text)                     to authenticated;

-- ---------------------------------------------------------------------------
-- Alocar automatico: passada zero dos fixos + as passadas de sempre.
-- ---------------------------------------------------------------------------
create or replace function public.alocar_fila_automaticamente()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_pessoa   record;
  v_area     text;
  v_destino  text;
  v_vaga     record;
  v_por_opcao int[] := array[0, 0, 0];
  v_coringa  int := 0;
  v_fixos    int := 0;
  v_fila     uuid[];
  v_areas_fixos text[] := '{}';
  v_passo    int;
  v_sobraram int;
  v_lote     uuid;
  v_escala   uuid;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas organizadores podem alocar pelas preferências.');
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  -- Passada zero: os fixos. Quem esta na fila vai para TODAS as suas areas
  -- fixas, antes de qualquer outra pessoa e sem olhar o limite. Nao entram no
  -- lote: o "Desfazer" nunca tira um fixo da area dele.
  select coalesce(array_agg(q.id), '{}') into v_fila
    from public.equipantes q
   where q.tipo = 'equipante'
     and q.status = 'aprovado'
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  for v_pessoa in
    select f.equipante_id as id, f.area
      from public.equipantes_areas_fixas f
      join public.equipantes q on q.id = f.equipante_id
     where f.equipante_id = any(v_fila)
       and exists (select 1 from public.limites_areas l where l.area_nome = f.area)
     order by q.nome, f.marcado_em
  loop
    continue when exists (select 1 from public.escalas e
                           where e.equipante_id = v_pessoa.id and e.area_alocada = v_pessoa.area);
    -- Um papel especial por pessoa (Guia, Inimigo, Espírito Santo...).
    continue when public._area_especial(v_pessoa.area) and exists (
      select 1 from public.escalas e
       where e.equipante_id = v_pessoa.id and public._area_especial(e.area_alocada));

    insert into public.escalas (equipante_id, area_alocada, atuacao)
    values (v_pessoa.id, v_pessoa.area, public._atuacao_padrao(v_pessoa.area));
    update public.equipantes set scale_status = 'ok' where id = v_pessoa.id;

    v_fixos := v_fixos + 1;
    if not v_pessoa.area = any(v_areas_fixos) then
      v_areas_fixos := v_areas_fixos || v_pessoa.area;
    end if;
  end loop;

  -- Passadas 1, 2 e 3: a opcao de mesmo numero, para todo mundo que ainda
  -- nao tem destino. A ordem dentro da passada vem de configuracoes.escala_ordem:
  -- 'aprovacao' (quem foi aprovado antes escolhe antes) ou 'cadastro' (quem se
  -- inscreveu antes escolhe antes); o nome so desempata.
  for v_passo in 1..3 loop
    for v_pessoa in
      select q.id, q.sexo,
             case v_passo
               when 1 then q.area_trabalho_opcao1
               when 2 then q.area_trabalho_opcao2
               else        q.area_trabalho_opcao3
             end as escolha
        from public.equipantes q
       where q.tipo = 'equipante'
         and q.status = 'aprovado'
         and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
       order by case when (select c.escala_ordem from public.configuracoes c limit 1) = 'cadastro'
                  then coalesce(q.inscrito_em, q.decidido_em, q.created_at)
                  else coalesce(q.decidido_em, q.created_at)
             end nulls last, q.nome
    loop
      v_area := public._area_canonica(v_pessoa.escolha);
      continue when v_area is null;

      -- "Disponível para qualquer área" fica para a ultima passada.
      continue when v_area = 'Disponível para qualquer área';

      -- Guia, Inimigo, Espírito Santo, Recepção, Secretaria e as demais que
      -- so a diretoria preenche.
      continue when exists (
        select 1 from public.limites_areas l
         where l.area_nome = v_area and l.somente_organizador);

      select * into v_vaga from public._equipante_area_tem_vaga(v_area, v_pessoa.sexo);
      continue when not v_vaga.tem_vaga;

      insert into public.escalas (equipante_id, area_alocada, atuacao)
      values (v_pessoa.id, v_area, public._atuacao_padrao(v_area))
      returning id into v_escala;
      update public.equipantes set scale_status = 'ok' where id = v_pessoa.id;

      if v_lote is null then
        insert into public.lotes_alocacao_automatica (feito_por)
        values (public._nome_organizador_logado()) returning id into v_lote;
      end if;
      insert into public.lotes_alocacao_automatica_itens (lote_id, escala_id, equipante_id, area)
      values (v_lote, v_escala, v_pessoa.id, v_area);

      v_por_opcao[v_passo] := v_por_opcao[v_passo] + 1;
    end loop;
  end loop;

  -- Ultima passada: quem marcou "Disponível para qualquer área" em qualquer
  -- das 3 e continua sem destino vai para a area com mais vaga sobrando.
  for v_pessoa in
    select q.id, q.sexo
      from public.equipantes q
     where q.tipo = 'equipante'
       and q.status = 'aprovado'
       and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
       and 'Disponível para qualquer área' in (
             coalesce(public._area_canonica(q.area_trabalho_opcao1), ''),
             coalesce(public._area_canonica(q.area_trabalho_opcao2), ''),
             coalesce(public._area_canonica(q.area_trabalho_opcao3), ''))
     order by case when (select c.escala_ordem from public.configuracoes c limit 1) = 'cadastro'
                  then coalesce(q.inscrito_em, q.decidido_em, q.created_at)
                  else coalesce(q.decidido_em, q.created_at)
             end nulls last, q.nome
  loop
    v_destino := public._area_com_mais_vaga(v_pessoa.sexo);
    continue when v_destino is null;

    insert into public.escalas (equipante_id, area_alocada, atuacao)
    values (v_pessoa.id, v_destino, public._atuacao_padrao(v_destino))
    returning id into v_escala;
    update public.equipantes set scale_status = 'ok' where id = v_pessoa.id;

    if v_lote is null then
      insert into public.lotes_alocacao_automatica (feito_por)
      values (public._nome_organizador_logado()) returning id into v_lote;
    end if;
    insert into public.lotes_alocacao_automatica_itens (lote_id, escala_id, equipante_id, area)
    values (v_lote, v_escala, v_pessoa.id, v_destino);

    v_coringa := v_coringa + 1;
  end loop;

  if v_lote is not null then
    update public.lotes_alocacao_automatica
       set total = (select count(*) from public.lotes_alocacao_automatica_itens where lote_id = v_lote)
     where id = v_lote;
  end if;

  select count(*) into v_sobraram
    from public.equipantes q
   where q.tipo = 'equipante'
     and q.status = 'aprovado'
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  return jsonb_build_object(
    'ok', true,
    'alocados',  v_fixos + v_por_opcao[1] + v_por_opcao[2] + v_por_opcao[3] + v_coringa,
    'fixos',     v_fixos,
    'opcao1',    v_por_opcao[1],
    'opcao2',    v_por_opcao[2],
    'opcao3',    v_por_opcao[3],
    'coringa',   v_coringa,
    'sobraram',  v_sobraram,
    -- Areas que passaram do limite por causa dos fixos (so aviso).
    'acima_do_limite', coalesce((
      select jsonb_agg(l.area_nome order by l.area_nome)
        from public.limites_areas l
       where l.area_nome = any(v_areas_fixos)
         and (select count(*) from public.escalas e where e.area_alocada = l.area_nome) > l.limite_maximo
    ), '[]'::jsonb),
    'lote',      v_lote);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Desfazer e situacao: um fixo na sua area fixa nunca sai (nem quem foi
-- marcado fixo depois de o automatico colocar).
-- ---------------------------------------------------------------------------
create or replace function pg_temp._patch(p regprocedure, de text, para text, vezes int)
returns void language plpgsql as $p$
declare d text := pg_get_functiondef(p); n int;
begin
  n := (length(d) - length(replace(d, de, ''))) / length(de);
  if n <> vezes then
    raise exception 'patch em %: esperava % ocorrencia(s) de [%], achei %', p, vezes, de, n;
  end if;
  execute replace(d, de, para);
end;
$p$;

select pg_temp._patch(
  'public.desfazer_alocacao_automatica()'::regprocedure,
  'where e.id = d.escala_id and e.area_alocada = d.area',
  'where e.id = d.escala_id and e.area_alocada = d.area' || chr(10)
    || '       and not exists (select 1 from public.equipantes_areas_fixas f' || chr(10)
    || '                        where f.equipante_id = e.equipante_id and f.area = e.area_alocada)',
  1);

select pg_temp._patch(
  'public.situacao_alocacao_automatica()'::regprocedure,
  'select 1 from public.escalas e where e.id = i.escala_id and e.area_alocada = i.area)),',
  'select 1 from public.escalas e where e.id = i.escala_id and e.area_alocada = i.area'
    || ' and not exists (select 1 from public.equipantes_areas_fixas f'
    || ' where f.equipante_id = e.equipante_id and f.area = e.area_alocada))),',
  1);
