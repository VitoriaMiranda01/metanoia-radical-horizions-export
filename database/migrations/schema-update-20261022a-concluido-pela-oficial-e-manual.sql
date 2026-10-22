-- Regra de concluido depois da escala oficial (22/10/2026, Patrick).
-- "Na escala oficial nao tera presenca": a oficial ja e montada a partir da
-- presenca da reuniao de leitura. Entao:
--  * ANTES da oficial: concluido = taxa paga + presenca confirmada (como era);
--  * DEPOIS da oficial: concluido = taxa paga + estar na escala oficial (em uma
--    area de verdade, nao no "Nao sera escalado"). Presenca nao conta mais.
-- E a regra da tela da portaria (confirmacao_portaria_equipante).
--
-- Inscricao manual com a oficial lancada: o organizador ja escolhe a area; a
-- pessoa entra alocada nela, com a presenca marcada, e so o pagamento fica
-- pendente. Sem area, o servidor recusa.

create or replace function public._inscricao_concluida(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select lower(coalesce(e.status_pagamento, '')) in ('pago', 'confirmado', 'completed')
       and case when (select c.escala_oficial_em from public.configuracoes c limit 1) is not null
                then exists (select 1 from public.escalas s
                              where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado')
                     and not exists (select 1 from public.escalas s
                                      where s.equipante_id = p_id and s.area_alocada = 'Não será escalado')
                else coalesce(public._presenca_equipante(p_id), '') = 'presente'
           end
      from public.equipantes e where e.id = p_id and e.tipo = 'equipante'), false);
$$;
revoke all on function public._inscricao_concluida(uuid) from public, anon, authenticated;

create or replace function public.confirmacao_portaria_equipante(p_id uuid, p_cpf text, p_nome text, p_nascimento date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_nome text;
begin
  if not public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('ok', false, 'erro', 'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;

  select e.nome into v_nome from public.equipantes e where e.id = p_id and e.tipo = 'equipante';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  if not public._inscricao_concluida(p_id) then
    return jsonb_build_object('ok', false, 'erro', 'A confirmação só fica disponível com a inscrição concluída (taxa de alimentação paga e escala confirmada).');
  end if;

  return jsonb_build_object('ok', true, 'nome', v_nome);
end;
$$;
revoke all on function public.confirmacao_portaria_equipante(uuid, text, text, date) from public;
grant execute on function public.confirmacao_portaria_equipante(uuid, text, text, date) to anon, authenticated;

-- Inscricao manual depois da oficial: area obrigatoria + alocacao + presenca.
do $$
declare
  v_def text := pg_get_functiondef('public.inscricao_manual_equipante(jsonb)'::regprocedure);
  v_novo text;
begin
  if v_def like '%area_oficial%' then return; end if;

  v_novo := replace(v_def,
    $a$  v_areas  text[];
begin$a$,
    $a$  v_areas  text[];
  v_oficial boolean := (select c.escala_oficial_em is not null from public.configuracoes c limit 1);
  v_area_of text := public._area_canonica(nullif(btrim(coalesce(p_dados ->> 'area_oficial', '')), ''));
  v_aloc    record;
begin$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em inscricao_manual_equipante (declare)'; end if;
  v_def := v_novo;

  v_novo := replace(v_def,
    $a$  if length(v_nome) < 3 then$a$,
    $a$  -- Escala oficial lancada (22/10/2026): a pessoa entra direto numa area.
  if coalesce(v_oficial, false) then
    if v_area_of is null or v_area_of = 'Não será escalado'
       or not exists (select 1 from public.limites_areas l where l.area_nome = v_area_of) then
      return jsonb_build_object('ok', false, 'erro',
        'A escala oficial já foi lançada: escolha a área em que a pessoa vai trabalhar.');
    end if;
  end if;

  if length(v_nome) < 3 then$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em inscricao_manual_equipante (checagem)'; end if;
  v_def := v_novo;

  v_novo := replace(v_def,
    $a$  return jsonb_build_object('ok', true, 'id', v_id, 'reaproveitou', v_atual.id is not null);$a$,
    $a$  if coalesce(v_oficial, false) then
    -- Organizador escolheu a area: aloca mesmo acima do limite (decisao dele).
    select * into v_aloc from public.alocar_equipante_manualmente(v_id, v_area_of, true);
    if not coalesce(v_aloc.sucesso, false) then
      raise exception 'Não deu para alocar em %: %', v_area_of, v_aloc.mensagem;
    end if;
    insert into public.chamada_escala (escala_id, area, presente, marcado_por, marcado_em)
    select s.id, s.area_alocada, true, coalesce(v_quem, 'organização') || ' (organização)', now()
      from public.escalas s
     where s.equipante_id = v_id and s.area_alocada = v_area_of
    on conflict (escala_id) do update set presente = true, area = excluded.area,
      marcado_por = excluded.marcado_por, marcado_em = excluded.marcado_em;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'reaproveitou', v_atual.id is not null,
                            'area_oficial', case when coalesce(v_oficial, false) then v_area_of end);$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em inscricao_manual_equipante (retorno)'; end if;
  execute v_novo;
end $$;
