-- Portaria: "Agendar pagamento" (30/10/2026, pedido do Patrick, autorizado pela Raquel).
--
-- Abaixo de "Pagar agora", a portaria pode agendar o pagamento de um equipante:
-- data combinada (qualquer data) e observacao OBRIGATORIA. Grava na mesma
-- cobrancas_equipantes do organizador (status 'agendado'), com marcado_por
-- "Portaria: <nome>" -- entao aparece sozinho em Pagamentos > Pagamento agendado,
-- ganha "Liberar entrada" na portaria e, sem pagar ate a virada, vira debito
-- (20261025e). A portaria so desfaz o agendamento que ela mesma fez e antes da
-- entrada. Mesmas travas do "Pagar agora": escala, carta do So Domingo, infiltrado.
--  * portaria_registros.acao ganha 'agendado' e 'agendado_desfeito'.
--  * portaria_agendar_pagamento(p_id, p_data, p_observacao)
--  * portaria_desfazer_agendamento(p_id)
--  * portaria_lista ganha agendado_por e agendado_obs.

alter table public.portaria_registros drop constraint if exists portaria_registros_acao_check;
alter table public.portaria_registros add constraint portaria_registros_acao_check
  check (acao = any (array['baixa', 'desfeita', 'entrada', 'entrada_desfeita', 'carta', 'carta_desfeita',
                           'agendado', 'agendado_desfeito']));

create or replace function public.portaria_agendar_pagamento(p_id uuid, p_data date, p_observacao text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_quem   text := public._portaria_quem();
  v_obs    text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_status text;
  v_nome   text;
  v_marca  text;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if p_data is null then
    return jsonb_build_object('ok', false, 'erro', 'Escolha a data combinada para o pagamento.');
  end if;
  if v_obs is null then
    return jsonb_build_object('ok', false, 'erro', 'Escreva na observação o que foi combinado.');
  end if;
  if length(v_obs) > 200 then
    return jsonb_build_object('ok', false, 'erro', 'A observação pode ter no máximo 200 caracteres.');
  end if;

  select status_pagamento, nome into v_status, v_nome
    from public.equipantes where id = p_id and tipo = 'equipante' for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if lower(coalesce(v_status, '')) in ('confirmado', 'pago', 'completed') then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição já está paga.');
  end if;
  if exists (select 1 from public.cobrancas_equipantes c where c.equipante_id = p_id and c.status = 'agendado') then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa já tem pagamento agendado.');
  end if;
  if public._e_infiltrado('equipante', p_id) then
    return jsonb_build_object('ok', false, 'erro', 'Infiltrado entra junto com os acampantes, não pela portaria dos equipantes.');
  end if;
  if public._so_domingo_falta_carta(p_id) then
    return jsonb_build_object('ok', false, 'erro',
      'Falta receber a carta de autorização pastoral. Toque em "Receber carta" antes de agendar.');
  end if;
  if not public._equipante_na_escala(p_id) and not public._so_domingo_sem_aprovacao(p_id) then
    return jsonb_build_object('ok', false, 'erro',
      'Este equipante não está na escala. Peça para ele procurar a organização.');
  end if;

  v_marca := case when v_quem like 'Portaria: %' then v_quem else 'Portaria: ' || v_quem end;

  -- Quem estava "Em cobrança" passa para agendado (a cobrança continua a mesma).
  insert into public.cobrancas_equipantes (equipante_id, status, agendado_para, observacao, marcado_por, marcado_em)
  values (p_id, 'agendado', p_data, v_obs, v_marca, now())
  on conflict (equipante_id) do update
     set status = 'agendado', agendado_para = excluded.agendado_para, observacao = excluded.observacao,
         marcado_por = excluded.marcado_por, marcado_em = now();

  insert into public.portaria_registros (quem, acao, tipo, inscricao_id, nome)
  values (v_quem, 'agendado', 'equipante', p_id, v_nome);

  return jsonb_build_object('ok', true, 'nome', v_nome, 'agendado_para', p_data, 'marcado_por', v_marca);
end;
$$;
revoke all on function public.portaria_agendar_pagamento(uuid, date, text) from public, anon;
grant execute on function public.portaria_agendar_pagamento(uuid, date, text) to authenticated;

create or replace function public.portaria_desfazer_agendamento(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_quem text := public._portaria_quem();
  v_nome text;
  v_por  text;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;

  select nome into v_nome from public.equipantes where id = p_id and tipo = 'equipante' for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  select marcado_por into v_por from public.cobrancas_equipantes
   where equipante_id = p_id and status = 'agendado';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não tem pagamento agendado.');
  end if;
  if coalesce(v_por, '') not like 'Portaria: %' then
    return jsonb_build_object('ok', false, 'erro',
      'Só dá para desfazer agendamento feito na portaria. Este foi combinado com a organização.');
  end if;
  if exists (select 1 from public.portaria_entradas where equipante_id = p_id) then
    return jsonb_build_object('ok', false, 'erro',
      'Esta pessoa já entrou. Desfaça a entrada antes de desfazer o agendamento.');
  end if;

  delete from public.cobrancas_equipantes where equipante_id = p_id;
  insert into public.portaria_registros (quem, acao, tipo, inscricao_id, nome)
  values (v_quem, 'agendado_desfeito', 'equipante', p_id, v_nome);

  return jsonb_build_object('ok', true, 'nome', v_nome);
end;
$$;
revoke all on function public.portaria_desfazer_agendamento(uuid) from public, anon;
grant execute on function public.portaria_desfazer_agendamento(uuid) to authenticated;

-- Lista: quem agendou e o que foi combinado.
do $mig$
declare
  v text := pg_get_functiondef('public.portaria_lista()'::regprocedure);
  v_novo text;
begin
  if v like '%agendado_por%' then return; end if;
  v_novo := replace(v,
    $a$             'metodo', lower(coalesce(e.metodo_pagamento, '')),$a$,
    $b$             'agendado_por', (select c.marcado_por from public.cobrancas_equipantes c
                                where c.equipante_id = e.id and c.status = 'agendado'),
             'agendado_obs', (select c.observacao from public.cobrancas_equipantes c
                                where c.equipante_id = e.id and c.status = 'agendado'),
             'metodo', lower(coalesce(e.metodo_pagamento, '')),$b$);
  if v_novo = v then raise exception 'portaria_lista: trecho nao encontrado'; end if;
  execute v_novo;
end
$mig$;
