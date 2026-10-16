-- Cupom em porcentagem e "so para pastores" (16/10/2026, pedido da Raquel).
--
-- "Cupom de 50% para os pastores, mas so quem esta registrado no sistema como
-- pastor poderia usar -- senao varias pessoas vao querer usar e perdemos o
-- controle."
--
--  * cupons.percentual (1 a 99): desconto em % do lote do dia. Nunca 100: a
--    isencao continua sendo decisao do organizador, nunca de cupom.
--  * cupons.so_pastor: so vale para quem esta registrado como pastor:
--      - cargo na igreja PASTOR(A) ou PASTOR(A) AUXILIAR (ou marcado "e_pastor"),
--      - ou o CPF esta na lista de Pastores Parceiros (pastores_parceiros).
--  * UMA regra no servidor (_cupom_para) para todos os caminhos: a tela do
--    visitante, a cobranca PIX (funcao sicoob-pix-create), a inscricao gratuita
--    e a confirmacao de pagamento em maos pelo organizador.
--  * O cupom PASTOR (R$ 50 fixos, valia para qualquer um; ninguem usou ainda)
--    vira 50% e so para pastores.

alter table public.cupons add column if not exists percentual numeric;
alter table public.cupons add column if not exists so_pastor boolean not null default false;
alter table public.cupons drop constraint if exists cupons_percentual_chk;
alter table public.cupons add constraint cupons_percentual_chk
  check (percentual is null or (percentual > 0 and percentual < 100));
-- Um cupom e de valor fixo OU de porcentagem.
alter table public.cupons drop constraint if exists cupons_fixo_ou_percentual_chk;
alter table public.cupons add constraint cupons_fixo_ou_percentual_chk
  check (percentual is null or desconto_fixo = 0);

-- ------------------------------------------------------------------ pastor
create or replace function public._e_pastor(p_tipo text, p_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_cargo text;
  v_epastor boolean;
  v_cpf text;
begin
  if p_tipo = 'equipante' then
    select upper(btrim(coalesce(e.cargo_igreja, ''))), coalesce(e.e_pastor, false),
           regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g')
      into v_cargo, v_epastor, v_cpf
      from public.equipantes e where e.id = p_id and e.tipo = 'equipante';
  else
    select upper(btrim(coalesce(a.cargo_igreja, ''))), false,
           regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g')
      into v_cargo, v_epastor, v_cpf
      from public.acampantes a where a.id = p_id;
  end if;
  if not found then return false; end if;

  if v_cargo in ('PASTOR(A)', 'PASTOR(A) AUXILIAR') or v_epastor then
    return true;
  end if;
  return v_cpf <> '' and exists (
    select 1 from public.pastores_parceiros pp
     where pp.removido_em is null
       and regexp_replace(coalesce(pp.cpf, ''), '\D', '', 'g') = v_cpf);
end;
$$;

-- ------------------------------------------------------------------ a regra
-- { valido, codigo, desconto, percentual, motivo } para UMA pessoa e um preco.
-- motivo: 'inexistente' | 'so_pastor' (so quando valido = false)
create or replace function public._cupom_para(p_codigo text, p_tipo text, p_id uuid, p_preco numeric)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.cupons;
  v_desc numeric;
begin
  select * into c from public.cupons x
   where upper(btrim(x.codigo)) = upper(btrim(coalesce(p_codigo, ''))) and x.ativo is true
   limit 1;
  if not found then
    return jsonb_build_object('valido', false, 'desconto', 0, 'motivo', 'inexistente');
  end if;
  if c.so_pastor and not public._e_pastor(p_tipo, p_id) then
    return jsonb_build_object('valido', false, 'desconto', 0, 'codigo', c.codigo, 'motivo', 'so_pastor');
  end if;
  v_desc := case when c.percentual is not null
                 then round(coalesce(p_preco, 0) * c.percentual / 100, 2)
                 else c.desconto_fixo end;
  return jsonb_build_object('valido', true, 'codigo', c.codigo, 'desconto', coalesce(v_desc, 0),
                            'percentual', c.percentual, 'so_pastor', c.so_pastor);
end;
$$;

revoke all on function public._e_pastor(text, uuid), public._cupom_para(text, text, uuid, numeric)
  from public, anon, authenticated;

-- ------------------------------------------------------------------ visitante
-- Com a prova de dono (CPF, ou nome + nascimento), para o cupom "so pastor".
create or replace function public.validar_cupom_inscricao(p_tipo text, p_id uuid, p_codigo text,
  p_cpf text default null, p_nome text default null, p_nascimento date default null)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_preco numeric;
begin
  if p_tipo not in ('acampante', 'equipante')
     or not public._inscricao_e_sua(p_tipo, p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('valido', false, 'desconto', 0, 'motivo', 'identidade');
  end if;
  v_preco := public._valor_do_lote(p_tipo);
  return public._cupom_para(p_codigo, p_tipo, p_id, v_preco);
end;
$$;

grant execute on function public.validar_cupom_inscricao(text, uuid, text, text, text, date) to anon, authenticated;

-- A validacao antiga (so com o codigo) so serve cupom de valor fixo e aberto a
-- todos: os de porcentagem e os "so pastor" dependem de saber quem pergunta.
create or replace function public.validar_cupom(p_codigo text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('valido', true, 'desconto', c.desconto_fixo)
       from public.cupons c
      where upper(c.codigo) = upper(trim(coalesce(p_codigo, '')))
        and c.ativo = true and c.so_pastor = false and c.percentual is null
      limit 1),
    jsonb_build_object('valido', false, 'desconto', 0));
$$;

-- ------------------------------------------------------------------ organizador
-- Os cupons ativos como valem para ESTA pessoa (a janela "Confirmar pagamento").
create or replace function public.cupons_do_pagamento(p_tipo text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_preco numeric := public._valor_do_lote(p_tipo);
begin
  if not public.eh_organizador() then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(public._cupom_para(c.codigo, p_tipo, p_id, v_preco)
                     || jsonb_build_object('codigo', c.codigo, 'percentual', c.percentual, 'so_pastor', c.so_pastor)
                     order by c.codigo)
      from public.cupons c where c.ativo is true), '[]'::jsonb);
