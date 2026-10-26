-- ---------------------------------------------------------------------------
-- Desfazer pagamento por PIX, com motivo (Patrick, 25/10/2026)
--
-- Caso real: equipante pagou por PIX, desistiu e passou o valor para outra
-- equipante. O organizador da baixa manual na outra e precisa que a primeira
-- volte para "nao pagou" -- senao ela consta como paga e pode entrar no sitio.
--
-- Regras:
--   - So organizador. PIX exige motivo; em maos/isencao o motivo e opcional.
--   - A cobranca PIX NAO e apagada: vira status 'desfeito', com quem, quando e
--     o motivo. O dinheiro continua com a organizacao (nada e devolvido).
--   - Notificacao repetida do Sicoob para essa cobranca nao reconfirma nada:
--     o PIX continua 'desfeito' e a inscricao nao volta para paga
--     (equipante e acampante).
--   - Quem ja entrou pela portaria continua travado (desfazer a entrada antes).
-- ---------------------------------------------------------------------------

alter table public.pix_sicoob
  add column if not exists desfeito_em timestamptz,
  add column if not exists desfeito_por text,
  add column if not exists desfeito_motivo text;

-- Sem NOT NULL (criar_inscricao usa jsonb_populate_record em equipantes).
alter table public.equipantes  add column if not exists pagamento_desfeito_motivo text;
alter table public.acampantes  add column if not exists pagamento_desfeito_motivo text;

-- PIX desfeito nunca volta a 'pago' pelo webhook.
create or replace function public._pix_segura_fora_da_escala()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.status = 'pago' and old.status = 'desfeito' then
    new.status := 'desfeito';
    return new;
  end if;
  if new.status = 'pago' and old.status is distinct from 'pago'
     and new.inscricao_tipo = 'equipante'
     and (old.status in ('cancelado', 'fora_da_escala')
          or not public._equipante_na_escala(new.inscricao_id)) then
    new.status := 'fora_da_escala';
  end if;
  return new;
end;
$function$;

-- A inscricao nao confirma por PIX segurado (fora_da_escala) nem desfeito.
create or replace function public._inscricao_nao_confirma_pix_fora()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if lower(coalesce(new.status_pagamento, '')) in ('pago', 'confirmado', 'completed')
     and lower(coalesce(old.status_pagamento, '')) not in ('pago', 'confirmado', 'completed')
     and new.id_transacao_sicoob is not null
     and exists (select 1 from public.pix_sicoob p
                  where p.sicoob_id = new.id_transacao_sicoob and p.status in ('fora_da_escala', 'desfeito')) then
    new.status_pagamento    := old.status_pagamento;
    new.metodo_pagamento    := old.metodo_pagamento;
    new.id_transacao_sicoob := old.id_transacao_sicoob;
    new.data_pagamento      := old.data_pagamento;
  end if;
  return new;
end;
$function$;

-- Acampante nao tinha a trava (so existia o caso do equipante fora da escala).
drop trigger if exists inscricao_nao_confirma_pix_fora on public.acampantes;
create trigger inscricao_nao_confirma_pix_fora
  before update of status_pagamento on public.acampantes
  for each row execute function public._inscricao_nao_confirma_pix_fora();

drop function if exists public.desfazer_pagamento(text, uuid);

create or replace function public.desfazer_pagamento(p_tipo text, p_id uuid, p_motivo text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_quem   text := coalesce(public._nome_organizador_logado(), 'organizador');
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_status text;
  v_metodo text;
  v_nome   text;
  v_txid   text;
  v_pix    uuid;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem desfazer pagamentos.');
  end if;
  if p_tipo not in ('acampante', 'equipante') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de inscrição inválido.');
  end if;
  if length(v_motivo) > 500 then
    return jsonb_build_object('ok', false, 'erro', 'O motivo pode ter no máximo 500 caracteres.');
  end if;

  if p_tipo = 'acampante' then
    select status_pagamento, lower(coalesce(metodo_pagamento, '')), nome, id_transacao_sicoob
      into v_status, v_metodo, v_nome, v_txid
      from public.acampantes where id = p_id for update;
  else
    select status_pagamento, lower(coalesce(metodo_pagamento, '')), nome, id_transacao_sicoob
      into v_status, v_metodo, v_nome, v_txid
      from public.equipantes where id = p_id and tipo = 'equipante' for update;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if lower(coalesce(v_status, '')) not in ('confirmado', 'pago', 'completed') then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição não está como paga.');
  end if;
  if p_tipo = 'equipante' and exists (select 1 from public.portaria_entradas where equipante_id = p_id) then
    return jsonb_build_object('ok', false, 'erro',
      'Esta pessoa já entrou pela portaria. Desfaça a entrada na tela da Portaria antes de desfazer o pagamento.');
  end if;

  if v_metodo = 'pix' then
    if v_motivo is null then
      return jsonb_build_object('ok', false, 'erro', 'Informe o motivo para desfazer um pagamento por PIX.');
    end if;
    -- A cobranca paga desta ficha: a do txid gravado na ficha; senao a paga
    -- mais recente (pagamento por PIX conferido a mao nao tem cobranca).
    select id into v_pix from public.pix_sicoob
     where status = 'pago' and inscricao_id = p_id
       and case when p_tipo = 'equipante' then inscricao_tipo = 'equipante'
                else coalesce(inscricao_tipo, '') <> 'equipante' end
     order by (sicoob_id = v_txid) desc nulls last, updated_at desc
     limit 1
     for update;
    if v_pix is not null then
      update public.pix_sicoob set
        status = 'desfeito', updated_at = now(),
        desfeito_em = now(), desfeito_por = v_quem, desfeito_motivo = v_motivo
       where id = v_pix;
    end if;
  end if;

  if p_tipo = 'acampante' then
    update public.acampantes set
      status_pagamento = 'pendente',
      metodo_pagamento = case when v_metodo in ('isento', 'pix') then null else metodo_pagamento end,
      id_transacao_sicoob = case when v_metodo = 'pix' then null else id_transacao_sicoob end,
      data_pagamento = null,
      pagamento_valor = null, pagamento_cupom = null, pagamento_desconto = null,
      pagamento_confirmado_por = null, pagamento_meio = null, pagamento_observacao = null,
      pagamento_desfeito_em = now(), pagamento_desfeito_por = v_quem,
      pagamento_desfeito_motivo = v_motivo
     where id = p_id;
  else
    update public.equipantes set
      status_pagamento = 'pendente',
      metodo_pagamento = case when v_metodo in ('isento', 'pix') then null else metodo_pagamento end,
      id_transacao_sicoob = case when v_metodo = 'pix' then null else id_transacao_sicoob end,
      data_pagamento = null,
      pagamento_valor = null, pagamento_cupom = null, pagamento_desconto = null,
      pagamento_confirmado_por = null, pagamento_meio = null, pagamento_observacao = null,
      pagamento_desfeito_em = now(), pagamento_desfeito_por = v_quem,
      pagamento_desfeito_motivo = v_motivo
     where id = p_id and tipo = 'equipante';
  end if;

  return jsonb_build_object('ok', true, 'nome', v_nome, 'desfeito_por', v_quem,
    'pix_desfeito', v_pix is not null);
end;
$function$;

revoke all on function public.desfazer_pagamento(text, uuid, text) from public, anon;
grant execute on function public.desfazer_pagamento(text, uuid, text) to authenticated, service_role;
