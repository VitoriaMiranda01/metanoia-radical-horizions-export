-- ---------------------------------------------------------------------------
-- Gestao de pagamentos (Patrick, 07-08/10/2026)
--
-- A tela de Pagamentos so sabia QUEM pagou. Para conferir (e pegar cupom usado
-- indevidamente) faltava: quanto pagou, se usou cupom e qual, quando e quem
-- confirmou. Decisoes do Patrick:
--   * pagamento em maos: quem confirma digita o valor recebido e escolhe o
--     cupom (se houve);
--   * cupom vale para acampante e equipante (como hoje);
--   * cupom fica preso a edicao em que foi criado; na virada de edicao TODOS
--     sao desativados (nao apagados);
--   * os PIX ja pagos ficam sem cupom (nao era gravado).
--
--  1. pix_sicoob: valor_base (lote do dia), desconto e cupom_codigo. Quem grava
--     e a funcao sicoob-pix-create (oficial e teste), junto com o valor.
--  2. acampantes/equipantes: pagamento_valor, pagamento_cupom,
--     pagamento_desconto, pagamento_confirmado_por -- preenchidos quando um
--     organizador registra o pagamento (em maos, PIX travado ou isencao).
--  3. registrar_pagamento(tipo, id, forma, valor, cupom): o "Confirmar
--     pagamento" e o "Isentar" da tela passam por aqui (antes era UPDATE
--     direto do navegador, sem registro de valor nem de quem confirmou).
--  4. cupons.edicao_numero: edicao em que o cupom foi criado (os ativos hoje
--     ficam na edicao atual). A virada de edicao desativa todos.
-- ---------------------------------------------------------------------------

create or replace function pg_temp._patch(p_fn regprocedure, p_de text, p_para text, p_vezes int default 1)
returns void
language plpgsql
as $fn$
declare
  d text := pg_get_functiondef(p_fn);
  n int := (length(d) - length(replace(d, p_de, ''))) / length(p_de);
begin
  if n <> p_vezes then
    raise exception 'patch %: esperava % ocorrencia(s) de [%], achou %', p_fn, p_vezes, left(p_de, 80), n;
  end if;
  execute replace(d, p_de, p_para);
end;
$fn$;

-- 1. Cobranca PIX --------------------------------------------------------------
alter table public.pix_sicoob add column if not exists valor_base   numeric;
alter table public.pix_sicoob add column if not exists desconto     numeric;
alter table public.pix_sicoob add column if not exists cupom_codigo text;

-- 2. Fichas --------------------------------------------------------------------
alter table public.acampantes add column if not exists pagamento_valor          numeric;
alter table public.acampantes add column if not exists pagamento_cupom          text;
alter table public.acampantes add column if not exists pagamento_desconto       numeric;
alter table public.acampantes add column if not exists pagamento_confirmado_por text;
alter table public.equipantes add column if not exists pagamento_valor          numeric;
alter table public.equipantes add column if not exists pagamento_cupom          text;
alter table public.equipantes add column if not exists pagamento_desconto       numeric;
alter table public.equipantes add column if not exists pagamento_confirmado_por text;

-- 3. Registrar pagamento pelo organizador --------------------------------------
create or replace function public.registrar_pagamento(
  p_tipo text, p_id uuid, p_forma text, p_valor numeric default null, p_cupom text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem    text := public._nome_organizador_logado();
  v_cupom   text := nullif(upper(btrim(coalesce(p_cupom, ''))), '');
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
      pagamento_confirmado_por = v_quem
     where id = p_id;
  else
    update public.equipantes set
      status_pagamento = 'confirmado', metodo_pagamento = p_forma, data_pagamento = now(),
      pagamento_valor = v_valor, pagamento_cupom = v_cupom, pagamento_desconto = v_desc,
      pagamento_confirmado_por = v_quem
     where id = p_id and tipo = 'equipante';
  end if;
  get diagnostics v_n = row_count;

  return jsonb_build_object('ok', v_n = 1, 'confirmado_por', v_quem, 'valor', v_valor, 'cupom', v_cupom);
end;
$fn$;

revoke all on function public.registrar_pagamento(text, uuid, text, numeric, text) from public, anon;
grant execute on function public.registrar_pagamento(text, uuid, text, numeric, text) to authenticated;

-- 4. Cupom preso a edicao ------------------------------------------------------
alter table public.cupons add column if not exists edicao_numero int;
update public.cupons set edicao_numero = (select c.edicao_numero from public.configuracoes c limit 1)
 where ativo and edicao_numero is null;

create or replace function public._cupom_da_edicao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if new.edicao_numero is null then
    new.edicao_numero := (select c.edicao_numero from public.configuracoes c limit 1);
  end if;
  return new;
end;
$fn$;
revoke all on function public._cupom_da_edicao() from public, anon, authenticated;

do $g$
begin
  if not exists (select 1 from pg_trigger where tgname = 'cupom_da_edicao' and tgrelid = 'public.cupons'::regclass) then
    create trigger cupom_da_edicao
      before insert on public.cupons
      for each row execute function public._cupom_da_edicao();
  end if;
end
$g$;

-- 5. Virada de edicao: desativa os cupons e limpa o pagamento das fichas -------
select pg_temp._patch('public.resetar_para_nova_edicao(integer)',
  $$    decidido_em            = null,
    inscrito_em            = null
  where tipo = 'equipante';$$,
  $$    decidido_em            = null,
    inscrito_em            = null,
    pagamento_valor          = null,
    pagamento_cupom          = null,
    pagamento_desconto       = null,
    pagamento_confirmado_por = null
  where tipo = 'equipante';

  -- Cupons ficam presos a edicao: na virada, todos param de valer (nao sao
  -- apagados -- o historico de quem usou continua conferivel).
  update public.cupons set ativo = false where ativo;$$);
