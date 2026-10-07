-- ---------------------------------------------------------------------------
-- "Você foi inscrito pela organização?" so na PROXIMA edicao (Patrick,
-- 07/10/2026).
--
-- A tela que acha a ficha manual pelo nome (quando o CPF digitado nao existe) e a
-- que deixa entrar pelo nome (ficha manual sem CPF) nao devem aparecer nesta
-- edicao: so a partir da proxima.
--
--  * configuracoes.permite_completar_cadastro_manual: false agora; a virada de
--    edicao (resetar_para_nova_edicao) liga.
--  * verificar_inscricao: com a opcao desligada nao devolve ha_manuais nem
--    completar_manual -- a tela nem aparece.
--  * reivindicar_cadastro_manual: recusa enquanto estiver desligada (nao da
--    para chamar direto pela API).
-- ---------------------------------------------------------------------------

create or replace function pg_temp._patch(p_fn regprocedure, p_de text, p_para text, p_vezes int default 1)
returns void
language plpgsql
as $fn$
declare
  d text := pg_get_functiondef(p_fn);
  n int := (length(d) - length(replace(d, p_de, ''))) / length(p_de);
begin
  if n <> p_vezes then
    raise exception 'patch %: esperava % ocorrencia(s) de [%], achou %', p_fn, p_vezes, left(p_de, 80), n;
  end if;
  execute replace(d, p_de, p_para);
end;
$fn$;

alter table public.configuracoes
  add column if not exists permite_completar_cadastro_manual boolean not null default false;

select pg_temp._patch(
  'public.verificar_inscricao(text,text,text)'::regprocedure,
  '''ha_manuais'', p_tipo = ''equipante'' and v_cpf <> '''' and exists (',
  '''ha_manuais'', p_tipo = ''equipante'' and v_cpf <> '''' and coalesce((select c.permite_completar_cadastro_manual from public.configuracoes c order by c.edicao_numero desc limit 1), false) and exists ('
);

select pg_temp._patch(
  'public.verificar_inscricao(text,text,text)'::regprocedure,
  '''completar_manual'', coalesce(v_completar, false)',
  '''completar_manual'', (coalesce(v_completar, false) and coalesce((select c.permite_completar_cadastro_manual from public.configuracoes c order by c.edicao_numero desc limit 1), false))'
);

select pg_temp._patch(
  'public.reivindicar_cadastro_manual(text,text)'::regprocedure,
  'begin' || chr(10) || '  if not public._cpf_valido(v_cpf) then',
  'begin' || chr(10) ||
  '  if not coalesce((select c.permite_completar_cadastro_manual from public.configuracoes c order by c.edicao_numero desc limit 1), false) then' || chr(10) ||
  '    return jsonb_build_object(''ok'', false, ''erro'', ''Esta opção só fica disponível a partir da próxima edição.'');' || chr(10) ||
  '  end if;' || chr(10) ||
  '  if not public._cpf_valido(v_cpf) then'
);

select pg_temp._patch(
  'public.resetar_para_nova_edicao(integer)'::regprocedure,
  '    permite_igreja_diversos = false,',
  '    permite_igreja_diversos = false,' || chr(10) ||
  '    permite_completar_cadastro_manual = true,'
);
