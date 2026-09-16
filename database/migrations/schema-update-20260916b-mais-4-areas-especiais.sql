-- Familia muculmana, Apresentadores, Equipe de Manutencao e Pastor Invisivel
-- viram areas especiais (10 ao todo), exclusivas entre si.
--
-- Familia muculmana saia de AREAS_INSCRICAO (o proprio equipante escolhia).
-- As outras tres saiam de AREAS_SOMENTE_ORGANIZADOR (o organizador ja
-- alocava a mao, mas sem exclusividade -- dava pra acumular com qualquer
-- outra area). Ver o comentario em AREAS_ESPECIAIS, em
-- src/constants/workAreas.js.
--
-- Checado antes desta migration: nenhum equipante hoje tem 2+ destas 10
-- areas ao mesmo tempo (Guia, Inimigo, Espirito Santo, Depressao,
-- Perseguidos, Infiltrados, Familia muculmana, Apresentadores, Equipe de
-- Manutencao, Pastor Invisivel) -- a exclusividade pode entrar sem
-- regressao.
--
-- Esta migration tambem generaliza a mensagem de erro de
-- alocar_equipante_manualmente/realocar_alocacao, que ate agora enumerava
-- os nomes das areas especiais na frase. Com 10 nomes a frase ja estava
-- longa demais, e cada area nova obrigava a editar estas duas funcoes so
-- por causa do texto. Agora a mensagem so diz "um dos papeis especiais",
-- sem listar -- funcionalmente identica, so nao trava mais nesse detalhe.

CREATE OR REPLACE FUNCTION public._area_especial(p_area text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select p_area in (
    'Guia', 'Inimigo', 'Espírito Santo', 'Depressão', 'Perseguidos', 'Infiltrados',
    'Família muçulmana', 'Apresentadores', 'Equipe de Manutenção', 'Pastor Invisível'
  );
$function$;

CREATE OR REPLACE FUNCTION public.alocar_equipante_manualmente(p_equipante_id uuid, p_area text)
 RETURNS TABLE(sucesso boolean, mensagem text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_equipante       RECORD;
  v_disponibilidade RECORD;
  v_area            text := public._area_canonica(p_area);
  v_especial        text;
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

  IF public._area_especial(v_area) THEN
    SELECT e.area_alocada INTO v_especial
      FROM escalas e
     WHERE e.equipante_id = p_equipante_id
       AND public._area_especial(e.area_alocada)
     LIMIT 1;
    IF v_especial IS NOT NULL THEN
      RETURN QUERY SELECT false, format(
        'Já está em %s. Cada pessoa só pode ter um dos papéis especiais.',
        v_especial);
      RETURN;
    END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.realocar_alocacao(p_escala_id uuid, p_nova_area text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_linha    RECORD;
  v_sexo     text;
  v_disp     RECORD;
  v_nova     text := public._area_canonica(p_nova_area);
  v_especial text;
BEGIN
  IF NOT public.eh_organizador() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem realocar.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  IF v_nova IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Área não informada.');
  END IF;

  SELECT e.id, e.equipante_id, e.area_alocada INTO v_linha
    FROM escalas e WHERE e.id = p_escala_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Alocação não encontrada.');
  END IF;

  IF v_linha.area_alocada = v_nova THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Já está nessa área.');
  END IF;

  IF EXISTS (SELECT 1 FROM escalas e
              WHERE e.equipante_id = v_linha.equipante_id AND e.area_alocada = v_nova) THEN
    RETURN jsonb_build_object('ok', false, 'erro',
      format('Este equipante já está em %s.', v_nova));
  END IF;

  IF public._area_especial(v_nova) THEN
    SELECT e.area_alocada INTO v_especial
      FROM escalas e
     WHERE e.equipante_id = v_linha.equipante_id
       AND e.id <> p_escala_id
       AND public._area_especial(e.area_alocada)
     LIMIT 1;
    IF v_especial IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'erro', format(
        'Já está em %s. Cada pessoa só pode ter um dos papéis especiais.',
        v_especial));
    END IF;
  END IF;

  SELECT q.sexo INTO v_sexo FROM equipantes q WHERE q.id = v_linha.equipante_id;

  SELECT * INTO v_disp FROM public._equipante_area_tem_vaga(v_nova, v_sexo);
  IF NOT v_disp.tem_vaga THEN
    RETURN jsonb_build_object('ok', false, 'erro', v_disp.motivo);
  END IF;

  UPDATE escalas
     SET area_alocada = v_nova,
         atuacao = public._atuacao_padrao(v_nova),
         cor = case when public._area_com_cor(v_nova) then cor else null end
   WHERE id = p_escala_id;

  RETURN jsonb_build_object('ok', true, 'area_anterior', v_linha.area_alocada, 'area', v_nova);
END;
$function$;

-- Familia muculmana ainda nao tinha somente_organizador = true (ela era
-- escolhida pelo proprio equipante). As outras tres ja tinham.
UPDATE public.limites_areas
   SET somente_organizador = true, updated_at = now()
 WHERE area_nome = 'Família muçulmana';

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cpfs_area_familia_muculmana jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cpfs_area_apresentadores jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cpfs_area_manutencao jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cpfs_area_pastor_invisivel jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN configuracoes.cpfs_area_familia_muculmana IS 'CPFs pre-cadastrados pelo organizador para a area especial Familia muculmana (ver AREAS_ESPECIAIS em src/constants/workAreas.js).';
COMMENT ON COLUMN configuracoes.cpfs_area_apresentadores IS 'CPFs pre-cadastrados pelo organizador para a area especial Apresentadores (ver AREAS_ESPECIAIS em src/constants/workAreas.js).';
COMMENT ON COLUMN configuracoes.cpfs_area_manutencao IS 'CPFs pre-cadastrados pelo organizador para a area especial Equipe de Manutencao (ver AREAS_ESPECIAIS em src/constants/workAreas.js).';
COMMENT ON COLUMN configuracoes.cpfs_area_pastor_invisivel IS 'CPFs pre-cadastrados pelo organizador para a area especial Pastor Invisivel (ver AREAS_ESPECIAIS em src/constants/workAreas.js).';
