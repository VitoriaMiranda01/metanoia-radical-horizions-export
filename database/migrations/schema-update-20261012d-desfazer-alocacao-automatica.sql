-- ---------------------------------------------------------------------------
-- Desfazer a alocacao automatica (Patrick, 12/10/2026).
--
-- O botao "Alocar automático" passa a guardar o que fez (um lote: quem foi
-- para qual area). Enquanto houver lote ativo, a tela troca o botao por
-- "Desfazer alocação automática", que tira da escala SO quem o automatico
-- colocou e AINDA esta na mesma area -- quem foi mexido a mao depois fica onde
-- esta, e quem foi alocado a mao nunca e tocado. Quem sai volta para a fila
-- "A escalar".
--
-- Regras:
--  * So organizador (o mesmo do "Alocar automático").
--  * Desfazer so antes de lancar a escala provisoria: depois disso as pessoas
--    ja viram a area e ha chamada/relacao do lider em cima da escala.
--  * Varios cliques em "Alocar automático" = varios lotes; desfazer desfaz
--    todos os que estao ativos.
--  * A virada de edicao apaga os lotes.
-- ---------------------------------------------------------------------------

create table if not exists public.lotes_alocacao_automatica (
  id           uuid primary key default gen_random_uuid(),
  feito_em     timestamptz not null default now(),
  feito_por    text,
  total        int not null default 0,
  desfeito_em  timestamptz,
  desfeito_por text,
  desfeitos    int,
  mantidos     int
);

create table if not exists public.lotes_alocacao_automatica_itens (
  lote_id      uuid not null references public.lotes_alocacao_automatica(id) on delete cascade,
  escala_id    uuid not null,
  equipante_id uuid not null,
  area         text not null,
  primary key (lote_id, escala_id)
);

alter table public.lotes_alocacao_automatica       enable row level security;
alter table public.lotes_alocacao_automatica_itens enable row level security;
revoke all on public.lotes_alocacao_automatica       from anon, authenticated;
revoke all on public.lotes_alocacao_automatica_itens from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Alocar automatico: a mesma regra de antes, agora guardando o lote.
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
    'alocados',  v_por_opcao[1] + v_por_opcao[2] + v_por_opcao[3] + v_coringa,
    'opcao1',    v_por_opcao[1],
    'opcao2',    v_por_opcao[2],
    'opcao3',    v_por_opcao[3],
    'coringa',   v_coringa,
    'sobraram',  v_sobraram,
    'lote',      v_lote);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Situacao: ha alocacao automatica para desfazer?
-- ---------------------------------------------------------------------------
create or replace function public.situacao_alocacao_automatica()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ativo', false);
  end if;
  return (
    select jsonb_build_object(
      'ativo', count(distinct l.id) > 0,
      'lotes', count(distinct l.id),
      'total', count(i.escala_id),
      'no_lugar', count(i.escala_id) filter (where exists (
        select 1 from public.escalas e where e.id = i.escala_id and e.area_alocada = i.area)),
      'feito_em', max(l.feito_em),
      'feito_por', (select l2.feito_por from public.lotes_alocacao_automatica l2
                     where l2.desfeito_em is null order by l2.feito_em desc limit 1),
      'pode_desfazer', (select escala_lancada_em is null from public.configuracoes limit 1))
    from public.lotes_alocacao_automatica l
    left join public.lotes_alocacao_automatica_itens i on i.lote_id = l.id
    where l.desfeito_em is null
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Desfazer
-- ---------------------------------------------------------------------------
create or replace function public.desfazer_alocacao_automatica()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem      text := public._nome_organizador_logado();
  v_total     int;
  v_desfeitos int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem desfazer a alocação automática.');
  end if;
  if (select escala_lancada_em from public.configuracoes limit 1) is not null then
    return jsonb_build_object('ok', false, 'erro',
      'A escala provisória já foi lançada: a alocação automática não pode mais ser desfeita. Ajuste pela troca de área.');
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  select count(*) into v_total
    from public.lotes_alocacao_automatica_itens i
    join public.lotes_alocacao_automatica l on l.id = i.lote_id
   where l.desfeito_em is null;
  if v_total = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Não há alocação automática para desfazer.');
  end if;

  -- So quem continua na area em que o automatico colocou.
  with ativos as (
    select i.escala_id, i.area
      from public.lotes_alocacao_automatica_itens i
      join public.lotes_alocacao_automatica l on l.id = i.lote_id
     where l.desfeito_em is null
  ), apagados as (
    delete from public.escalas e
     using ativos d
     where e.id = d.escala_id and e.area_alocada = d.area
    returning e.equipante_id
  )
  select count(*) into v_desfeitos from apagados;

  -- Quem ficou sem nenhuma area volta para a fila.
  update public.equipantes q set scale_status = 'pendente'
   where q.id in (select i.equipante_id
                    from public.lotes_alocacao_automatica_itens i
                    join public.lotes_alocacao_automatica l on l.id = i.lote_id
                   where l.desfeito_em is null)
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  update public.lotes_alocacao_automatica l
     set desfeito_em = now(), desfeito_por = v_quem,
         desfeitos = (select count(*) from public.lotes_alocacao_automatica_itens d
                       where d.lote_id = l.id
                         and not exists (select 1 from public.escalas e where e.id = d.escala_id)),
         mantidos  = (select count(*) from public.lotes_alocacao_automatica_itens d
                       where d.lote_id = l.id
                         and exists (select 1 from public.escalas e where e.id = d.escala_id))
   where l.desfeito_em is null;

  return jsonb_build_object('ok', true, 'desfeitos', v_desfeitos, 'mantidos', v_total - v_desfeitos);
end;
$fn$;

revoke all on function public.situacao_alocacao_automatica()  from public, anon;
revoke all on function public.desfazer_alocacao_automatica()  from public, anon;
grant execute on function public.situacao_alocacao_automatica() to authenticated;
grant execute on function public.desfazer_alocacao_automatica() to authenticated;

-- Virada de edicao: os lotes vao junto com a escala.
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
  'public.resetar_para_nova_edicao(integer)'::regprocedure,
  'delete from public.escalas where id is not null;',
  'delete from public.lotes_alocacao_automatica where id is not null;' || chr(10)
    || '  delete from public.escalas where id is not null;',
  1);
