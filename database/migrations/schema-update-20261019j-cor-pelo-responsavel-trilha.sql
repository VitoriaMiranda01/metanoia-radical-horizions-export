-- Troca de COR pelo lider/responsavel dos grupos de trilha (19/10/2026,
-- Patrick): quem conduz a reuniao de Guia, Invisivel, Marcador, Pastor
-- Invisivel, Espirito Santo ou Inimigo pode mudar a pessoa de cor (ex.: de
-- Amarelo para Azul) -- sempre na MESMA area/funcao; area quem troca e a
-- organizacao. Nessas areas a cor e obrigatoria (nao da para tirar a cor).
-- A cor do proprio lider continua so com os organizadores.
-- Fotografia segue como antes: so o lider da Fotografia.
--  * _area_trilha(area)
--  * lider_definir_cor: aceita lider OU responsavel de uma equipe de trilha
--    em que a pessoa esta (_na_equipe_de).
--  * relacao_lider: 'pode_trocar_cor' tambem nas equipes de trilha.

create or replace function public._area_trilha(p_area text)
returns boolean language sql immutable set search_path = public as $$
  select p_area in ('Guia', 'Invisível', 'Marcador', 'Pastor Invisível', 'Espírito Santo', 'Inimigo');
$$;

do $$
declare
  v_def text := pg_get_functiondef('public.lider_definir_cor(uuid,text,text,date,uuid,text)'::regprocedure);
  v_novo text;
begin
  if v_def like '%_area_trilha%' then return; end if;
  v_novo := replace(v_def,
$a$  if s.area_alocada <> 'Fotografia'
     or not exists (select 1 from public._equipes_do(p_id) e
                     where e.papel = 'lider' and e.area = 'Fotografia'
                       and public._na_equipe_de(e.area, e.cor, s.id)) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder da Fotografia escolhe a cor.');
  end if;$a$,
$a$  if public._area_trilha(s.area_alocada) then
    if not exists (select 1 from public._equipes_do(p_id) e
                    where public._area_trilha(e.area)
                      and public._na_equipe_de(e.area, e.cor, s.id)) then
      return jsonb_build_object('ok', false, 'erro', 'Só o líder ou o responsável pela reunião desta pessoa troca a cor.');
    end if;
    if v_cor is null then
      return jsonb_build_object('ok', false, 'erro', 'Nos grupos de trilha toda pessoa precisa de uma cor.');
    end if;
  elsif s.area_alocada <> 'Fotografia'
     or not exists (select 1 from public._equipes_do(p_id) e
                     where e.papel = 'lider' and e.area = 'Fotografia'
                       and public._na_equipe_de(e.area, e.cor, s.id)) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder da Fotografia escolhe a cor.');
  end if;$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em lider_definir_cor'; end if;
  execute v_novo;
end $$;

do $$
declare
  v_def text := pg_get_functiondef('public.relacao_lider(uuid,text,text,date)'::regprocedure);
  v_novo text;
begin
  if v_def like '%_area_trilha%' then return; end if;
  v_novo := replace(v_def,
    $a$'pode_trocar_cor', e.papel = 'lider' and e.area = 'Fotografia',$a$,
    $a$'pode_trocar_cor', (e.papel = 'lider' and e.area = 'Fotografia') or public._area_trilha(e.area),$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em relacao_lider'; end if;
  execute v_novo;
end $$;
