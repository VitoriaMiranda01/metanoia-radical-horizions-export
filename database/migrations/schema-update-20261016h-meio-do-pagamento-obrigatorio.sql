-- Passo 2 do meio do pagamento (16/10/2026): depois que o site novo subiu, o
-- servidor passa a EXIGIR dinheiro ou cartao em todo pagamento em maos.
-- (Pagamento por PIX e isencao nao tem meio.)

do $mig$
declare
  v text;
begin
  v := pg_get_functiondef('public.registrar_pagamento(text, uuid, text, numeric, text, text)'::regprocedure);
  v := replace(v,
    E'  elsif v_meio is not null and v_meio not in (''dinheiro'', ''cartao'') then',
    E'  elsif v_meio is null or v_meio not in (''dinheiro'', ''cartao'') then');
  if v not like '%v_meio is null or v_meio not in%' then
    raise exception 'trecho nao encontrado';
  end if;
  execute v;
end
$mig$;
