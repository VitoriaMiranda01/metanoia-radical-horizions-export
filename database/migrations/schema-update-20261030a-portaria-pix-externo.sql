-- Portaria: "Pix externo" (30/10/2026, pedido do Patrick).
--
-- Tem equipante que pagou por PIX direto (fora do PIX do site) e so mostra o
-- comprovante na portaria. A portaria passa a registrar esse pagamento como
-- meio 'pix' -- o MESMO "PIX conferido a mao" da tela de Pagamentos
-- (20261018f): metodo_pagamento = 'manual', pagamento_meio = 'pix'. Assim ele
-- fica numa categoria a parte: nem junto do PIX automatico do Sicoob
-- (metodo_pagamento = 'pix') nem do dinheiro/cartao do caixa da portaria.
-- Sem observacao obrigatoria (Patrick).
do $mig$
declare
  v text;
begin
  v := pg_get_functiondef('public.portaria_dar_baixa(text, uuid, text, numeric, boolean)'::regprocedure);
  if position($a$v_meio is null or v_meio not in ('dinheiro', 'cartao')$a$ in v) = 0
     or position($a$'Escolha se o pagamento foi em dinheiro ou cartão.'$a$ in v) = 0 then
    raise exception 'portaria_dar_baixa: trecho nao encontrado';
  end if;
  v := replace(v, $a$v_meio is null or v_meio not in ('dinheiro', 'cartao')$a$,
                  $b$v_meio is null or v_meio not in ('dinheiro', 'cartao', 'pix')$b$);
  v := replace(v, $a$'Escolha se o pagamento foi em dinheiro ou cartão.'$a$,
                  $b$'Escolha se o pagamento foi em dinheiro, cartão ou Pix externo.'$b$);
  execute v;
end
$mig$;
