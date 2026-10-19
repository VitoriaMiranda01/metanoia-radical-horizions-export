-- Equipante: depois do dia da Reuniao de Leitura de Escala, o texto de
-- presenca muda para "procure o seu lider ou a coordenacao" (19/10/2026).
-- situacao_inscricao passa a devolver reuniao_leitura_passou (hoje, em
-- Brasilia, depois de configuracoes.reuniao_leitura_escala_em; sem data = false).

create or replace function public._reuniao_leitura_passou()
returns boolean
language sql stable security definer
set search_path to 'public'
as $fn$
  select coalesce((select (now() at time zone 'America/Sao_Paulo')::date > c.reuniao_leitura_escala_em
                     from public.configuracoes c limit 1), false);
$fn$;
revoke all on function public._reuniao_leitura_passou() from public, anon, authenticated;

do $do$
declare
  v_def text := pg_get_functiondef('public.situacao_inscricao(text,uuid,text,text,date)'::regprocedure);
  v_ancora text := E'''escala_oficial'', v_oficial is not null,';
  v_novo text := v_ancora || E'\n    ''reuniao_leitura_passou'', public._reuniao_leitura_passou(),';
begin
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'trecho nao encontrado (ou repetido) em situacao_inscricao';
  end if;
  execute replace(v_def, v_ancora, v_novo);
end;
$do$;
