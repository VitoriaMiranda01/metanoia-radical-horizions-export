-- ---------------------------------------------------------------------------
-- SO NO AMBIENTE DE TESTE (projeto oozwcfoidfqperbxnwkk) -- NAO aplicar no oficial.
--
-- Pedido do Patrick, 07/10/2026: o alocar automatico nao pegou as inscricoes
-- que a Raquel incluiu manualmente (sem as 3 areas de preferencia), e ela
-- estava tendo que alocar todas a mao so para poder lancar a escala. No teste,
-- a regra "so lanca com a fila zerada" fica desligada nas duas funcoes:
--   lancar_escala()          (provisoria)
--   lancar_escala_oficial()
-- A regra de "pelo menos um escalado" continua. O site tambem so ignora a fila
-- quando esta no ambiente de teste (emTeste() em OrganizerScalesPage.jsx).
--
-- LEMBRETE: ver como isso se comporta no ambiente OFICIAL e decidir o que fazer
-- com as inscricoes manuais na fila (alocar automatico sem preferencia?).
--
-- Para voltar ao normal no teste: reaplicar as definicoes das migrations
-- schema-update-20260912n (lancar_escala) e 20261005a (lancar_escala_oficial),
-- ou trocar "if false and v_faltam > 0" de volta por "if v_faltam > 0".
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

select pg_temp._patch('public.lancar_escala()'::regprocedure,
  'if v_faltam > 0 then', 'if false and v_faltam > 0 then');
select pg_temp._patch('public.lancar_escala_oficial()'::regprocedure,
  'if v_faltam > 0 then', 'if false and v_faltam > 0 then');
