-- =============================================================================
-- Conserto do backup_estrutura (02/10/2026)
--
-- O teste de restauracao do primeiro backup real parou na linha dos buckets:
-- o campo "public" saia como t/f sem aspas (format com %s num boolean), e o
-- Postgres lia "t" como nome de coluna. Agora vai com %L ('true'/'false').
--
-- Troca so esse trecho na definicao atual, para nao reescrever a funcao
-- inteira (e nao arriscar divergir da 20261002a).
-- =============================================================================

do $m$
declare
  d text;
begin
  d := pg_get_functiondef('public.backup_estrutura'::regproc);
  if position('values (%L, %L, %s, %s, %L)' in d) = 0 then
    raise exception 'trecho dos buckets nao encontrado em backup_estrutura';
  end if;
  execute replace(d, 'values (%L, %L, %s, %s, %L)', 'values (%L, %L, %L, %s, %L)');
end;
$m$;

revoke all on function public.backup_estrutura() from public, anon, authenticated;
grant execute on function public.backup_estrutura() to service_role;
