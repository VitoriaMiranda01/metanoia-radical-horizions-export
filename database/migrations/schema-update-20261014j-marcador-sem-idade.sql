-- ---------------------------------------------------------------------------
-- Marcador nao usa a idade na distribuicao das cores (14/10/2026, Patrick:
-- "Marcador não precisa dessa regra"). Continua equilibrando quantidade e
-- homens/mulheres. Invisível e Pastor Invisível seguem com a idade.
-- ---------------------------------------------------------------------------
create or replace function public._distribuir_cores(p_area text, p_ids uuid[], p_max integer default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  r     record;
  v_cor text;
  v_n   int := 0;
  v_usa_idade boolean := p_area <> 'Marcador';
begin
  drop table if exists pg_temp._cores_dist;
  create temp table _cores_dist on commit drop as
    select e.id, q.sexo,
           coalesce(extract(year from age(current_date, q.data_nascimento))::numeric, 0) as idade,
           case when e.id = any(p_ids) then null else e.cor end as cor,
           e.cor as cor_antes,
           e.id = any(p_ids) as livre
      from public.escalas e join public.equipantes q on q.id = e.equipante_id
     where e.area_alocada = p_area;

  for r in select id, sexo, idade from _cores_dist where livre
            order by sexo nulls last, case when v_usa_idade then idade else 0 end desc, random() loop
    select c.cor into v_cor
      from unnest(array['Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho']) as c(cor)
     where p_max is null or (select count(*) from _cores_dist d where d.cor = c.cor) < p_max
     order by (select count(*) from _cores_dist d where d.cor = c.cor and d.sexo is not distinct from r.sexo),
              (select count(*) from _cores_dist d where d.cor = c.cor),
              case when v_usa_idade then (select coalesce(sum(d.idade), 0) from _cores_dist d where d.cor = c.cor) else 0 end,
              random()
     limit 1;
    update _cores_dist set cor = v_cor where id = r.id;
  end loop;

  for r in select id, cor from _cores_dist where livre and cor is distinct from cor_antes loop
    update public.escalas set cor = r.cor where id = r.id;
    v_n := v_n + 1;
  end loop;
  drop table if exists pg_temp._cores_dist;
  return v_n;
end;
$fn$;
revoke all on function public._distribuir_cores(text, uuid[], integer) from public, anon, authenticated;
