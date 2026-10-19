-- Presenca do lider/responsavel so no dia da Reuniao de Leitura de Escala
-- (19/10/2026, pedido do Patrick).
--
-- Depois do dia da reuniao (configuracoes.reuniao_leitura_escala_em), o lider
-- e o responsavel pela reuniao nao marcam nem desfazem presenca/ausencia.
-- Continuam vendo a lista e os telefones/WhatsApp. O organizador segue livre
-- pela chamada da organizacao (organizador_marcar_presenca, nao alterada).
-- Sem data cadastrada = fechado.

create or replace function public._presenca_reuniao_aberta()
returns boolean
language sql stable security definer
set search_path to 'public'
as $fn$
  select coalesce((select (now() at time zone 'America/Sao_Paulo')::date = c.reuniao_leitura_escala_em
                     from public.configuracoes c limit 1), false);
$fn$;
revoke all on function public._presenca_reuniao_aberta() from public, anon, authenticated;

-- 1. Servidor recusa a marcacao fora do dia
do $do$
declare
  v_def text := pg_get_functiondef('public.lider_marcar_presenca(uuid,text,text,date,uuid,boolean)'::regprocedure);
  v_ancora text := E'  if public._lider_da_participacao(p_id, p_escala_id) is null then\n';
  v_novo text := E'  if not public._presenca_reuniao_aberta() then\n'
    || E'    return jsonb_build_object(''ok'', false, ''erro'',\n'
    || E'      ''A presença só pode ser marcada no dia da reunião de leitura da escala. Fale com a organização.'');\n'
    || E'  end if;\n'
    || v_ancora;
begin
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'trecho nao encontrado (ou repetido) em lider_marcar_presenca';
  end if;
  execute replace(v_def, v_ancora, v_novo);
end;
$do$;

-- 2. A relacao diz se a presenca esta aberta (a tela esconde os botoes)
do $do$
declare
  v_def text := pg_get_functiondef('public.relacao_lider(uuid,text,text,date)'::regprocedure);
  v_ancora text := E'''escala_oficial'', (select escala_oficial_em is not null from public.configuracoes limit 1),';
  v_novo text := v_ancora || E'\n    ''presenca_aberta'', public._presenca_reuniao_aberta(),';
begin
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'trecho nao encontrado (ou repetido) em relacao_lider';
  end if;
  execute replace(v_def, v_ancora, v_novo);
end;
$do$;
