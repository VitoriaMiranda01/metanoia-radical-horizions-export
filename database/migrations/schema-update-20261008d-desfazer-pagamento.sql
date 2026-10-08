-- ---------------------------------------------------------------------------
-- Desfazer pagamento (Patrick, 08/10/2026)
--
-- Em Pagamentos > Pagos: quem confirmou um pagamento em maos (ou uma isencao)
-- por engano consegue desfazer, e a pessoa volta para "Nao pagaram".
--
--  * So pagamento em maos ou isencao. PIX nao: o dinheiro entrou pelo banco, e
--    desfazer deixaria a pessoa gerar outra cobranca e pagar duas vezes.
--  * Volta: status_pagamento = 'pendente', data e registro do pagamento
--    (valor, cupom, desconto, quem confirmou) limpos. A forma escolhida fica
--    (em maos continua em maos; isencao volta para "nao escolheu").
--  * Fica registrado quem desfez e quando (pagamento_desfeito_por/_em), alem
--    da auditoria das fichas.
-- ---------------------------------------------------------------------------

alter table public.acampantes add column if not exists pagamento_desfeito_em  timestamptz;
alter table public.acampantes add column if not exists pagamento_desfeito_por text;
alter table public.equipantes add column if not exists pagamento_desfeito_em  timestamptz;
alter table public.equipantes add column if not exists pagamento_desfeito_por text;

create or replace function public.desfazer_pagamento(p_tipo text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem   text := coalesce(public._nome_organizador_logado(), 'organizador');
  v_status text;
  v_metodo text;
  v_nome   text;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem desfazer pagamentos.');
  end if;
  if p_tipo not in ('acampante', 'equipante') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de inscrição inválido.');
  end if;

  if p_tipo = 'acampante' then
    select status_pagamento, lower(coalesce(metodo_pagamento, '')), nome into v_status, v_metodo, v_nome
      from public.acampantes where id = p_id for update;
  else
    select status_pagamento, lower(coalesce(metodo_pagamento, '')), nome into v_status, v_metodo, v_nome
      from public.equipantes where id = p_id and tipo = 'equipante' for update;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if lower(coalesce(v_status, '')) not in ('confirmado', 'pago', 'completed') then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição não está como paga.');
  end if;
  if v_metodo = 'pix' then
    return jsonb_build_object('ok', false, 'erro',
      'Pagamento por PIX não pode ser desfeito: o dinheiro entrou pelo banco.');
  end if;

  if p_tipo = 'acampante' then
    update public.acampantes set
      status_pagamento = 'pendente',
      metodo_pagamento = case when v_metodo = 'isento' then null else metodo_pagamento end,
      data_pagamento = null,
      pagamento_valor = null, pagamento_cupom = null, pagamento_desconto = null,
      pagamento_confirmado_por = null,
      pagamento_desfeito_em = now(), pagamento_desfeito_por = v_quem
     where id = p_id;
  else
    update public.equipantes set
      status_pagamento = 'pendente',
      metodo_pagamento = case when v_metodo = 'isento' then null else metodo_pagamento end,
      data_pagamento = null,
      pagamento_valor = null, pagamento_cupom = null, pagamento_desconto = null,
      pagamento_confirmado_por = null,
      pagamento_desfeito_em = now(), pagamento_desfeito_por = v_quem
     where id = p_id and tipo = 'equipante';
  end if;

  return jsonb_build_object('ok', true, 'nome', v_nome, 'desfeito_por', v_quem);
end;
$fn$;

revoke all on function public.desfazer_pagamento(text, uuid) from public, anon;
grant execute on function public.desfazer_pagamento(text, uuid) to authenticated;
