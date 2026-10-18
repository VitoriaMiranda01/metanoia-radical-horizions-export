-- PIX recebido direto, confirmado a mao (18/10/2026, pedido do Patrick).
--
-- A Raquel (e quem confirma pagamentos) passa a poder registrar "PIX" como o
-- meio de um pagamento em maos, alem de dinheiro e cartao: a pessoa pagou por
-- PIX direto na conta e o organizador confere. O pagamento continua
-- metodo_pagamento = 'manual' (quem confirmou e o valor ficam gravados) e
-- pagamento_meio = 'pix'. Assim ele aparece SEPARADO do PIX automatico do
-- Sicoob (metodo_pagamento = 'pix'), e as contas fecham: o automatico vem do
-- banco, este foi conferido por uma pessoa. Pode ser desfeito (o automatico
-- nao pode).
alter table public.equipantes drop constraint if exists equipantes_pagamento_meio_chk;
alter table public.equipantes add constraint equipantes_pagamento_meio_chk
  check (pagamento_meio is null or pagamento_meio in ('dinheiro', 'cartao', 'pix'));
alter table public.acampantes drop constraint if exists acampantes_pagamento_meio_chk;
alter table public.acampantes add constraint acampantes_pagamento_meio_chk
  check (pagamento_meio is null or pagamento_meio in ('dinheiro', 'cartao', 'pix'));

do $mig$
declare
  v text;
begin
  v := pg_get_functiondef('public.registrar_pagamento(text, uuid, text, numeric, text, text)'::regprocedure);
  if position($a$v_meio is null or v_meio not in ('dinheiro', 'cartao')$a$ in v) = 0
     or position($a$'Escolha se o pagamento foi em dinheiro ou no cartão.'$a$ in v) = 0 then
    raise exception 'registrar_pagamento: trecho nao encontrado';
  end if;
  v := replace(v, $a$v_meio is null or v_meio not in ('dinheiro', 'cartao')$a$,
                  $b$v_meio is null or v_meio not in ('dinheiro', 'cartao', 'pix')$b$);
  v := replace(v, $a$'Escolha se o pagamento foi em dinheiro ou no cartão.'$a$,
                  $b$'Escolha se o pagamento foi em dinheiro, cartão ou PIX.'$b$);
  execute v;
end
$mig$;
