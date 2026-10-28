-- 28/10/2026 -- O responsavel pela reuniao tambem marca os fixos 📌 (pedido do
-- Patrick, logo depois da 20261028g). Vale para o responsavel de varias
-- equipes (grupos de trilha por cor) e para o responsavel de outra area.
-- marcado_por = "<nome> (líder)" se ele e lider daquela equipe, senao
-- "<nome> (responsável)". O resto da 20261028g continua igual.

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

select pg_temp._patch('public.relacao_lider(uuid,text,text,date)'::regprocedure,
  $$'pode_fixar', e.papel = 'lider' and e.escala_lider is not null$$,
  $$'pode_fixar', (e.papel = 'delegado' or (e.papel = 'lider' and e.escala_lider is not null))$$, 1);

select pg_temp._patch('public.lider_marcar_fixo(uuid,text,text,date,uuid,boolean)'::regprocedure,
  $$                  where e.papel = 'lider' and e.escala_lider is not null
                    and e.area = s.area_alocada
                    and public._na_equipe_de(e.area, e.cor, s.id)) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder da área marca quem é fixo nela.');$$,
  $$                  where (e.papel = 'delegado' or (e.papel = 'lider' and e.escala_lider is not null))
                    and e.area = s.area_alocada
                    and public._na_equipe_de(e.area, e.cor, s.id)) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder ou o responsável pela reunião marca quem é fixo nesta área.');$$, 1);

select pg_temp._patch('public.lider_marcar_fixo(uuid,text,text,date,uuid,boolean)'::regprocedure,
  $$(v_auth->>'nome') || ' (líder)'$$,
  $$(v_auth->>'nome') || case when exists (select 1 from public._equipes_do(p_id) e
                                              where e.papel = 'lider' and e.escala_lider is not null
                                                and e.area = s.area_alocada
                                                and public._na_equipe_de(e.area, e.cor, s.id))
                                 then ' (líder)' else ' (responsável)' end$$, 1);
