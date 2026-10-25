-- 24/10/2026 (Patrick): tag "pago" na janela de cada area do quadro "Chamada
-- da reuniao de escala". As listas Presentes / Ausentes / Sem chamada ja
-- traziam `pago` (chamada_por_situacao); a janela da area (chamada_da_area)
-- nao. So acrescenta o campo; nada mais muda na funcao.

do $$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef('public.chamada_da_area(text)'::regprocedure) into v_def;

  v_novo := replace(v_def,
    $a$'pendencias', public._pendencias_relacao(q.id))$a$,
    $b$'pendencias', public._pendencias_relacao(q.id),
                  'pago', lower(coalesce(q.status_pagamento,'')) in ('pago','confirmado','completed'))$b$);

  if v_novo = v_def then
    raise exception 'trecho não encontrado em chamada_da_area';
  end if;

  execute v_novo;
end $$;
