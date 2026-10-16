-- Meio do pagamento manual: dinheiro ou cartao (16/10/2026, Patrick).
--
-- Na tela "Confirmar pagamento" o organizador passa a dizer se o valor foi
-- recebido em DINHEIRO ou no CARTAO -- para o financeiro conferir o caixa.
-- Coluna NULL de proposito (nunca NOT NULL em equipantes: criar_inscricao usa
-- jsonb_populate_record). Pagamentos antigos ficam sem o meio.
--
-- Passo 1 (este arquivo): aceita sem o meio, para o site antigo continuar
-- funcionando ate o novo subir. Passo 2 (20261016h): passa a exigir.

alter table public.equipantes add column if not exists pagamento_meio text;
alter table public.acampantes add column if not exists pagamento_meio text;
alter table public.equipantes drop constraint if exists equipantes_pagamento_meio_chk;
alter table public.equipantes add constraint equipantes_pagamento_meio_chk
  check (pagamento_meio is null or pagamento_meio in ('dinheiro', 'cartao'));
alter table public.acampantes drop constraint if exists acampantes_pagamento_meio_chk;
alter table public.acampantes add constraint acampantes_pagamento_meio_chk
  check (pagamento_meio is null or pagamento_meio in ('dinheiro', 'cartao'));

drop function if exists public.registrar_pagamento(text, uuid, text, numeric, text);

