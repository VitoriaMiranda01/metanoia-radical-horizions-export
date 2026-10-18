-- _equipes_do mais rapido (18/10/2026): a escolha do grupo de uma equipe sem
-- lider testava _na_equipe_de linha por linha de toda a escala (lento para quem
-- conduz 13 equipes). Agora a pertenca a equipe e escrita direto e usa o indice
-- de escalas por area. Mesmo resultado.
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
  ), x as (
    select *, public._area_com_cor(t.area) as com_cor from (select * from lid union all select * from del) t
  )
  select x.area, x.cor, x.papel,
         coalesce(x.escala_lider,
                  (select g.escala_id
                     from public.grupos_lider g
                     join public.escalas s on s.id = g.escala_id
                    where (s.area_alocada = x.area
                           or (x.area = 'Invisível' and s.area_alocada = 'Marcador')
                           or (x.area = 'Selva' and s.area_alocada = 'Perseguidos'))
                      and (not x.com_cor or x.cor is null or s.cor is null or s.cor = x.cor)
                    order by g.atualizado_em nulls last, g.escala_id limit 1),
                  (select s.id from public.escalas s
                    where (s.area_alocada = x.area
                           or (x.area = 'Invisível' and s.area_alocada = 'Marcador')
                           or (x.area = 'Selva' and s.area_alocada = 'Perseguidos'))
                      and (not x.com_cor or x.cor is null or s.cor is null or s.cor = x.cor)
                    order by s.created_at, s.id limit 1)),
         x.escala_lider
    from x;
$$;
