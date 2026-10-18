-- 18/10/2026: quando DUAS pessoas (ou mais) conduzem a reuniao de uma equipe
-- sem lider, o grupo do WhatsApp da equipe tem que ser UM so, o mesmo para as
-- duas. Antes, quem nao tinha grupo salvo usava a propria linha de escala como
-- chave, entao duas pessoas da mesma equipe podiam salvar links diferentes.
-- Agora: o grupo ja salvo da equipe; se nao ha, a primeira linha da equipe
-- (a mesma para todos os responsaveis).
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
                    order by g.atualizado_em nulls last, g.escala_id limit 1),
                  (select s.id from public.escalas s
                    where public._na_equipe_de(x.area, x.cor, s.id)
                    order by s.created_at, s.id limit 1)),
         x.escala_lider
    from (select * from lid union all select * from del) x;
$$;
