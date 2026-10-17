-- Responsaveis pela reuniao: VARIOS por equipe, e podem ser de OUTRA area
-- (17/10/2026, Patrick). Ex.: a Vitoria conduz a reuniao de 3 areas.
--
--  * responsaveis_reuniao: deixa de ter um so por equipe (area+cor); passa a
--    ser um por (equipe, pessoa). Coluna de_fora: a pessoa nao esta na equipe
--    (foi posta pela organizacao) -- nao sai sozinha quando muda de area.
--  * definir_responsavel_reuniao: ACRESCENTA (antes trocava). Pessoa de fora
--    da equipe: precisa ser equipante aprovado. p_equipante_id null tira todos.
--  * remover_responsavel_reuniao: tira uma pessoa de uma equipe.
--  * definir_responsavel_em_bloco: uma pessoa em varias equipes de uma vez.
--  * lider_delegar_reuniao: o lider continua escolhendo UM da propria equipe;
--    troca so os responsaveis de dentro da equipe (os de fora, postos pela
--    organizacao, ficam).
--  * painel e relacao do lider: 'delegados' (lista) + 'delegado' (o primeiro,
--    para as telas antigas).
--  * _equipes_do: o grupo do WhatsApp de uma equipe sem lider e o que ja foi
--    salvo por alguem da equipe; se nenhum, o da propria pessoa; se ela e de
--    fora, o da primeira linha da equipe.

alter table public.responsaveis_reuniao add column if not exists de_fora boolean not null default false;
drop index if exists public.responsaveis_reuniao_equipe;
create unique index if not exists responsaveis_reuniao_pessoa
  on public.responsaveis_reuniao (area, (coalesce(cor, '')), equipante_id);

-- Quem e de fora nao sai quando muda de area (so os de dentro saem junto).
create or replace function public._limpar_responsavel_reuniao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.responsaveis_reuniao r
   where r.equipante_id = old.equipante_id
     and not r.de_fora
     and not exists (select 1 from public.escalas s
                      where s.equipante_id = r.equipante_id
                        and public._na_equipe_de(r.area, r.cor, s.id));
  return null;
end;
$$;

create or replace function public._equipes_do(p_id uuid)
returns table(area text, cor text, papel text, chave_grupo uuid, escala_lider uuid)
language sql stable security definer set search_path = public as $$
  with lid as (
    select l.area_alocada as area,
           case when public._area_com_cor(l.area_alocada) then l.cor end as cor,
           'lider'::text as papel, l.id as escala_lider
      from public.escalas l
     where l.equipante_id = p_id and public._eh_lider(l.area_alocada, l.atuacao)
  ), del as (
    select r.area, r.cor, 'delegado'::text as papel,
           (select l.id from public.escalas l
             where l.area_alocada = r.area and public._eh_lider(l.area_alocada, l.atuacao)
               and (not public._area_com_cor(r.area) or r.cor is null or l.cor is null or l.cor = r.cor)
             order by l.created_at limit 1) as escala_lider
      from public.responsaveis_reuniao r
     where r.equipante_id = p_id
       and not exists (select 1 from lid where lid.area = r.area and lid.cor is not distinct from r.cor)
  )
  select x.area, x.cor, x.papel,
         coalesce(x.escala_lider,
                  (select g.escala_id from public.grupos_lider g
                    where public._na_equipe_de(x.area, x.cor, g.escala_id)
                    order by g.atualizado_em nulls last limit 1),
                  (select s.id from public.escalas s
                    where s.equipante_id = p_id and s.area_alocada = x.area limit 1),
                  (select s.id from public.escalas s
                    where public._na_equipe_de(x.area, x.cor, s.id)
                    order by s.created_at, s.id limit 1)),
         x.escala_lider
    from (select * from lid union all select * from del) x;
$$;

