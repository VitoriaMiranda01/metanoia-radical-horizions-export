-- Tela de confirmacao para a portaria (21/10/2026, Patrick).
-- Quem concluiu (taxa de alimentacao paga + presenca confirmada na reuniao de
-- escala) abre "Inscricao confirmada" com o NOME COMPLETO, para apresentar na
-- portaria. O servidor so entrega o nome a quem prova ser o dono da inscricao
-- E esta concluido: sem os dois, devolve so o motivo, nunca o nome. Mexer na
-- tela ou na URL nao adianta.
create or replace function public.confirmacao_portaria_equipante(p_id uuid, p_cpf text, p_nome text, p_nascimento date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q record;
begin
  if not public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('ok', false, 'erro', 'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;

  select e.nome, e.status_pagamento into q
    from public.equipantes e where e.id = p_id and e.tipo = 'equipante';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  -- coalesce: sem chamada, _presenca_equipante e NULL e "not (... and NULL)"
  -- viraria NULL, o if nao dispararia e o nome sairia sem presenca confirmada.
  if not (lower(coalesce(q.status_pagamento, '')) in ('pago', 'confirmado', 'completed')
          and coalesce(public._presenca_equipante(p_id), '') = 'presente') then
    return jsonb_build_object('ok', false, 'erro', 'A confirmação só fica disponível com a presença confirmada e a taxa de alimentação paga.');
  end if;

  return jsonb_build_object('ok', true, 'nome', q.nome);
end;
$$;
revoke all on function public.confirmacao_portaria_equipante(uuid, text, text, date) from public;
grant execute on function public.confirmacao_portaria_equipante(uuid, text, text, date) to anon, authenticated;

-- verificar_inscricao (entrada pelo CPF/nome, sem login):
--  * quem concluiu e digitou o CPF recebe o nome completo (CPF e a prova de
--    dono) para a tela de confirmacao;
--  * quem concluiu e entrou SO pelo nome NAO recebe nome completo: recebe id e
--    nome como quem ainda tem pendencia e passa pela confirmacao da data de
--    nascimento antes de qualquer coisa (a tela da portaria nunca sai so pelo
--    nome digitado).
do $$
declare
  v_def text := pg_get_functiondef('public.verificar_inscricao(text,text,text)'::regprocedure);
  v_novo text;
begin
  if v_def like '%''nome_completo''%' then return; end if;
  v_novo := replace(v_def,
    $a$'primeiro_nome', split_part(btrim(coalesce(v_nome, '')), ' ', 1));$a$,
    $a$'primeiro_nome', split_part(btrim(coalesce(v_nome, '')), ' ', 1),
                              'nome_completo', btrim(coalesce(v_nome, '')));$a$);
  if v_novo = v_def then
    raise exception 'trecho não encontrado em verificar_inscricao (nome_completo)';
  end if;
  v_def := v_novo;
  v_novo := replace(v_def,
    $a$(p_tipo <> 'equipante'
                  or (public._presenca_equipante(v_id) = 'presente'$a$,
    $a$(p_tipo <> 'equipante'
                  or (v_cpf <> ''
                      and public._presenca_equipante(v_id) = 'presente'$a$);
  if v_novo = v_def then
    raise exception 'trecho não encontrado em verificar_inscricao (so CPF)';
  end if;
  execute v_novo;
end $$;
