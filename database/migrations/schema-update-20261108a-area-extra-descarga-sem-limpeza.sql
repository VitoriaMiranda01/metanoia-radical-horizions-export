-- ---------------------------------------------------------------------------
-- Area extra nova: DESCARGA do caminhao em Teresopolis (domingo ~13h, apos o
-- evento). Sai a LIMPEZA da Centenario (sexta), que nao vai mais existir.
-- (08/11/2026, pedido do Patrick)
--
-- * Chaves validas passam a ser caminhao, cozinha, descarga (travas das
--   tabelas + decidir_disponibilidade_extra, definir_lider_area_extra,
--   revelar_area). Limpeza nao tinha nenhuma linha em nenhum dos bancos.
-- * disponibilidades_extra casava '%caminh%' na coluna inteira: a frase nova
--   ("descarregar o caminhao em Teresopolis") cairia no Caminhao de quinta.
--   Agora cada frase (separadas por ';') vira UMA chave em _area_extra_da_frase:
--   descarreg/teresopolis -> descarga; senao caminh -> caminhao; cozinha.
-- * So Domingo pode se oferecer, mas so para a descarga (_extras_do_domingo):
--   criar_inscricao e definir_so_domingo_pendente deixam de apagar a coluna
--   e passam a guardar so as frases da descarga.
-- Espelha src/constants/areasExtra.js.
-- ---------------------------------------------------------------------------

create or replace function public._area_extra_da_frase(p_frase text)
returns text language sql immutable set search_path = public as $$
  select case
           when s like '%descarreg%' or s like '%teresopolis%' then 'descarga'
           when s like '%caminh%' then 'caminhao'
           when s like '%cozinha%' then 'cozinha'
         end
    from (select lower(public.unaccent_simples(coalesce(p_frase, ''))) as s) x;
$$;

create or replace function public._extras_do_domingo(p_extra text)
returns text language sql immutable set search_path = public as $$
  select nullif(string_agg(btrim(f), '; '), '')
    from unnest(string_to_array(coalesce(p_extra, ''), ';')) as f
   where public._area_extra_da_frase(f) = 'descarga';
$$;

revoke all on function public._area_extra_da_frase(text), public._extras_do_domingo(text)
  from public, anon, authenticated;

-- ------------------------------------------------------------- travas
alter table public.disponibilidade_extra drop constraint if exists disponibilidade_extra_area_check;
alter table public.disponibilidade_extra add constraint disponibilidade_extra_area_check
  check (area in ('caminhao', 'cozinha', 'descarga'));
alter table public.lideres_area_extra drop constraint if exists lideres_area_extra_area_check;
alter table public.lideres_area_extra add constraint lideres_area_extra_area_check
  check (area in ('caminhao', 'cozinha', 'descarga'));

-- ------------------------------------------------------------- funcoes
do $$
declare
  v_def text;
  v_novo text;
  f text;
begin
  -- 1. listas de chaves validas
  foreach f in array array['public.decidir_disponibilidade_extra(uuid, text, boolean)',
                           'public.definir_lider_area_extra(text, uuid)'] loop
    select pg_get_functiondef(f::regprocedure) into v_def;
    v_novo := replace(v_def, $a$('caminhao', 'cozinha', 'limpeza')$a$, $b$('caminhao', 'cozinha', 'descarga')$b$);
    if v_novo = v_def then
      raise exception '%: trecho não encontrado', f;
    end if;
    execute v_novo;
  end loop;

  select pg_get_functiondef('public.revelar_area(uuid, text, text, date)'::regprocedure) into v_def;
  v_novo := replace(v_def, $a$array['caminhao','cozinha','limpeza']$a$, $b$array['caminhao','cozinha','descarga']$b$);
  if v_novo = v_def then
    raise exception 'revelar_area: trecho não encontrado';
  end if;
  execute v_novo;

  -- 2. disponibilidades_extra: uma chave por frase
  select pg_get_functiondef('public.disponibilidades_extra()'::regprocedure) into v_def;
  v_novo := regexp_replace(v_def,
    $a$select unnest\(array_remove\(array\[\s*case when lower\(public\.unaccent_simples\(e\.area_trabalho_extra\)\) like '%caminh%' then 'caminhao' end,\s*case when lower\(public\.unaccent_simples\(e\.area_trabalho_extra\)\) like '%cozinha%' then 'cozinha' end,\s*case when lower\(public\.unaccent_simples\(e\.area_trabalho_extra\)\) like '%limpeza%' then 'limpeza' end\s*\], null\)\) as area\) a$a$,
    $b$select distinct public._area_extra_da_frase(f) as area
         from unnest(string_to_array(e.area_trabalho_extra, ';')) as f
        where public._area_extra_da_frase(f) is not null) a$b$);
  if v_novo = v_def then
    raise exception 'disponibilidades_extra: trecho não encontrado';
  end if;
  execute v_novo;

  -- 3. So Domingo guarda so a descarga
  select pg_get_functiondef('public.criar_inscricao(text, jsonb, text)'::regprocedure) into v_def;
  v_novo := regexp_replace(v_def,
    $a$'area_trabalho_opcao3', null,\s*'area_trabalho_extra', null\);$a$,
    $b$'area_trabalho_opcao3', null,
      'area_trabalho_extra', public._extras_do_domingo(p_dados->>'area_trabalho_extra'));$b$);
  if v_novo = v_def then
    raise exception 'criar_inscricao: trecho não encontrado';
  end if;
  execute v_novo;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'definir_so_domingo_pendente';
  v_novo := regexp_replace(v_def,
    $a$area_trabalho_extra\s*= null$a$,
    $b$area_trabalho_extra  = public._extras_do_domingo(area_trabalho_extra)$b$);
  if v_novo = v_def then
    raise exception 'definir_so_domingo_pendente: trecho não encontrado';
  end if;
  execute v_novo;
end;
$$;
