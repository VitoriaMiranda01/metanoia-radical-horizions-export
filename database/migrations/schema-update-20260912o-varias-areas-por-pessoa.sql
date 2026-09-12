-- ---------------------------------------------------------------------------
-- Uma pessoa pode ser escalada em mais de uma area
--
-- Pedido do Patrick em 12/09/2026, olhando as escalas oficiais. Os numeros
-- confirmam -- contando nomes distintos nas edicoes 33, 35 e 36:
--
--   ed.33   852 pessoas -> 796 em 1 area, 53 em 2, 3 em 3
--   ed.35   912 pessoas -> 861 em 1 area, 47 em 2, 4 em 3
--   ed.36   852 pessoas -> 795 em 1 area, 55 em 2, 2 em 3
--
-- O proprio Patrick esta em CRACOLANDIA + RECEPCAO SITIO nas tres edicoes.
-- Cerca de 6% da equipe trabalha em duas frentes -- e a tabela escalas nao
-- permitia isso: tinha UNIQUE (equipante_id).
--
-- O QUE MUDA NO MODELO
-- --------------------
-- escalas passa a ser "uma linha por PARTICIPACAO", nao por pessoa. Quem
-- trabalha em duas areas tem duas linhas, cada uma com a sua atuacao (o
-- Patrick e "Cracolândia" numa e "Fila / Confronto" na outra).
--
-- A trava vira (equipante_id, area_alocada): varias areas sim, a mesma area
-- duas vezes nao.
--
-- CONSEQUENCIA IMPORTANTE: "realocar o fulano" deixou de ser sem
-- ambiguidade. Todas as acoes sobre uma participacao passam a ser
-- endereçadas pelo id da LINHA (escalas.id):
--
--   realocar_alocacao(escala_id, nova_area)   move UMA participacao
--   remover_alocacao(escala_id)               tira de UMA area
--   definir_atuacao_alocacao(escala_id, x)    atuacao daquela participacao
--   alocar_equipante_manualmente(eq, area)    ACRESCENTA uma area
--
-- As duas antigas que endereçavam pela pessoa (realocar_equipante e
-- definir_atuacao_equipante) foram removidas de proposito: manter as duas
-- formas conviveria mal, e qualquer chamada velha deve falhar alto em vez
-- de mexer na participacao errada.
--
-- Onde o numero e sobre PESSOAS (contadores da tela, texto do dialogo de
-- lancamento), passou a usar count(distinct equipante_id) -- contar linhas
-- deixou de ser contar gente.
-- ---------------------------------------------------------------------------

alter table public.escalas drop constraint if exists escalas_equipante_id_unique;
create unique index if not exists escalas_equipante_area_unique
  on public.escalas (equipante_id, area_alocada);

comment on table public.escalas is
  'Uma linha por PARTICIPACAO, nao por pessoa: quem trabalha em duas areas tem duas linhas. Endereçar sempre pelo id da linha (escalas.id), nunca pelo equipante_id.';


-- ---------------------------------------------------------------------
-- Alocar: agora ACRESCENTA uma area
-- ---------------------------------------------------------------------
create or replace function public.alocar_equipante_manualmente(p_equipante_id uuid, p_area text)
returns table(sucesso boolean, mensagem text)
language plpgsql security definer
set search_path to 'public'
as $fn$
DECLARE
  v_equipante       RECORD;
  v_disponibilidade RECORD;
  v_area            text := public._area_canonica(p_area);
BEGIN
  IF NOT public.eh_organizador() THEN
    RETURN QUERY SELECT false, 'Apenas organizadores podem alocar.'::text; RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  IF v_area IS NULL THEN
    RETURN QUERY SELECT false, 'Área não informada'::text; RETURN;
  END IF;

  SELECT id, nome, sexo, status INTO v_equipante
    FROM equipantes WHERE id = p_equipante_id AND tipo = 'equipante';
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Equipante não encontrado'::text; RETURN;
  END IF;
  IF v_equipante.status <> 'aprovado' THEN
    RETURN QUERY SELECT false, 'Equipante ainda não está aprovado'::text; RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM escalas e
              WHERE e.equipante_id = p_equipante_id AND e.area_alocada = v_area) THEN
    RETURN QUERY SELECT false, format('Equipante já está em %s.', v_area); RETURN;
  END IF;

  SELECT * INTO v_disponibilidade FROM public._equipante_area_tem_vaga(v_area, v_equipante.sexo);
  IF NOT v_disponibilidade.tem_vaga THEN
    RETURN QUERY SELECT false, v_disponibilidade.motivo; RETURN;
  END IF;

  INSERT INTO escalas (equipante_id, area_alocada, atuacao)
  VALUES (v_equipante.id, v_area, public._atuacao_padrao(v_area));
  UPDATE equipantes SET scale_status = 'ok' WHERE id = p_equipante_id;

  RETURN QUERY SELECT true, format('Alocado em %s.', v_area);
