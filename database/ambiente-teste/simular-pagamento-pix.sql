-- SO NO PROJETO DE TESTE (oozwcfoidfqperbxnwkk). Faz o que o webhook do
-- Sicoob faz no oficial: marca a cobranca como paga e confirma a inscricao.
create or replace function public.simular_pagamento_pix(p_sicoob_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v record;
begin
  select id, status, inscricao_id, inscricao_tipo into v
    from public.pix_sicoob where sicoob_id = p_sicoob_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Cobrança não encontrada.');
  end if;
  if v.status = 'pago' then
    return jsonb_build_object('ok', true, 'ja_pago', true);
  end if;

  update public.pix_sicoob set status = 'pago', updated_at = now() where id = v.id;

  if v.inscricao_tipo = 'equipante' then
    update public.equipantes
       set status_pagamento = 'confirmado', metodo_pagamento = 'pix',
           id_transacao_sicoob = p_sicoob_id, data_pagamento = now()
     where id = v.inscricao_id;
  else
    update public.acampantes
       set status_pagamento = 'confirmado', metodo_pagamento = 'pix',
           id_transacao_sicoob = p_sicoob_id, data_pagamento = now()
     where id = v.inscricao_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.simular_pagamento_pix(text) from public;
grant execute on function public.simular_pagamento_pix(text) to anon, authenticated;