create or replace function public.registrar_pagamento(p_tipo text, p_id uuid, p_forma text, p_valor numeric DEFAULT NULL::numeric, p_cupom text DEFAULT NULL::text, p_meio text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_quem    text := public._nome_organizador_logado();
  v_cupom   text := nullif(upper(btrim(coalesce(p_cupom, ''))), '');
  v_meio    text := nullif(lower(btrim(coalesce(p_meio, ''))), '');
  v_desc    numeric;
  v_valor   numeric;
  v_status  text;
  v_n       int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem registrar pagamentos.');
  end if;
  if p_tipo not in ('acampante', 'equipante') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de inscrição inválido.');
  end if;
  if p_forma not in ('manual', 'pix', 'isento') then
    return jsonb_build_object('ok', false, 'erro', 'Forma de pagamento inválida.');
  end if;
  -- O meio so existe no pagamento em maos.
  if p_forma <> 'manual' then
    v_meio := null;
  elsif v_meio is not null and v_meio not in ('dinheiro', 'cartao') then
    return jsonb_build_object('ok', false, 'erro', 'Escolha se o pagamento foi em dinheiro ou no cartão.');
  end if;

  if p_forma = 'isento' then
    v_valor := 0;
    v_cupom := null;
  else
    v_valor := round(p_valor, 2);
    if v_valor is null or v_valor < 0 or v_valor > 5000 then
      return jsonb_build_object('ok', false, 'erro', 'Informe o valor recebido (entre R$ 0,00 e R$ 5.000,00).');
    end if;
  end if;

  if v_cupom is not null then
    select c.desconto_fixo into v_desc from public.cupons c where c.codigo = v_cupom and c.ativo;
    if not found then
      return jsonb_build_object('ok', false, 'erro', format('O cupom %s não existe ou não está ativo.', v_cupom));
    end if;
  end if;

  if p_tipo = 'acampante' then
    select status_pagamento into v_status from public.acampantes where id = p_id;
  else
    select status_pagamento into v_status from public.equipantes where id = p_id and tipo = 'equipante';
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if lower(coalesce(v_status, '')) in ('confirmado', 'pago', 'completed') then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição já está quitada.');
  end if;

  if p_tipo = 'acampante' then
    update public.acampantes set
      status_pagamento = 'confirmado', metodo_pagamento = p_forma, data_pagamento = now(),
      pagamento_valor = v_valor, pagamento_cupom = v_cupom, pagamento_desconto = v_desc,
      pagamento_confirmado_por = v_quem, pagamento_meio = v_meio
     where id = p_id;
  else
    update public.equipantes set
      status_pagamento = 'confirmado', metodo_pagamento = p_forma, data_pagamento = now(),
      pagamento_valor = v_valor, pagamento_cupom = v_cupom, pagamento_desconto = v_desc,
      pagamento_confirmado_por = v_quem, pagamento_meio = v_meio
     where id = p_id and tipo = 'equipante';
  end if;
  get diagnostics v_n = row_count;

  return jsonb_build_object('ok', v_n = 1, 'confirmado_por', v_quem, 'valor', v_valor, 'cupom', v_cupom, 'meio', v_meio);
end;
$function$;

grant execute on function public.registrar_pagamento(text, uuid, text, numeric, text, text) to authenticated;

-- Desfazer limpa o meio junto com o resto.
create or replace function public.desfazer_pagamento(p_tipo text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      pagamento_confirmado_por = null, pagamento_meio = null,
      pagamento_desfeito_em = now(), pagamento_desfeito_por = v_quem
     where id = p_id;
  else
    update public.equipantes set
      status_pagamento = 'pendente',
      metodo_pagamento = case when v_metodo = 'isento' then null else metodo_pagamento end,
      data_pagamento = null,
      pagamento_valor = null, pagamento_cupom = null, pagamento_desconto = null,
      pagamento_confirmado_por = null, pagamento_meio = null,
      pagamento_desfeito_em = now(), pagamento_desfeito_por = v_quem
     where id = p_id and tipo = 'equipante';
  end if;

  return jsonb_build_object('ok', true, 'nome', v_nome, 'desfeito_por', v_quem);
end;
$function$;

-- A virada de edicao tambem zera o meio.
create or replace function public.resetar_para_nova_edicao(p_nova_edicao integer, p_reuniao_inscricao date, p_reuniao_leitura date)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_equipantes int;
  v_acampantes int;
  v_escalas    int;
  v_edicao_ant int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas organizadores podem resetar a edição.');
  end if;

  if p_nova_edicao is null or p_nova_edicao < 1 then
    return jsonb_build_object('ok', false, 'erro',
      'Informe o número da nova edição.');
  end if;

  if p_reuniao_inscricao is null or p_reuniao_leitura is null then
    return jsonb_build_object('ok', false, 'erro',
      'Informe as datas da Reunião de Inscrição e da Reunião de Leitura de Escala da nova edição.');
  end if;

  select c.edicao_numero into v_edicao_ant from public.configuracoes c limit 1;

  if p_nova_edicao <= coalesce(v_edicao_ant, 0) then
    return jsonb_build_object('ok', false, 'erro', format(
      'A nova edição precisa ser maior que a atual (%s).', v_edicao_ant));
  end if;

  update public.equipantes q
     set ja_trabalhou_equipe = true,
         edicao_trabalhou    = coalesce(nullif(btrim(coalesce(q.edicao_trabalhou,'')), ''),
                                        v_edicao_ant::text)
   where exists (
     select 1 from public.escalas s
      where s.equipante_id = q.id
        and s.area_alocada <> 'Não será escalado');

  delete from public.lotes_alocacao_automatica where id is not null;
  delete from public.escalas where id is not null;
  get diagnostics v_escalas = row_count;

  delete from public.pix_sicoob where id is not null;
  delete from public.pagamentos where id is not null;

  delete from public.acampantes_vinculos where id is not null;
  delete from public.acampantes where id is not null;
  get diagnostics v_acampantes = row_count;

  update public.equipantes set
    inscrito               = false,
    status                 = 'pendente',
    scale_status           = 'pendente',
    status_pagamento       = 'pendente',
    data_pagamento         = null,
    metodo_pagamento       = null,
    id_transacao_sicoob    = null,
    txid_pix               = null,
    parental_auth_file_url = null,
    area_trabalho_opcao1   = null,
    area_trabalho_opcao2   = null,
    area_trabalho_opcao3   = null,
    area_trabalho_extra    = null,
    autorizacao_entregue_em        = null,
    autorizacao_conferida_em       = null,
    autorizacao_conferida_por      = null,
    autorizacao_conferida_por_tipo = null,
    decidido_por           = null,
    decidido_por_tipo      = null,
    decidido_por_igreja    = null,
    decidido_em            = null,
    inscrito_em            = null,
    pagamento_valor          = null,
    pagamento_cupom          = null,
    pagamento_desconto       = null,
    pagamento_confirmado_por = null,
    pagamento_meio           = null
  where tipo = 'equipante';

  update public.cupons set ativo = false where ativo;
  get diagnostics v_equipantes = row_count;

  update public.configuracoes set
    edicao_numero          = p_nova_edicao,
    escala_lancada_em      = null,
    escala_oficial_em      = null,
    inscricoes_equipantes  = false,
    permite_igreja_outra   = false,
    permite_igreja_diversos = false,
    permite_completar_cadastro_manual = false,
    inscricoes_acampantes  = false,
    escala_ordem           = 'cadastro',
    reuniao_inscricao_em   = p_reuniao_inscricao,
    reuniao_leitura_escala_em = p_reuniao_leitura
  where id is not null;

  return jsonb_build_object(
    'ok', true,
    'edicao_anterior', v_edicao_ant,
    'nova_edicao', p_nova_edicao,
    'equipantes_liberados', v_equipantes,
    'acampantes_apagados', v_acampantes,
    'escalas_apagadas', v_escalas);
end;
$$;