END;
$fn$;
revoke all on function public.alocar_equipante_manualmente(uuid, text) from public, anon;
grant execute on function public.alocar_equipante_manualmente(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- Mover / remover / atuacao: sempre pelo id da participacao
-- ---------------------------------------------------------------------
create or replace function public.realocar_alocacao(p_escala_id uuid, p_nova_area text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
DECLARE v_linha RECORD; v_sexo text; v_disp RECORD; v_nova text := public._area_canonica(p_nova_area);
BEGIN
  IF NOT public.eh_organizador() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem realocar.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  IF v_nova IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Área não informada.');
  END IF;

  SELECT e.id, e.equipante_id, e.area_alocada INTO v_linha FROM escalas e WHERE e.id = p_escala_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Alocação não encontrada.');
  END IF;

  IF v_linha.area_alocada = v_nova THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Já está nessa área.');
  END IF;

  -- Mover para uma area onde a pessoa JA esta criaria duas linhas iguais.
  IF EXISTS (SELECT 1 FROM escalas e
              WHERE e.equipante_id = v_linha.equipante_id AND e.area_alocada = v_nova) THEN
    RETURN jsonb_build_object('ok', false, 'erro', format('Este equipante já está em %s.', v_nova));
  END IF;

  SELECT q.sexo INTO v_sexo FROM equipantes q WHERE q.id = v_linha.equipante_id;

  SELECT * INTO v_disp FROM public._equipante_area_tem_vaga(v_nova, v_sexo);
  IF NOT v_disp.tem_vaga THEN
    RETURN jsonb_build_object('ok', false, 'erro', v_disp.motivo);
  END IF;

  UPDATE escalas SET area_alocada = v_nova, atuacao = public._atuacao_padrao(v_nova)
   WHERE id = p_escala_id;

  RETURN jsonb_build_object('ok', true, 'area_anterior', v_linha.area_alocada, 'area', v_nova);
END;
$fn$;
revoke all on function public.realocar_alocacao(uuid, text) from public, anon;
grant execute on function public.realocar_alocacao(uuid, text) to authenticated;

create or replace function public.remover_alocacao(p_escala_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
DECLARE v_eq uuid; v_area text; v_restam int;
BEGIN
  IF NOT public.eh_organizador() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem remover.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  SELECT e.equipante_id, e.area_alocada INTO v_eq, v_area FROM escalas e WHERE e.id = p_escala_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Alocação não encontrada.');
  END IF;

  DELETE FROM escalas WHERE id = p_escala_id;

  -- Se era a unica, a pessoa volta para a fila "A escalar".
  SELECT count(*) INTO v_restam FROM escalas WHERE equipante_id = v_eq;
  IF v_restam = 0 THEN
    UPDATE equipantes SET scale_status = 'pendente' WHERE id = v_eq;
  END IF;

  RETURN jsonb_build_object('ok', true, 'area', v_area, 'restam', v_restam);
END;
$fn$;
revoke all on function public.remover_alocacao(uuid) from public, anon;
grant execute on function public.remover_alocacao(uuid) to authenticated;

create or replace function public.definir_atuacao_alocacao(p_escala_id uuid, p_atuacao text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
DECLARE v_area text; v_atuacao text := nullif(btrim(coalesce(p_atuacao, '')), '');
BEGIN
  IF NOT public.eh_organizador() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem mudar a atuação.');
  END IF;

  SELECT e.area_alocada INTO v_area FROM escalas e WHERE e.id = p_escala_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Alocação não encontrada.');
  END IF;

  IF v_atuacao IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM atuacoes_areas a WHERE a.area_nome = v_area AND a.atuacao = v_atuacao
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro',
      format('"%s" não é uma atuação de %s.', v_atuacao, v_area));
  END IF;

  UPDATE escalas SET atuacao = v_atuacao WHERE id = p_escala_id;
  RETURN jsonb_build_object('ok', true, 'area', v_area, 'atuacao', v_atuacao);
END;
$fn$;
revoke all on function public.definir_atuacao_alocacao(uuid, text) from public, anon;
grant execute on function public.definir_atuacao_alocacao(uuid, text) to authenticated;

drop function if exists public.definir_atuacao_equipante(uuid, text);
drop function if exists public.realocar_equipante(uuid, text);


-- ---------------------------------------------------------------------
-- Contagens: PESSOAS, nao linhas
-- ---------------------------------------------------------------------
create or replace function public.situacao_escala()
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
declare
  v_faltam int; v_escalados int; v_fora int; v_participacoes int; v_lancada timestamptz;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;

  select c.escala_lancada_em into v_lancada from public.configuracoes c limit 1;

  select count(*) into v_faltam
    from public.equipantes q
   where q.tipo = 'equipante' and q.status = 'aprovado'
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  select count(distinct e.equipante_id) into v_escalados
    from public.escalas e where e.area_alocada <> 'Não será escalado';

  -- So conta como "fora" quem NAO tem nenhuma area de verdade.
  select count(*) into v_fora from (
    select e.equipante_id from public.escalas e
     group by e.equipante_id
    having bool_and(e.area_alocada = 'Não será escalado')
  ) s;

  select count(*) into v_participacoes from public.escalas;

  return jsonb_build_object('ok', true, 'lancada_em', v_lancada,
    'faltam', v_faltam, 'escalados', v_escalados,
    'nao_serao_escalados', v_fora, 'participacoes', v_participacoes);
end;
$fn$;
revoke all on function public.situacao_escala() from public, anon;
grant execute on function public.situacao_escala() to authenticated;


-- Escalado se AO MENOS UMA das areas for de verdade.
create or replace function public.situacao_inscricao(
  p_tipo text, p_id uuid, p_cpf text default null, p_nome text default null
)
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
declare
  q record; v_lancada timestamptz;
  v_tem_area boolean; v_tem_real boolean;
  v_fora boolean; v_escalado boolean; v_pago boolean; v_menor boolean;
begin
  if not (public.eh_organizador() or public._inscricao_e_sua(p_tipo, p_id, p_cpf, p_nome)) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome) usado na inscrição.');
  end if;

  if p_tipo <> 'equipante' then
    select a.nome, a.status_pagamento into q from public.acampantes a where a.id = p_id;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
    end if;
    v_pago := lower(coalesce(q.status_pagamento,'')) in ('pago','confirmado','completed');
    return jsonb_build_object('ok', true, 'tipo', 'acampante', 'nome', q.nome,
                              'pago', v_pago, 'pode_pagar', not v_pago);
  end if;

  select e.nome, e.idade, e.status, e.status_pagamento, e.parental_auth_file_url
    into q
    from public.equipantes e
   where e.id = p_id and e.tipo = 'equipante';

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  select c.escala_lancada_em into v_lancada from public.configuracoes c limit 1;

  select count(*) > 0,
         count(*) filter (where s.area_alocada <> 'Não será escalado') > 0
    into v_tem_area, v_tem_real
    from public.escalas s where s.equipante_id = p_id;

  v_pago  := lower(coalesce(q.status_pagamento,'')) in ('pago','confirmado','completed');
  v_menor := coalesce(q.idade, 18) < 18;

  v_escalado := v_lancada is not null and v_tem_real;
  v_fora     := v_lancada is not null and v_tem_area and not v_tem_real;

  return jsonb_build_object(
    'ok', true, 'tipo', 'equipante', 'nome', q.nome,
    'menor_de_idade', v_menor,
    'autorizacao_pais_enviada', q.parental_auth_file_url is not null,
    'aprovacao', coalesce(q.status, 'pendente'),
    'escala_lancada', v_lancada is not null,
    'escalado', v_escalado,
    'nao_sera_escalado', v_fora,
    'pago', v_pago,
    'pode_pagar', (coalesce(q.status,'') = 'aprovado')
                  and v_escalado
                  and (not v_menor or q.parental_auth_file_url is not null)
                  and not v_pago
  );
end;
$fn$;
revoke all on function public.situacao_inscricao(text, uuid, text, text) from public;
grant execute on function public.situacao_inscricao(text, uuid, text, text) to anon, authenticated;


-- Cancelamento apaga TODAS as participacoes da pessoa.
create or replace function public.liberar_vaga_e_realocar(p_equipante_id uuid)
returns table(
  vaga_liberada boolean, area_liberada text,
  novo_alocado_id uuid, novo_alocado_nome text, novo_alocado_area text
)
language plpgsql security definer
set search_path to 'public'
as $fn$
DECLARE v_areas text; v_teve boolean;
BEGIN
  IF NOT public._pode_escalar_equipante(p_equipante_id) THEN
    RAISE EXCEPTION 'Sem permissão para liberar a vaga deste equipante' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  SELECT string_agg(e.area_alocada, ' e ' ORDER BY e.area_alocada)
    INTO v_areas FROM escalas e WHERE e.equipante_id = p_equipante_id;
  v_teve := v_areas IS NOT NULL;

  IF v_teve THEN
    DELETE FROM escalas WHERE equipante_id = p_equipante_id;
    UPDATE equipantes SET scale_status = 'pendente' WHERE id = p_equipante_id;
  END IF;

  RETURN QUERY SELECT v_teve, v_areas, NULL::uuid, NULL::text, NULL::text;
END;
$fn$;
revoke all on function public.liberar_vaga_e_realocar(uuid) from public, anon;
grant execute on function public.liberar_vaga_e_realocar(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- CONFERENCIA (com o caso real do Patrick)
-- ---------------------------------------------------------------------
--   acrescentar 2a area (Recepcao Sitio) .... Alocado em Recepção Sítio.
--   repetir a mesma area .................... Equipante já está em Recepção Sítio.
--   acrescentar 3a area (Seguranca) ......... Alocado em Segurança.
--   areas dele .............................. Cracolândia (Cracolândia) +
--                                             Recepção Sítio (Fila / Confronto) +
--                                             Segurança (Segurança)
--   mover SO a de Seguranca para Cozinha .... ok, as outras duas intactas
--   mover para area onde ja esta ............ recusado
--   remover uma das tres .................... ok, restam 2
--   painel ................................... escalados 1, participacoes 2
--
-- Na tela: duas tabelas com a mesma pessoa, selo "+1" ao lado do nome,
-- atuacao diferente em cada uma, contador "1 escalados (2 funções)", e o
-- botao "+" acrescentando uma terceira area sem tirar das outras.
-- ---------------------------------------------------------------------
