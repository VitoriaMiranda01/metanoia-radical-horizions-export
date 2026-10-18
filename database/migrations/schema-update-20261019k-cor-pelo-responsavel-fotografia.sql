-- Fotografia: o RESPONSAVEL pela reuniao tambem troca a cor do pessoal
-- (19/10/2026, Patrick), como nos grupos de trilha (20261019j). Antes so o
-- lider da Fotografia. A cor do proprio lider continua so com os
-- organizadores; na Fotografia "sem cor" segue permitido.

do $$
declare
  v_def text := pg_get_functiondef('public.lider_definir_cor(uuid,text,text,date,uuid,text)'::regprocedure);
  v_novo text;
begin
  if v_def like '%Só o líder ou o responsável pela reunião da Fotografia%' then return; end if;
  v_novo := replace(v_def,
$a$  elsif s.area_alocada <> 'Fotografia'
     or not exists (select 1 from public._equipes_do(p_id) e
                     where e.papel = 'lider' and e.area = 'Fotografia'
                       and public._na_equipe_de(e.area, e.cor, s.id)) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder da Fotografia escolhe a cor.');$a$,
$a$  elsif s.area_alocada <> 'Fotografia'
     or not exists (select 1 from public._equipes_do(p_id) e
                     where e.area = 'Fotografia'
                       and public._na_equipe_de(e.area, e.cor, s.id)) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder ou o responsável pela reunião da Fotografia escolhe a cor.');$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em lider_definir_cor'; end if;
  execute v_novo;
end $$;

do $$
declare
  v_def text := pg_get_functiondef('public.relacao_lider(uuid,text,text,date)'::regprocedure);
  v_novo text;
begin
  if v_def like $a$%'pode_trocar_cor', e.area = 'Fotografia' or%$a$ then return; end if;
  v_novo := replace(v_def,
    $a$'pode_trocar_cor', (e.papel = 'lider' and e.area = 'Fotografia') or public._area_trilha(e.area),$a$,
    $a$'pode_trocar_cor', e.area = 'Fotografia' or public._area_trilha(e.area),$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em relacao_lider'; end if;
  execute v_novo;
end $$;
