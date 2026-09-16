-- ---------------------------------------------------------------------------
-- Depressão, Perseguidos e Infiltrados entram como áreas especiais.
-- Date: 2026-09-16
--
-- CONTEXTO
-- --------
-- A usuaria (Vitoria) pediu para acrescentar tres areas na tela de Areas
-- Especiais (o modulo de Guia/Inimigo/Espirito Santo, com cadastro previo
-- por CPF -- ver schema-update-20260915-cpfs-areas-especiais-volta.sql).
--
-- As tres ja existiam no sistema, mas em duas familias diferentes:
--   - Depressao e Infiltrados: ja eram "somente_organizador" (o organizador
--     aloca a mao, sem cadastro previo por CPF), mas SEM exclusividade --
--     uma pessoa podia acumular Depressao com qualquer outra area.
--   - Perseguidos: era o oposto -- uma das opcoes que o proprio equipante
--     escolhe no formulario de inscricao (AREAS_INSCRICAO), nunca teve
--     somente_organizador e nunca foi exclusiva.
--
-- A usuaria confirmou: mover as tres para dentro de Areas Especiais (saindo
-- de onde estavam), com a MESMA exclusividade que already vale para
-- Guia/Inimigo/Espirito Santo -- uma pessoa so pode ter UM dos seis papeis.
--
-- Nenhuma das tres tinha ninguem alocado em mais de um desses seis papeis
-- ao mesmo tempo (conferido antes desta migration), entao a nova regra nao
-- invalida escala nenhuma ja feita.
--
-- O QUE ESTA MIGRATION FAZ
-- -------------------------
-- 1. _area_especial() passa a reconhecer as 6 (era 3). E a UNICA funcao que
--    define "o que e especial" -- alocar_equipante_manualmente e
--    realocar_alocacao so a chamam, entao a exclusividade das 3 novas
--    passa a valer sem mexer na logica de nenhuma das duas.
-- 2. As mensagens de erro das duas funcoes acima, que citavam os nomes dos
--    3 papeis originais, viram um texto generico (valeria a pena continuar
--    escrevendo os 6 nomes toda vez que um setimo papel entrar).
-- 3. limites_areas.somente_organizador de Perseguidos vira true -- mesmo
--    campo que ja valia pra Depressao e Infiltrados (Guia/Inimigo/Espirito
--    Santo tambem usam esse campo, desde schema-update-20260912e). E ele
--    que tira Perseguidos do formulario de inscricao (AREAS_INSCRICAO, no
--    codigo) e da alocacao automatica (_area_com_mais_vaga e
--    alocar_fila_automaticamente ja respeitam esse campo -- nenhuma das
--    duas precisou mudar).
-- 4. Colunas cpfs_area_depressao / cpfs_area_perseguidos /
--    cpfs_area_infiltrados em configuracoes, no mesmo padrao das 3 que ja
--    existem -- usadas pelo cadastro por CPF (CpfsAreaEspecialManager.jsx)
--    e aplicadas pelo botao "Aplicar CPFs cadastrados"
--    (alocarAreasEspeciaisPorCpf, em equipanteAllocationService.js, que ja
--    itera AREAS_ESPECIAIS de forma generica e nao precisou mudar).
--
-- Quem ja tinha "Perseguidos" escolhido como uma das 3 preferencias no
-- formulario (equipantes.area_trabalho_opcao*) continua com essa resposta
-- gravada -- so deixa de contar para a alocacao automatica, exatamente como
-- ja acontecia com quem tinha uma area somente_organizador como preferencia
-- antiga. Nada e apagado.
-- ---------------------------------------------------------------------------

-- 1 e 2: _area_especial reconhece as 6, e as duas funcoes que dependem dela
-- ganham uma mensagem generica.
create or replace function public._area_especial(p_area text)
returns boolean
language sql
immutable
set search_path to 'public'
as $fn$
  select p_area in ('Guia', 'Inimigo', 'Espírito Santo', 'Depressão', 'Perseguidos', 'Infiltrados');
$fn$;

comment on function public._area_especial(text) is
  'Guia, Inimigo, Espirito Santo, Depressao, Perseguidos e Infiltrados: os seis papeis que atravessam o acampamento inteiro. Uma pessoa so pode estar em um deles.';

create or replace function public.alocar_equipante_manualmente(p_equipante_id uuid, p_area text)
returns table(sucesso boolean, mensagem text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
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
        'Já está em %s. Cada pessoa só pode ter um dos papéis especiais (Guia, Inimigo, Espírito Santo, Depressão, Perseguidos ou Infiltrados).',
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
$fn$;

create or replace function public.realocar_alocacao(p_escala_id uuid, p_nova_area text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
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
        'Já está em %s. Cada pessoa só pode ter um dos papéis especiais (Guia, Inimigo, Espírito Santo, Depressão, Perseguidos ou Infiltrados).',
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
$fn$;

-- 3: Perseguidos passa a ser somente_organizador, como Depressao e
-- Infiltrados ja eram (e como Guia/Inimigo/Espirito Santo tambem sao).
update public.limites_areas set somente_organizador = true, updated_at = now()
where area_nome = 'Perseguidos';

-- 4: as 3 colunas novas de cadastro por CPF, no mesmo padrao das 3 que ja
-- existem (schema-update-20260915-cpfs-areas-especiais-volta.sql).
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cpfs_area_depressao jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cpfs_area_perseguidos jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cpfs_area_infiltrados jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN configuracoes.cpfs_area_depressao IS
  'CPFs (so digitos) dos equipantes pre-cadastrados pelo organizador para a área Depressão. Aplicado pelo botão "Aplicar CPFs cadastrados" na tela de Geração de Escalas -- ver alocarAreasEspeciaisPorCpf.';
COMMENT ON COLUMN configuracoes.cpfs_area_perseguidos IS
  'CPFs (so digitos) dos equipantes pre-cadastrados pelo organizador para a área Perseguidos. Aplicado pelo botão "Aplicar CPFs cadastrados" na tela de Geração de Escalas -- ver alocarAreasEspeciaisPorCpf.';
COMMENT ON COLUMN configuracoes.cpfs_area_infiltrados IS
  'CPFs (so digitos) dos equipantes pre-cadastrados pelo organizador para a área Infiltrados. Aplicado pelo botão "Aplicar CPFs cadastrados" na tela de Geração de Escalas -- ver alocarAreasEspeciaisPorCpf.';
