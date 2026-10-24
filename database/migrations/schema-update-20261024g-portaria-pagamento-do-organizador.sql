-- ---------------------------------------------------------------------------
-- Portaria: pagamento feito por ORGANIZADOR na tela da portaria (24/10/2026)
--
-- Bug achado pelo Patrick no ambiente de teste: logado como organizador, o
-- "Pagar agora" gravava pagamento_confirmado_por = 'Desenvolvedores' (sem o
-- "Portaria: "). A tela so reconhece pagamento da portaria por esse prefixo,
-- entao o pagamento nao entrava em "Pagos na portaria" (nem na soma de
-- dinheiro/cartao) e nao tinha "Desfazer pagamento".
--
-- Agora todo pagamento feito pela tela da portaria fica "Portaria: <quem>",
-- seja conta de portaria ou organizador. Os ja gravados (marcados com a
-- observacao "Baixa na portaria") sao corrigidos.
-- ---------------------------------------------------------------------------

do $$
declare v_def text := pg_get_functiondef('public.portaria_dar_baixa(text, uuid, text, numeric, boolean)'::regprocedure);
begin
  if position('pagamento_confirmado_por = v_quem,' in v_def) = 0 then
    raise exception 'portaria_dar_baixa: trecho não encontrado';
  end if;
  execute replace(v_def, 'pagamento_confirmado_por = v_quem,',
    'pagamento_confirmado_por = case when v_quem like ''Portaria: %'' then v_quem else ''Portaria: '' || v_quem end,');
end $$;

update public.equipantes
   set pagamento_confirmado_por = 'Portaria: ' || pagamento_confirmado_por
 where pagamento_observacao = 'Baixa na portaria'
   and metodo_pagamento = 'manual'
   and pagamento_confirmado_por is not null
   and pagamento_confirmado_por not like 'Portaria: %';

update public.acampantes
   set pagamento_confirmado_por = 'Portaria: ' || pagamento_confirmado_por
 where pagamento_observacao = 'Baixa na portaria'
   and metodo_pagamento = 'manual'
   and pagamento_confirmado_por is not null
   and pagamento_confirmado_por not like 'Portaria: %';
