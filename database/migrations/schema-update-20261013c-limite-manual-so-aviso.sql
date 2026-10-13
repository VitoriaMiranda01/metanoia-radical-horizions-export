-- ---------------------------------------------------------------------------
-- Limite da area: o automatico respeita, o manual so avisa (Patrick,
-- 13/10/2026).
--
--  * "Alocar automático": os fixos 📌 tambem respeitam o limite agora (sao
--    poucos e nunca estouram; quem nao couber fica na fila).
--  * Alocacao MANUAL (Alocar da fila, Mover, + outra area, Trocar de area,
--    fixar numa area nova): sem vaga, o banco recusa como antes; a tela
--    mostra o motivo e pergunta "alocar mesmo assim?" -- e ai chama de novo
--    com p_forcar = true, que pula SO a checagem de vaga (as outras regras,
--    como um papel especial por pessoa, continuam valendo).
--  * "Alocar em lote" continua travado no numero de vagas.
-- ---------------------------------------------------------------------------

-- Alocar da fila / + outra area ---------------------------------------------
drop function if exists public.alocar_equipante_manualmente(uuid, text);
create or replace function public.alocar_equipante_manualmente(p_equipante_id uuid, p_area text, p_forcar boolean default false)
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

  IF NOT EXISTS (SELECT 1 FROM limites_areas WHERE area_nome = v_area) THEN
    RETURN QUERY SELECT false, format('"%s" não é uma área da escala.', v_area); RETURN;
  END IF;

  IF NOT coalesce(p_forcar, false) THEN
    SELECT * INTO v_disponibilidade FROM public._equipante_area_tem_vaga(v_area, v_equipante.sexo);
    IF NOT v_disponibilidade.tem_vaga THEN
      RETURN QUERY SELECT false, v_disponibilidade.motivo; RETURN;
    END IF;
  END IF;

  INSERT INTO escalas (equipante_id, area_alocada, atuacao)
  VALUES (v_equipante.id, v_area, public._atuacao_padrao(v_area));
  UPDATE equipantes SET scale_status = 'ok' WHERE id = p_equipante_id;

  RETURN QUERY SELECT true, format('Alocado em %s.', v_area);
END;
$function$;

revoke all on function public.alocar_equipante_manualmente(uuid, text, boolean) from public, anon;
grant execute on function public.alocar_equipante_manualmente(uuid, text, boolean) to authenticated;

-- Mover -----------------------------------------------------------------------
drop function if exists public.realocar_alocacao(uuid, text);
create or replace function public.realocar_alocacao(p_escala_id uuid, p_nova_area text, p_forcar boolean default false)
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
  IF NOT public._gere_escala() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Só Desenvolvedores, Raquel e Dudu podem mudar alguém de área.');
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

  IF NOT EXISTS (SELECT 1 FROM limites_areas WHERE area_nome = v_nova) THEN
    RETURN jsonb_build_object('ok', false, 'erro', format('"%s" não é uma área da escala.', v_nova));
  END IF;

  IF NOT coalesce(p_forcar, false) THEN
    SELECT q.sexo INTO v_sexo FROM equipantes q WHERE q.id = v_linha.equipante_id;
    SELECT * INTO v_disp FROM public._equipante_area_tem_vaga(v_nova, v_sexo);
    IF NOT v_disp.tem_vaga THEN
      RETURN jsonb_build_object('ok', false, 'erro', v_disp.motivo, 'sem_vaga', true);
    END IF;
  END IF;

  UPDATE escalas
     SET area_alocada = v_nova,
         atuacao = public._atuacao_padrao(v_nova),
         cor = null
   WHERE id = p_escala_id;

  RETURN jsonb_build_object('ok', true, 'area_anterior', v_linha.area_alocada, 'area', v_nova);
END;
$function$;

revoke all on function public.realocar_alocacao(uuid, text, boolean) from public, anon;
grant execute on function public.realocar_alocacao(uuid, text, boolean) to authenticated;

