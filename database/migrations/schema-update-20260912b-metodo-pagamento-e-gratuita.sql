-- ---------------------------------------------------------------------------
-- Duas operacoes do visitante que o travamento por RLS deixou quebradas
--
-- ENCONTRADO EM 12/09/2026, revisando o que ficou pendente das protecoes.
--
-- Ate o Passo 2 o navegador escrevia direto nas tabelas. Com as tabelas
-- fechadas as duas chamadas abaixo passaram a levar 401 -- e nos dois casos
-- o erro era engolido em silencio por quem chamava:
--
--   1. escolher "PIX" ou "Manual" na tela de Forma de Pagamento nunca era
--      gravado. Na tela de Pagamentos do organizador TODO MUNDO aparecia
--      como "Não Informado" -- nao dava para separar quem ia depositar de
--      quem comecou um PIX e abandonou;
--
--   2. finalizar uma inscricao que ficou em R$ 0,00 por cupom. A pessoa
--      preenchia a inscricao inteira, aplicava o cupom e recebia "Erro ao
--      finalizar", ja inscrita e pendente. Nenhum cupom ativo zera o valor
--      hoje (PASTOR da R$50 em cima de R$70), entao o caminho estava
--      inalcancavel -- mas bastava ativar um cupom de isencao.
--
-- A segunda funcao REFAZ A CONTA no servidor (valor do lote de hoje menos o
-- desconto do cupom) e so confirma se der zero. Se quem decidisse fosse o
-- navegador, bastaria chamar a funcao para sair sem pagar.
-- ---------------------------------------------------------------------------

-- Valor do lote vigente, mesma regra da Edge Function sicoob-pix-create:
-- procura o periodo que cobre HOJE no fuso de Brasilia. Sem periodo, NULL --
-- e quem chama recusa, em vez de inventar valor.
--
-- NAO cai para configuracoes.valor_acampante / valor_equipante de proposito:
-- as duas colunas guardam 15000 (lixo de uma versao antiga) e usa-las
-- cobraria R$ 15.000 de alguem.
create or replace function public._valor_do_lote(p_tipo text)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_periodos jsonb;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_item jsonb;
  v_ini date;
  v_fim date;
begin
  select case when p_tipo = 'equipante' then c.equipante_pricing_periods
              else c.acampante_pricing_periods end
    into v_periodos
  from public.configuracoes c
  limit 1;

  if v_periodos is null or jsonb_typeof(v_periodos) <> 'array' then
    return null;
  end if;

  for v_item in select * from jsonb_array_elements(v_periodos) loop
    begin
      v_ini := to_date(v_item ->> 'start_date', 'DD/MM/YYYY');
      v_fim := to_date(v_item ->> 'end_date',   'DD/MM/YYYY');
    exception when others then
      continue;  -- periodo com data mal formada: ignora em vez de quebrar
    end;

    if v_hoje between v_ini and v_fim then
      return nullif(btrim(v_item ->> 'value'), '')::numeric;
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public._valor_do_lote(text) from public, anon, authenticated;


create or replace function public.registrar_metodo_pagamento(
  p_tipo   text,
  p_id     uuid,
  p_metodo text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_afetadas int;
begin
  -- So os dois metodos que o site oferece. 'isento' continua sendo decisao
  -- de organizador, na tela de Pagamentos.
  if p_metodo is null or p_metodo not in ('pix', 'manual') then
    return jsonb_build_object('ok', false, 'erro', 'Método de pagamento inválido.');
  end if;

  -- So mexe em inscricao ainda pendente: depois de quitada, a forma de
  -- pagamento e historico e nao pode ser reescrita por quem tiver o link.
  if p_tipo = 'equipante' then
    update public.equipantes
       set metodo_pagamento = p_metodo
     where id = p_id
       and lower(coalesce(status_pagamento, '')) not in ('pago', 'confirmado', 'completed');
  else
    update public.acampantes
       set metodo_pagamento = p_metodo
     where id = p_id
       and lower(coalesce(status_pagamento, '')) not in ('pago', 'confirmado', 'completed');
  end if;

  get diagnostics v_afetadas = row_count;
  return jsonb_build_object('ok', v_afetadas > 0);
end;
$$;

revoke all on function public.registrar_metodo_pagamento(text, uuid, text) from public;
grant execute on function public.registrar_metodo_pagamento(text, uuid, text) to anon, authenticated;


create or replace function public.finalizar_inscricao_gratuita(
  p_tipo   text,
  p_id     uuid,
  p_cupom  text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_valor    numeric;
  v_desconto numeric := 0;
  v_total    numeric;
  v_afetadas int;
begin
  v_valor := public._valor_do_lote(p_tipo);
  if v_valor is null then
    return jsonb_build_object('ok', false, 'erro',
      'Não há valor configurado para hoje. Fale com a organização.');
  end if;

  select coalesce(c.desconto_fixo, 0) into v_desconto
  from public.cupons c
  where upper(btrim(c.codigo)) = upper(btrim(coalesce(p_cupom, '')))
    and c.ativo is true
  limit 1;

  v_total := v_valor - coalesce(v_desconto, 0);

  if v_total > 0 then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição não está zerada.');
  end if;

  if p_tipo = 'equipante' then
    update public.equipantes
       set status_pagamento = 'confirmado',
           metodo_pagamento = 'isento',
           data_pagamento   = now()
     where id = p_id
       and lower(coalesce(status_pagamento, '')) not in ('pago', 'confirmado', 'completed');
  else
    update public.acampantes
       set status_pagamento = 'confirmado',
           metodo_pagamento = 'isento',
           data_pagamento   = now()
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
$$;

revoke all on function public.finalizar_inscricao_gratuita(text, uuid, text) from public;
grant execute on function public.finalizar_inscricao_gratuita(text, uuid, text) to anon, authenticated;
