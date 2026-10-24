-- ---------------------------------------------------------------------------
-- Portaria: registro de cada baixa e de cada desfazer (revisao, 24/10/2026)
--
-- A auditoria geral (_auditar) so registra acao de ORGANIZADOR: o que a
-- portaria fazia ficava so nas colunas do pagamento, que o "desfazer" apaga.
-- Ou seja: recebeu R$ 220 em dinheiro, desfez, e nao sobrava rastro de que o
-- dinheiro passou pela mao de alguem. Agora toda baixa e todo desfazer feitos
-- pela tela da portaria (portaria ou organizador) ficam em portaria_registros,
-- que nunca e apagado pelas funcoes. So leitura pelo banco (sem acesso direto).
-- ---------------------------------------------------------------------------

create table if not exists public.portaria_registros (
  id           bigserial primary key,
  em           timestamptz not null default now(),
  quem         text not null,
  acao         text not null check (acao in ('baixa', 'desfeita')),
  tipo         text not null check (tipo in ('acampante', 'equipante')),
  inscricao_id uuid not null,
  nome         text,
  meio         text,
  valor        numeric
);
alter table public.portaria_registros enable row level security;
revoke all on table public.portaria_registros from anon, authenticated;
revoke all on sequence public.portaria_registros_id_seq from anon, authenticated;

create or replace function public.portaria_dar_baixa(p_tipo text, p_id uuid, p_meio text, p_valor numeric)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem   text := public._portaria_quem();
  v_meio   text := nullif(lower(btrim(coalesce(p_meio, ''))), '');
  v_valor  numeric := round(p_valor, 2);
  v_status text;
  v_nome   text;
  v_n      int;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if p_tipo not in ('acampante', 'equipante') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de inscrição inválido.');
  end if;
  if v_meio is null or v_meio not in ('dinheiro', 'cartao') then
    return jsonb_build_object('ok', false, 'erro', 'Escolha se o pagamento foi em dinheiro ou cartão.');
  end if;
  if v_valor is null or v_valor <= 0 or v_valor > 5000 then
    return jsonb_build_object('ok', false, 'erro', 'Informe o valor recebido (maior que zero).');
  end if;

  if p_tipo = 'acampante' then
    select status_pagamento, nome into v_status, v_nome
      from public.acampantes where id = p_id and coalesce(tipo, 'acampante') = 'acampante' for update;
  else
    select status_pagamento, nome into v_status, v_nome
      from public.equipantes where id = p_id and tipo = 'equipante' for update;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if lower(coalesce(v_status, '')) in ('confirmado', 'pago', 'completed') then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição já está paga.');
  end if;
  -- A portaria so recebe de equipante que esta na escala (mesma regra do PIX).
  -- O organizador segue podendo lancar fora dela pela tela de Pagamentos.
  if p_tipo = 'equipante' and not public._equipante_na_escala(p_id) then
    return jsonb_build_object('ok', false, 'erro',
      'Este equipante não está na escala. Peça para ele procurar a organização.');
  end if;

  if p_tipo = 'acampante' then
    update public.acampantes set
      status_pagamento = 'confirmado', metodo_pagamento = 'manual', data_pagamento = now(),
      pagamento_valor = v_valor, pagamento_cupom = null, pagamento_desconto = null,
      pagamento_confirmado_por = v_quem, pagamento_meio = v_meio,
      pagamento_observacao = 'Baixa na portaria'
     where id = p_id;
  else
    update public.equipantes set
      status_pagamento = 'confirmado', metodo_pagamento = 'manual', data_pagamento = now(),
      pagamento_valor = v_valor, pagamento_cupom = null, pagamento_desconto = null,
      pagamento_confirmado_por = v_quem, pagamento_meio = v_meio,
      pagamento_observacao = 'Baixa na portaria'
     where id = p_id and tipo = 'equipante';
  end if;
  get diagnostics v_n = row_count;

  if v_n = 1 then
    insert into public.portaria_registros (quem, acao, tipo, inscricao_id, nome, meio, valor)
    values (v_quem, 'baixa', p_tipo, p_id, v_nome, v_meio, v_valor);
  end if;

  return jsonb_build_object('ok', v_n = 1, 'nome', v_nome, 'confirmado_por', v_quem,
                            'valor', v_valor, 'meio', v_meio);
end;
$fn$;

create or replace function public.portaria_desfazer_baixa(p_tipo text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem   text := public._portaria_quem();
  v_status text;
  v_metodo text;
  v_por    text;
  v_nome   text;
  v_meio   text;
  v_valor  numeric;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if p_tipo not in ('acampante', 'equipante') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de inscrição inválido.');
  end if;

  if p_tipo = 'acampante' then
    select status_pagamento, lower(coalesce(metodo_pagamento, '')), pagamento_confirmado_por, nome,
           pagamento_meio, pagamento_valor
      into v_status, v_metodo, v_por, v_nome, v_meio, v_valor
      from public.acampantes where id = p_id and coalesce(tipo, 'acampante') = 'acampante' for update;
  else
    select status_pagamento, lower(coalesce(metodo_pagamento, '')), pagamento_confirmado_por, nome,
           pagamento_meio, pagamento_valor
      into v_status, v_metodo, v_por, v_nome, v_meio, v_valor
      from public.equipantes where id = p_id and tipo = 'equipante' for update;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if lower(coalesce(v_status, '')) not in ('confirmado', 'pago', 'completed') then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição não está como paga.');
  end if;
  if v_metodo <> 'manual' or coalesce(v_por, '') not like 'Portaria: %' then
    return jsonb_build_object('ok', false, 'erro',
      'Só dá para desfazer baixa feita na portaria. Este pagamento é com a organização.');
  end if;

  if p_tipo = 'acampante' then
    update public.acampantes set
      status_pagamento = 'pendente', data_pagamento = null,
      pagamento_valor = null, pagamento_cupom = null, pagamento_desconto = null,
      pagamento_confirmado_por = null, pagamento_meio = null, pagamento_observacao = null,
      pagamento_desfeito_em = now(), pagamento_desfeito_por = v_quem
     where id = p_id;
  else
    update public.equipantes set
      status_pagamento = 'pendente', data_pagamento = null,
      pagamento_valor = null, pagamento_cupom = null, pagamento_desconto = null,
      pagamento_confirmado_por = null, pagamento_meio = null, pagamento_observacao = null,
      pagamento_desfeito_em = now(), pagamento_desfeito_por = v_quem
     where id = p_id and tipo = 'equipante';
  end if;

  insert into public.portaria_registros (quem, acao, tipo, inscricao_id, nome, meio, valor)
  values (v_quem, 'desfeita', p_tipo, p_id, v_nome, v_meio, v_valor);

  return jsonb_build_object('ok', true, 'nome', v_nome, 'desfeito_por', v_quem);
end;
$fn$;
