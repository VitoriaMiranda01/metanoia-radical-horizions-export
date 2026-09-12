-- ---------------------------------------------------------------------------
-- As duas funcoes publicas de pagamento passam a exigir prova de que a
-- inscricao e sua
--
-- Achado na auditoria de 12/09/2026.
--
-- O PROBLEMA
-- ----------
-- registrar_metodo_pagamento e finalizar_inscricao_gratuita recebiam so o
-- id da inscricao. Elas PRECISAM ser publicas -- quem esta se inscrevendo
-- nao esta logado --, mas nao conferiam nada: qualquer pessoa podia agir
-- sobre a inscricao de qualquer outra.
--
-- E o id nao e segredo: verificar_inscricao devolve o id de quem ainda nao
-- pagou, e aceita busca so pelo NOME (o caminho de quem nao tem CPF). Ou
-- seja, bastava chutar um nome.
--
-- O estrago possivel:
--   - trocar a forma de pagamento de outra pessoa (chateacao);
--   - marcar a inscricao de outra pessoa como paga/isenta, se houver um
--     cupom que zere o valor. Os cupons ISENTO_ACAMPANTE (R$220) e
--     ISENTO_EQUIPANTE (R$80) ja existem e zeram exatamente os lotes de
--     hoje (R$220 e R$70). Estao inativos, e o Patrick decidiu deixar
--     assim, ciente disso -- mas a trava aqui vale de qualquer forma.
--
-- A CORRECAO
-- ----------
-- As duas passam a receber tambem o CPF e o nome, e conferem contra a
-- linha:
--   - inscricao COM CPF  -> o CPF tem de bater (so digitos);
--   - inscricao SEM CPF  -> o nome tem de bater (sem acento, sem
--                           maiuscula, sem espaco sobrando).
--
-- E a mesma evidencia que a propria pessoa usou para chegar ate ali, entao
-- nao atrapalha ninguem: o CPF e o nome ja viajam no estado da tela de
-- pagamento desde o formulario.
--
-- JANELA DE PUBLICACAO: esta migration entra ANTES do site novo. Durante os
-- ~20 minutos da publicacao no Hostinger, o site antigo (que ainda nao
-- manda CPF) recebe "Confirme o CPF..." em vez de gravar. Falha fechada, e
-- a base esta com zero inscricoes.
-- ---------------------------------------------------------------------------

-- Comparar nome ignorando acento, sem depender da extensao unaccent.
create or replace function public.unaccent_simples(p_texto text)
returns text
language sql immutable
set search_path to 'public'
as $fn$
  select translate(coalesce(p_texto,''),
                   'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                   'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC');
$fn$;
revoke all on function public.unaccent_simples(text) from public, anon, authenticated;

-- Conferencia compartilhada pelas duas funcoes.
create or replace function public._inscricao_e_sua(
  p_tipo text, p_id uuid, p_cpf text, p_nome text
)
returns boolean
language plpgsql stable security definer
set search_path to 'public'
as $fn$
declare
  v_cpf_linha  text;
  v_nome_linha text;
  v_cpf_dado   text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_normal     text;
begin
  if p_id is null then return false; end if;

  if p_tipo = 'equipante' then
    select regexp_replace(coalesce(e.cpf,''), '\D', '', 'g'), coalesce(e.nome,'')
      into v_cpf_linha, v_nome_linha
      from public.equipantes e where e.id = p_id;
  else
    select regexp_replace(coalesce(a.cpf,''), '\D', '', 'g'), coalesce(a.nome,'')
      into v_cpf_linha, v_nome_linha
      from public.acampantes a where a.id = p_id;
  end if;

  if not found then return false; end if;

  -- Tem CPF na ficha: e ele que prova.
  if v_cpf_linha <> '' then
    return v_cpf_dado <> '' and v_cpf_dado = v_cpf_linha;
  end if;

  -- Sem CPF (caminho de quem se inscreve so com o nome): o nome prova.
  v_normal := lower(btrim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g')));
  return v_normal <> ''
     and public.unaccent_simples(v_normal) = public.unaccent_simples(lower(btrim(regexp_replace(v_nome_linha, '\s+', ' ', 'g'))));
end;
$fn$;
revoke all on function public._inscricao_e_sua(text, uuid, text, text) from public, anon, authenticated;




-- ---------------------------------------------------------------------
-- Forma de pagamento escolhida na tela "Forma de Pagamento"
-- ---------------------------------------------------------------------
drop function if exists public.registrar_metodo_pagamento(text, uuid, text);

create or replace function public.registrar_metodo_pagamento(
  p_tipo text, p_id uuid, p_metodo text,
  p_cpf text default null, p_nome text default null
)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare v_afetadas int;
begin
  -- So os dois metodos que o site oferece. 'isento' continua sendo decisao
  -- de organizador, nunca do navegador.
  if coalesce(p_metodo,'') not in ('pix','manual') then
    return jsonb_build_object('ok', false, 'erro', 'Forma de pagamento inválida.');
  end if;

  if not public._inscricao_e_sua(p_tipo, p_id, p_cpf, p_nome) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome) usado na inscrição.');
  end if;

  if p_tipo = 'equipante' then
    update public.equipantes set metodo_pagamento = p_metodo
     where id = p_id
       and lower(coalesce(status_pagamento,'')) not in ('pago','confirmado','completed');
  else
    update public.acampantes set metodo_pagamento = p_metodo
     where id = p_id
       and lower(coalesce(status_pagamento,'')) not in ('pago','confirmado','completed');
  end if;

  get diagnostics v_afetadas = row_count;
  if v_afetadas = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada ou já quitada.');
  end if;

  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.registrar_metodo_pagamento(text, uuid, text, text, text) from public;
grant execute on function public.registrar_metodo_pagamento(text, uuid, text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- Inscricao que ficou em R$ 0,00 por cupom
--
-- Quem decide se esta zerada continua sendo o SERVIDOR: refaz a conta do
-- lote de hoje menos o desconto do cupom. O que muda e que agora tambem
-- confere de quem e a inscricao.
-- ---------------------------------------------------------------------
drop function if exists public.finalizar_inscricao_gratuita(text, uuid, text);

create or replace function public.finalizar_inscricao_gratuita(
  p_tipo text, p_id uuid, p_cupom text,
  p_cpf text default null, p_nome text default null
)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  v_valor    numeric;
  v_desconto numeric := 0;
  v_total    numeric;
  v_afetadas int;
begin
  if not public._inscricao_e_sua(p_tipo, p_id, p_cpf, p_nome) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome) usado na inscrição.');
  end if;

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
$fn$;
revoke all on function public.finalizar_inscricao_gratuita(text, uuid, text, text, text) from public;
grant execute on function public.finalizar_inscricao_gratuita(text, uuid, text, text, text) to anon, authenticated;
