-- Fotografia e UMA equipe so (19/10/2026, Patrick): o pessoal continua com cor
-- (o lider da Fotografia escolhe a cor de cada um), mas lider, responsavel
-- pela reuniao, chamada e grupo valem para a area inteira -- nao ha
-- "Fotografia · Amarelo". Antes a equipe seguia a cor do lider: com o lider
-- marcado Amarelo, so os Amarelos apareciam para escolher o responsavel.
--
-- _equipe_por_cor(area): a area divide a EQUIPE por cor. Igual a
-- _area_com_cor, menos a Fotografia. _area_com_cor continua valendo para a
-- COR de cada pessoa (alocar, definir cor, trocar de area, chamada, revelacao).

create or replace function public._equipe_por_cor(p_area text)
returns boolean language sql immutable set search_path = public as $$
  select public._area_com_cor(p_area) and p_area <> 'Fotografia';
$$;

do $$
declare
  f record;
  v_def text;
  v_novo text;
  v_feitas int := 0;
begin
  for f in
    select p.oid, p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('_assinatura_relacao', '_equipes_do', '_na_equipe', '_na_equipe_de',
                         'relacao_lider', 'responsaveis_reuniao_painel', 'definir_responsavel_reuniao')
  loop
    v_def := pg_get_functiondef(f.oid);
    v_novo := replace(v_def, 'public._area_com_cor(', 'public._equipe_por_cor(');
    if v_novo = v_def then
      if v_def like '%_equipe_por_cor(%' then continue; end if;
      raise exception 'trecho não encontrado em %', f.proname;
    end if;
    execute v_novo;
    v_feitas := v_feitas + 1;
  end loop;
  if v_feitas not in (0, 7) then
    raise exception 'esperava 7 funções, mexi em %', v_feitas;
  end if;
end $$;
