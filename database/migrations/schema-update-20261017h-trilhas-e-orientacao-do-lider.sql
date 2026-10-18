-- Ajustes de 17/10/2026 (Patrick):
--  1) Oração Itinerante na Cristolândia vira DUAS atuações -- Trilha A e
--     Trilha B --, que o líder escolhe na chamada (ninguém tinha a atuação
--     única ainda).
--  2) alteracoes_lider_vigentes(): o que o líder mudou (atuação/cor) e ainda
--     está valendo, para a tela de escalas destacar como "orientação do líder".

delete from public.atuacoes_areas
 where area_nome = 'Cristolândia' and atuacao = 'Oração Itinerante'
   and not exists (select 1 from public.escalas where area_alocada = 'Cristolândia' and atuacao = 'Oração Itinerante');

insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider, sem_cor)
select 'Cristolândia', t.atuacao,
       (select coalesce(max(ordem), 0) from public.atuacoes_areas where area_nome = 'Cristolândia') + t.n,
       false, false, false
  from (values ('Oração Itinerante / Trilha A', 1), ('Oração Itinerante / Trilha B', 2)) t(atuacao, n)
 where not exists (select 1 from public.atuacoes_areas a where a.area_nome = 'Cristolândia' and a.atuacao = t.atuacao);

-- { escala_id: { atuacao: {por, em}, cor: {por, em} } } -- so o que ainda vale.
create or replace function public.alteracoes_lider_vigentes()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.eh_organizador() then '{}'::jsonb else coalesce((
    select jsonb_object_agg(x.escala_id, x.campos)
      from (select u.escala_id, jsonb_object_agg(u.campo, jsonb_build_object('por', u.por, 'em', u.em)) as campos
              from (select distinct on (a.escala_id, a.campo) a.escala_id, a.campo, a.para, a.por, a.em
                      from public.alteracoes_lider a
                     order by a.escala_id, a.campo, a.em desc, a.id desc) u
              join public.escalas s on s.id = u.escala_id
             where (u.campo = 'atuacao' and s.atuacao is not distinct from u.para)
                or (u.campo = 'cor' and s.cor is not distinct from u.para)
             group by u.escala_id) x), '{}'::jsonb) end;
$$;

revoke all on function public.alteracoes_lider_vigentes() from public, anon;
grant execute on function public.alteracoes_lider_vigentes() to authenticated;
