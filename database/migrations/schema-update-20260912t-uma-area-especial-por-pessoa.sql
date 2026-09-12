-- ---------------------------------------------------------------------------
-- Guia, Inimigo e Espírito Santo: uma pessoa, no maximo uma delas.
--
-- POR QUE
-- -------
-- Desde que a escala passou a aceitar varias areas por pessoa (migration
-- 20260912o), nada impedia a mesma pessoa de ser Guia E Inimigo. O Patrick
-- viu isso acontecendo na tela (12/09/2026): "ZZ Ana Beatriz Souza"
-- aparecendo nas duas listas ao mesmo tempo.
--
-- Nao e um detalhe de tela: sao os tres papeis que atravessam o acampamento
-- inteiro, cada um com um roteiro proprio e simultaneo. A mesma pessoa nao
-- tem como cumprir dois. Acumular duas areas COMUNS continua valendo -- e
-- pedido do Patrick e acontece nas escalas oficiais.
--
-- ONDE A REGRA MORA
-- -----------------
-- Aqui no banco, nas duas portas por onde uma alocacao nasce ou muda de
-- lugar (alocar_equipante_manualmente e realocar_alocacao). A tela tambem
-- vai evitar o caso, mas a tela e sugestao: quem garante e o servidor -- o
-- botao "Alocar Áreas Especiais", que trabalha em lote a partir dos CPFs
-- configurados, passa exatamente por estas duas funcoes.
-- ---------------------------------------------------------------------------

-- Uma funcao so, para as duas portas usarem a MESMA definicao de "especial".
-- Se um dia entrar um quarto papel desses, muda aqui e vale nos dois lugares.
create or replace function public._area_especial(p_area text)
returns boolean
language sql
immutable
set search_path to 'public'
as $fn$
  select p_area in ('Guia', 'Inimigo', 'Espírito Santo');
$fn$;

comment on function public._area_especial(text) is
  'Guia, Inimigo e Espírito Santo: os tres papeis que atravessam o acampamento inteiro. Uma pessoa so pode estar em um deles.';

revoke all on function public._area_especial(text) from public;
revoke all on function public._area_especial(text) from anon;
revoke all on function public._area_especial(text) from authenticated;

-- ---------------------------------------------------------------------------
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

  -- Uma area especial por pessoa.
  IF public._area_especial(v_area) THEN
    SELECT e.area_alocada INTO v_especial
      FROM escalas e
     WHERE e.equipante_id = p_equipante_id
       AND public._area_especial(e.area_alocada)
     LIMIT 1;
    IF v_especial IS NOT NULL THEN
      RETURN QUERY SELECT false, format(
        'Já está em %s. Cada pessoa só pode ter um dos papéis Guia, Inimigo ou Espírito Santo.',
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

-- ---------------------------------------------------------------------------
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

  -- Uma area especial por pessoa. A linha que esta MUDANDO nao conta: trocar
  -- de Guia para Inimigo e legitimo (mudou de papel, continua com um so).
  IF public._area_especial(v_nova) THEN
    SELECT e.area_alocada INTO v_especial
      FROM escalas e
     WHERE e.equipante_id = v_linha.equipante_id
       AND e.id <> p_escala_id
       AND public._area_especial(e.area_alocada)
     LIMIT 1;
    IF v_especial IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'erro', format(
        'Já está em %s. Cada pessoa só pode ter um dos papéis Guia, Inimigo ou Espírito Santo.',
        v_especial));
    END IF;
  END IF;

  SELECT q.sexo INTO v_sexo FROM equipantes q WHERE q.id = v_linha.equipante_id;

  SELECT * INTO v_disp FROM public._equipante_area_tem_vaga(v_nova, v_sexo);
  IF NOT v_disp.tem_vaga THEN
    RETURN jsonb_build_object('ok', false, 'erro', v_disp.motivo);
  END IF;

  UPDATE escalas
     SET area_alocada = v_nova, atuacao = public._atuacao_padrao(v_nova)
   WHERE id = p_escala_id;

  RETURN jsonb_build_object('ok', true, 'area_anterior', v_linha.area_alocada, 'area', v_nova);
END;
$fn$;