-- Acrescenta um responsavel numa equipe (organizador).
create or replace function public.definir_responsavel_reuniao(p_area text, p_cor text, p_equipante_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org record;
  v_cor text := nullif(p_cor, '');
  v_de_fora boolean;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if p_equipante_id is null then
    delete from public.responsaveis_reuniao where area = p_area and cor is not distinct from v_cor;
    return jsonb_build_object('ok', true);
  end if;
  if not exists (select 1 from public.limites_areas where area_nome = p_area) then
    return jsonb_build_object('ok', false, 'erro', format('"%s" não é uma área da escala.', p_area));
  end if;
  if v_cor is not null and (not public._area_com_cor(p_area)
                            or v_cor not in ('Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho')) then
    return jsonb_build_object('ok', false, 'erro', 'Cor inválida para esta área.');
  end if;
  if not exists (select 1 from public.equipantes q
                  where q.id = p_equipante_id and q.tipo = 'equipante' and q.status = 'aprovado') then
    return jsonb_build_object('ok', false, 'erro', 'Escolha um equipante aprovado.');
  end if;
  v_de_fora := not exists (select 1 from public.escalas s
                            where s.equipante_id = p_equipante_id and public._na_equipe_de(p_area, v_cor, s.id));
  select * into v_org from public._organizador_do_cracha();
  insert into public.responsaveis_reuniao (area, cor, equipante_id, definido_por, definido_por_tipo, definido_em, de_fora)
  values (p_area, v_cor, p_equipante_id, coalesce(v_org.nome, 'organizador'), 'organizador', now(), v_de_fora)
  on conflict (area, (coalesce(cor, '')), equipante_id) do update
     set definido_por = excluded.definido_por, definido_por_tipo = excluded.definido_por_tipo,
         definido_em = excluded.definido_em, de_fora = excluded.de_fora;
  return jsonb_build_object('ok', true, 'de_fora', v_de_fora);
end;
$$;

create or replace function public.remover_responsavel_reuniao(p_area text, p_cor text, p_equipante_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  delete from public.responsaveis_reuniao
   where area = p_area and cor is not distinct from nullif(p_cor, '') and equipante_id = p_equipante_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Uma pessoa em varias equipes: p_equipes = [{"area": "...", "cor": "..."|null}, ...]
create or replace function public.definir_responsavel_em_bloco(p_equipante_id uuid, p_equipes jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  x jsonb;
  r jsonb;
  v_ok int := 0;
  v_falhas jsonb := '[]'::jsonb;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if p_equipes is null or jsonb_typeof(p_equipes) <> 'array' or jsonb_array_length(p_equipes) = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Escolha pelo menos uma equipe.');
  end if;
  for x in select * from jsonb_array_elements(p_equipes) loop
    r := public.definir_responsavel_reuniao(x->>'area', x->>'cor', p_equipante_id);
    if (r->>'ok')::boolean then
      v_ok := v_ok + 1;
    else
      v_falhas := v_falhas || jsonb_build_object('area', x->>'area', 'cor', x->>'cor', 'erro', r->>'erro');
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'definidos', v_ok, 'falhas', v_falhas);
end;
$$;

revoke all on function public.remover_responsavel_reuniao(text, text, uuid) from public, anon;
grant execute on function public.remover_responsavel_reuniao(text, text, uuid) to authenticated;
revoke all on function public.definir_responsavel_em_bloco(uuid, jsonb) from public, anon;
grant execute on function public.definir_responsavel_em_bloco(uuid, jsonb) to authenticated;

-- O lider escolhe um da propria equipe; troca so os de dentro.
create or replace function public.lider_delegar_reuniao(p_id uuid, p_cpf text, p_nome text, p_nascimento date,
                                                        p_area text, p_cor text, p_equipante_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  v_cor text := nullif(p_cor, '');
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if not exists (select 1 from public._equipes_do(p_id) e
                  where e.papel = 'lider' and e.area = p_area and e.cor is not distinct from v_cor) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder da equipe delega a reunião.');
  end if;

  if p_equipante_id is null then
    delete from public.responsaveis_reuniao
     where area = p_area and cor is not distinct from v_cor and not de_fora;
    return jsonb_build_object('ok', true, 'delegado', null);
  end if;

  if p_equipante_id = p_id then
    return jsonb_build_object('ok', false, 'erro', 'Escolha outra pessoa da equipe.');
  end if;
  if not exists (select 1 from public.escalas s
                  where s.equipante_id = p_equipante_id
                    and public._na_equipe_de(p_area, v_cor, s.id)) then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está na sua equipe.');
  end if;

  delete from public.responsaveis_reuniao
   where area = p_area and cor is not distinct from v_cor and not de_fora and equipante_id <> p_equipante_id;
  insert into public.responsaveis_reuniao (area, cor, equipante_id, definido_por, definido_por_tipo, definido_em, de_fora)
  values (p_area, v_cor, p_equipante_id, v_auth->>'nome', 'lider', now(), false)
  on conflict (area, (coalesce(cor, '')), equipante_id) do update
     set definido_por = excluded.definido_por, definido_por_tipo = excluded.definido_por_tipo,
         definido_em = excluded.definido_em;

  return jsonb_build_object('ok', true,
    'delegado', (select nome from public.equipantes where id = p_equipante_id));
end;
$$;

-- Lista de responsaveis de uma equipe (json), os de dentro primeiro.
create or replace function public._responsaveis_da_equipe(p_area text, p_cor text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'equipante_id', q.id, 'nome', q.nome, 'definido_por', r.definido_por,
           'definido_por_tipo', r.definido_por_tipo, 'de_fora', r.de_fora,
           'areas', (select coalesce(jsonb_agg(s.area_alocada order by s.area_alocada), '[]'::jsonb)
                       from public.escalas s where s.equipante_id = q.id))
           order by r.de_fora, r.definido_em), '[]'::jsonb)
    from public.responsaveis_reuniao r
    join public.equipantes q on q.id = r.equipante_id
   where r.area = p_area and r.cor is not distinct from p_cor;
$$;

do $mig$
declare
  v text;
  velho text := $a$'delegado', (select jsonb_build_object('equipante_id', q.id, 'nome', q.nome,
                                                  'definido_por', r.definido_por)
                          from public.responsaveis_reuniao r
                          join public.equipantes q on q.id = r.equipante_id
                         where r.area = e.area and r.cor is not distinct from e.cor),$a$;
  novo text := $b$'delegados', public._responsaveis_da_equipe(e.area, e.cor),
           'delegado', public._responsaveis_da_equipe(e.area, e.cor) -> 0,$b$;
begin
  v := pg_get_functiondef('public.responsaveis_reuniao_painel()'::regprocedure);
  if position(velho in v) = 0 then raise exception 'trecho do painel nao encontrado'; end if;
  execute replace(v, velho, novo);

  v := pg_get_functiondef('public.relacao_lider(uuid,text,text,date)'::regprocedure);
  if position(velho in v) = 0 then raise exception 'trecho da relacao nao encontrado'; end if;
  execute replace(v, velho, novo);
end
$mig$;

revoke all on function public._responsaveis_da_equipe(text, text) from public, anon, authenticated;