end;
$$;

grant execute on function public.cupons_do_pagamento(text, uuid) to authenticated;

-- Pagamento em maos: o desconto e a regra "so pastor" vem do servidor.
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
  v_res     jsonb;
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
  if p_forma <> 'manual' then
    v_meio := null;
  elsif v_meio is null or v_meio not in ('dinheiro', 'cartao') then
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
    v_res := public._cupom_para(v_cupom, p_tipo, p_id, public._valor_do_lote(p_tipo));
    if not (v_res ->> 'valido')::boolean then
      return jsonb_build_object('ok', false, 'erro',
        case v_res ->> 'motivo'
          when 'so_pastor' then format('O cupom %s é só para pastores, e esta pessoa não está registrada como pastor no sistema.', v_cupom)
          else format('O cupom %s não existe ou não está ativo.', v_cupom) end);
    end if;
    v_desc := (v_res ->> 'desconto')::numeric;
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

-- Inscricao zerada pelo cupom: a mesma regra (percentual nunca zera).
create or replace function public.finalizar_inscricao_gratuita(p_tipo text, p_id uuid, p_cupom text, p_cpf text DEFAULT NULL::text, p_nome text DEFAULT NULL::text, p_nascimento date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_valor    numeric;
  v_desconto numeric := 0;
  v_total    numeric;
  v_afetadas int;
begin
  if not public._inscricao_e_sua(p_tipo, p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;

  v_valor := public._valor_do_lote(p_tipo);
  if v_valor is null then
    return jsonb_build_object('ok', false, 'erro',
      'Não há valor configurado para hoje. Fale com a organização.');
  end if;

  v_desconto := coalesce((public._cupom_para(p_cupom, p_tipo, p_id, v_valor) ->> 'desconto')::numeric, 0);

  v_total := v_valor - coalesce(v_desconto, 0);

  if v_total > 0 then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição não está zerada.');
  end if;

  if p_tipo = 'equipante' then
    update public.equipantes
       set status_pagamento = 'confirmado', metodo_pagamento = 'isento', data_pagamento = now()
     where id = p_id
       and lower(coalesce(status_pagamento, '')) not in ('pago', 'confirmado', 'completed');
  else
    update public.acampantes
       set status_pagamento = 'confirmado', metodo_pagamento = 'isento', data_pagamento = now()
     where id = p_id
       and lower(coalesce(status_pagamento, '')) not in ('pago', 'confirmado', 'completed');
  end if;

  get diagnostics v_afetadas = row_count;
  if v_afetadas = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada ou já quitada.');
  end if;

  insert into public.pagamentos (valor, status, data_pagamento, created_at, updated_at,
                                 equipante_id, acampante_id)
  values (0, 'completed', now(), now(), now(),
          case when p_tipo = 'equipante' then p_id end,
          case when p_tipo = 'equipante' then null else p_id end);

  return jsonb_build_object('ok', true);
end;
$function$;

-- O cupom PASTOR: 50% e so para pastores (ninguem tinha usado).
update public.cupons set percentual = 50, desconto_fixo = 0, so_pastor = true
 where upper(codigo) = 'PASTOR';
