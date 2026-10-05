-- ---------------------------------------------------------------------------
-- codigos_lideres: um codigo por PESSOA, mesmo para quem e lider em duas areas
--
-- Revisao de 05/10/2026. O "select distinct s.equipante_id, _codigo_novo()"
-- nao deduplicava: o codigo sorteado e diferente em cada linha, entao quem
-- e lider em duas areas gerava duas linhas no mesmo insert. O "on conflict
-- do nothing" salvava o resultado, mas por acaso. Agora o distinct e feito
-- antes de sortear.
-- ---------------------------------------------------------------------------
do $do$
declare
  v_def text := pg_get_functiondef('public.codigos_lideres()'::regprocedure);
  v_velho text := $v$  insert into public.codigos_lider (equipante_id, codigo)
  select distinct s.equipante_id, public._codigo_novo()
    from public.escalas s
   where public._eh_lider(s.area_alocada, s.atuacao)
     and not exists (select 1 from public.codigos_lider c where c.equipante_id = s.equipante_id)
  on conflict (equipante_id) do nothing;$v$;
  v_novo text := $v$  insert into public.codigos_lider (equipante_id, codigo)
  select l.equipante_id, public._codigo_novo()
    from (select distinct s.equipante_id
            from public.escalas s
           where public._eh_lider(s.area_alocada, s.atuacao)) l
   where not exists (select 1 from public.codigos_lider c where c.equipante_id = l.equipante_id)
  on conflict (equipante_id) do nothing;$v$;
begin
  if (length(v_def) - length(replace(v_def, v_velho, ''))) / length(v_velho) <> 1 then
    raise exception 'trecho de codigos_lideres nao encontrado (ou repetido)';
  end if;
  execute replace(v_def, v_velho, v_novo);
end;
$do$;