-- Trocar de area (depois de lancada) -------------------------------------------
drop function if exists public.trocar_area_escala(uuid, text, text);
create or replace function public.trocar_area_escala(p_escala_id uuid, p_nova_area text, p_cor text default null, p_forcar boolean default false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r      jsonb;
  v_nova text := public._area_canonica(p_nova_area);
  v_cor  text := nullif(btrim(coalesce(p_cor, '')), '');
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  if (select escala_lancada_em from public.configuracoes limit 1) is null then
    return jsonb_build_object('ok', false, 'erro',
      'A troca de área abre depois que a escala provisória for lançada.');
  end if;
  if v_cor is not null and v_cor not in ('Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho') then
    return jsonb_build_object('ok', false, 'erro', format('"%s" não é uma cor de grupo.', v_cor));
  end if;

  r := public.realocar_alocacao(p_escala_id, p_nova_area, coalesce(p_forcar, false));
  if (r->>'ok')::boolean then
    update public.escalas
       set incluido_por = 'Troca: ' || public._nome_organizador_logado(),
           separado_de = case when area_alocada = 'Não será escalado' then separado_de end,
           separado_em = case when area_alocada = 'Não será escalado' then separado_em end,
           cor = case when public._area_com_cor(area_alocada) then v_cor end
     where id = p_escala_id;
    r := r || jsonb_build_object('cor',
      (select cor from public.escalas where id = p_escala_id));
  end if;
  return r;
end;
$function$;

revoke all on function public.trocar_area_escala(uuid, text, text, boolean) from public, anon;
grant execute on function public.trocar_area_escala(uuid, text, text, boolean) to authenticated;

-- Fixar numa area nova ----------------------------------------------------------
drop function if exists public.marcar_area_fixa(uuid, text, boolean);
create or replace function public.marcar_area_fixa(p_equipante_id uuid, p_area text, p_fixo boolean, p_forcar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_area     text := public._area_canonica(p_area);
  v_status   text;
  v_sexo     text;
  v_especial text;
  v_disp     record;
  v_alocado  boolean := false;
  v_aviso    text;
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro',
      'Só Desenvolvedores, Raquel e Dudu podem marcar alguém como fixo.');
  end if;

  if v_area is null or not exists (select 1 from public.limites_areas l where l.area_nome = v_area) then
    return jsonb_build_object('ok', false, 'erro', 'Área inválida.');
  end if;

  select q.status, q.sexo into v_status, v_sexo
    from public.equipantes q where q.id = p_equipante_id and q.tipo = 'equipante';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Equipante não encontrado.');
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  if not coalesce(p_fixo, false) then
    delete from public.equipantes_areas_fixas
     where equipante_id = p_equipante_id and area = v_area;
    return jsonb_build_object('ok', true, 'fixo', false, 'area', v_area);
  end if;

  insert into public.equipantes_areas_fixas (equipante_id, area, marcado_por)
  values (p_equipante_id, v_area, public._nome_organizador_logado())
  on conflict (equipante_id, area) do nothing;

  if v_status = 'aprovado'
     and not exists (select 1 from public.escalas e
                      where e.equipante_id = p_equipante_id and e.area_alocada = v_area) then
    if public._area_especial(v_area) then
      select e.area_alocada into v_especial
        from public.escalas e
       where e.equipante_id = p_equipante_id and public._area_especial(e.area_alocada)
       limit 1;
    end if;

    if v_especial is not null then
      v_aviso := format('Ficou marcado, mas não entrou em %s agora: já está em %s, e cada pessoa só pode ter um dos papéis especiais.',
                        v_area, v_especial);
    else
      if not coalesce(p_forcar, false) then
        select * into v_disp from public._equipante_area_tem_vaga(v_area, v_sexo);
        if not v_disp.tem_vaga then
          -- Marcado; a tela pergunta se aloca mesmo assim (p_forcar).
          return jsonb_build_object('ok', true, 'fixo', true, 'area', v_area,
                                    'alocado', false, 'sem_vaga', true, 'motivo', v_disp.motivo);
        end if;
      end if;
      insert into public.escalas (equipante_id, area_alocada, atuacao)
      values (p_equipante_id, v_area, public._atuacao_padrao(v_area));
      update public.equipantes set scale_status = 'ok' where id = p_equipante_id;
      v_alocado := true;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'fixo', true, 'area', v_area,
                            'alocado', v_alocado, 'aviso', v_aviso);
end;
$fn$;

revoke all on function public.marcar_area_fixa(uuid, text, boolean, boolean) from public, anon;
grant execute on function public.marcar_area_fixa(uuid, text, boolean, boolean) to authenticated;

-- Automatico: fixos respeitam o limite ---------------------------------------------
create or replace function pg_temp._patch(p regprocedure, de text, para text, vezes int)
returns void language plpgsql as $p$
declare d text := pg_get_functiondef(p); n int;
begin
  n := (length(d) - length(replace(d, de, ''))) / length(de);
  if n <> vezes then
    raise exception 'patch em %: esperava % ocorrencia(s) de [%], achei %', p, vezes, de, n;
  end if;
  execute replace(d, de, para);
end;
$p$;

select pg_temp._patch('public.alocar_fila_automaticamente()'::regprocedure,
  '  -- Passada zero: os fixos. Quem esta na fila vai para TODAS as suas areas
  -- fixas, antes de qualquer outra pessoa e sem olhar o limite. Nao entram no
  -- lote: o "Desfazer" nunca tira um fixo da area dele.',
  '  -- Passada zero: os fixos. Quem esta na fila vai para TODAS as suas areas
  -- fixas, antes de qualquer outra pessoa, respeitando o limite (13/10/2026:
  -- quem nao couber fica na fila). Nao entram no lote: o "Desfazer" nunca
  -- tira um fixo da area dele.', 1);

select pg_temp._patch('public.alocar_fila_automaticamente()'::regprocedure,
  '    select f.equipante_id as id, f.area
      from public.equipantes_areas_fixas f',
  '    select f.equipante_id as id, f.area, q.sexo
      from public.equipantes_areas_fixas f', 1);

select pg_temp._patch('public.alocar_fila_automaticamente()'::regprocedure,
  '       where e.equipante_id = v_pessoa.id and public._area_especial(e.area_alocada));
',
  '       where e.equipante_id = v_pessoa.id and public._area_especial(e.area_alocada));

    select * into v_vaga from public._equipante_area_tem_vaga(v_pessoa.area, v_pessoa.sexo);
    continue when not v_vaga.tem_vaga;
', 1);
