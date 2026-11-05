-- Acompanhante so para o equipante MENOR DE 16 (05/11/2026, Patrick)
--
-- A 20261105a pedia acompanhante para todo equipante menor de 18. A regra do
-- projeto e outra:
--  * Menor de 16 (ainda nao tem 16 anos completos no 1o dia do projeto):
--    responsavel + acompanhante durante o projeto + liberacao do pastor.
--  * 16 ou 17 anos: so a autorizacao do responsavel (liberacao do pastor,
--    declaracao sem a parte do acompanhante).
-- O acampante nao muda (nunca teve acompanhante).
--
-- A declaracao de 16/17 anos e um texto novo: versao '20261105c'. A de menor
-- de 16 continua '20261105a'.

-- 1. Quem precisa de acompanhante -----------------------------------------
create or replace function public._equipante_precisa_acompanhante(p_nascimento date)
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  select p_nascimento is not null
     and p_nascimento > (coalesce((select c.data_evento_inicio from public.configuracoes c limit 1), current_date)
                         - interval '16 years')::date;
$function$;

create or replace function public._menor_declaracao_versao(p_nascimento date)
returns text
language sql
stable
set search_path to 'public'
as $function$
  select case when public._equipante_precisa_acompanhante(p_nascimento) then '20261105a' else '20261105c' end;
$function$;

-- 2. Inscricao: acompanhante obrigatorio so abaixo de 16 -------------------
do $$
declare
  v_def text := pg_get_functiondef('public._menor_responsavel_erro(jsonb, text)'::regprocedure);
  v_novo text;
begin
  v_novo := replace(v_def,
$a$('acompanhante_nome', null, 'ACOMPANHANTE', p_tipo = 'equipante')$a$,
$b$('acompanhante_nome', null, 'ACOMPANHANTE', p_tipo = 'equipante' and public._equipante_precisa_acompanhante(v_nasc))$b$);
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em _menor_responsavel_erro';
  end if;
  execute v_novo;
end $$;

-- 2a. Gatilho validar_ficha: apagar o acompanhante so e barrado abaixo de 16.
do $$
declare
  v_def text := pg_get_functiondef('public._validar_ficha'::regproc);
  v_novo text;
begin
  v_novo := replace(v_def,
$a$    foreach v_campo in array array['responsavel_nome', 'responsavel_whatsapp', 'acompanhante_nome'] loop$a$,
$b$    foreach v_campo in array array['responsavel_nome', 'responsavel_whatsapp']
        || case when tg_table_name = 'equipantes'
                     and public._equipante_precisa_acompanhante((n ->> 'data_nascimento')::date)
                then array['acompanhante_nome'] else array[]::text[] end loop$b$);
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em _validar_ficha';
  end if;
  execute v_novo;
end $$;

-- 3. Versao da declaracao conforme a idade ---------------------------------
do $$
declare
  v_fn  text[][] := array[
    array['public.decidir_inscricao(uuid, text, boolean)', 'v_alvo.data_nascimento'],
    array['public.liberar_menor(uuid, boolean)', 'v_alvo.data_nascimento'],
    array['public.aprovar_em_lote(uuid[], text, text, uuid[])', 'e.data_nascimento']
  ];
  v_def text;
  v_novo text;
  i int;
begin
  for i in 1 .. array_length(v_fn, 1) loop
    v_def := pg_get_functiondef(v_fn[i][1]::regprocedure);
    v_novo := replace(v_def, $a$'20261105a'$a$, 'public._menor_declaracao_versao(' || v_fn[i][2] || ')');
    if v_novo = v_def then
      raise exception 'versao nao encontrada em %', v_fn[i][1];
    end if;
    execute v_novo;
  end loop;
end $$;

-- 4. Escolher acompanhante so para quem precisa ----------------------------
do $$
declare
  v_def text := pg_get_functiondef('public.definir_acompanhante_menor(uuid, uuid)'::regprocedure);
  v_novo text;
begin
  v_novo := replace(v_def,
$a$  v_quem := public._quem_decide_equipante(m.igreja);$a$,
$b$  if not public._equipante_precisa_acompanhante(m.data_nascimento) then
    return jsonb_build_object('ok', false, 'erro', 'Só o menor de 16 anos precisa de acompanhante.');
  end if;
  v_quem := public._quem_decide_equipante(m.igreja);$b$);
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em definir_acompanhante_menor';
  end if;
  execute v_novo;
end $$;

-- 5. Lista da aprovacao: diz quem precisa de acompanhante; 16/17 sem busca --
do $$
declare
  v_def text := pg_get_functiondef('public.menores_da_aprovacao()'::regprocedure);
  v_novo text;
begin
  v_novo := replace(v_def,
$a$           public._acompanhante_do_menor(e.id) as acompanhante$a$,
$b$           public._equipante_precisa_acompanhante(e.data_nascimento) as precisa_acompanhante,
           case when public._equipante_precisa_acompanhante(e.data_nascimento)
                then public._acompanhante_do_menor(e.id) end as acompanhante$b$);
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em menores_da_aprovacao';
  end if;
  execute v_novo;
end $$;
