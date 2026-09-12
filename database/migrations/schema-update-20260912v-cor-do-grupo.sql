-- ---------------------------------------------------------------------------
-- Cor do grupo: identificacao separada da atuacao.
--
-- O PROBLEMA
-- ----------
-- Nove areas trabalham divididas pelas cores dos grupos de trilha (Amarelo,
-- Azul, Roxo, Verde, Vermelho). Ate agora a cor era gravada no campo
-- ATUACAO -- ou seja, a mesma coluna respondia "que cor voce acompanha?" e
-- "o que voce faz aqui?", e so cabia uma resposta.
--
-- Isso quebrava justamente o que o Patrick descreveu (12/09/2026): pode
-- haver 5 guias no vermelho e 5 no verde, e cada cor tem UM lider. Com a cor
-- ocupando o campo de atuacao, nao havia onde dizer quem era o lider -- e
-- Invisivel tinha contornado isso inventando dez atuacoes ("Líder / Amarelo",
-- "Líder / Azul"...), o que nao escala e nao valia para as outras oito.
--
-- O CONSERTO
-- ----------
-- A cor vira uma coluna propria em escalas, opcional (e identificacao, nao
-- obrigacao) e so aceita nessas nove areas. A atuacao volta a ser so a
-- funcao: Guia ou Líder, Apoio ou Drone. Com os dois campos separados, "um
-- lider por cor" e simplesmente uma pessoa com atuacao Líder em cada cor --
-- varios lideres na mesma area, sem nada de especial no modelo.
--
-- As areas: Espírito Santo, Fotografia, Guia, Infiltrados, Inimigo,
-- Invisível, Marcador, Pastor Invisível e Recepção Sítio. Em Fotografia o
-- Drone continua sendo atuacao (e uma funcao, nao uma cor) e convive com a
-- cor, como o Patrick pediu.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. A coluna
-- ---------------------------------------------------------------------------
alter table public.escalas
  add column if not exists cor text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'escalas_cor_valida') then
    alter table public.escalas
      add constraint escalas_cor_valida
      check (cor is null or cor in ('Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho'));
  end if;
end $$;

comment on column public.escalas.cor is
  'Cor do grupo de trilha (Amarelo/Azul/Roxo/Verde/Vermelho). Opcional, e so faz sentido nas areas de _area_com_cor(). E identificacao: nao muda regra nenhuma.';

-- ---------------------------------------------------------------------------
-- 2. Quais areas trabalham por cor
-- ---------------------------------------------------------------------------
create or replace function public._area_com_cor(p_area text)
returns boolean
language sql
immutable
set search_path to 'public'
as $fn$
  select p_area in (
    'Espírito Santo', 'Fotografia', 'Guia', 'Infiltrados', 'Inimigo',
    'Invisível', 'Marcador', 'Pastor Invisível', 'Recepção Sítio'
  );
$fn$;

comment on function public._area_com_cor(text) is
  'Areas que se dividem pelas cores dos grupos de trilha. Precisa continuar espelhando AREAS_COM_COR em src/constants/workAreas.js.';

revoke all on function public._area_com_cor(text) from public;
revoke all on function public._area_com_cor(text) from anon;
revoke all on function public._area_com_cor(text) from authenticated;

-- ---------------------------------------------------------------------------
-- 3. O que ja estava gravado: tira a cor de dentro da atuacao
--
-- Feito ANTES de mexer no catalogo, para ainda dar para reconhecer os
-- valores antigos.
-- ---------------------------------------------------------------------------

-- "Líder / Amarelo" (só existia em Invisível) -> cor Amarelo, atuacao Líder
update public.escalas
   set cor = btrim(split_part(atuacao, '/', 2)),
       atuacao = 'Líder'
 where public._area_com_cor(area_alocada)
   and atuacao like 'Líder /%'
   and btrim(split_part(atuacao, '/', 2)) in ('Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho');

-- "Amarelo" puro -> cor Amarelo, atuacao volta a ser a funcao padrao da area
update public.escalas
   set cor = atuacao,
       atuacao = case area_alocada
                   when 'Espírito Santo'  then 'Espírito Santo'
                   when 'Fotografia'      then 'Apoio'
                   when 'Guia'            then 'Guia'
                   when 'Infiltrados'     then 'Infiltrado'
                   when 'Inimigo'         then 'Inimigo'
                   when 'Invisível'       then 'Invisível'
                   when 'Marcador'        then 'Marcador'
                   when 'Pastor Invisível' then 'Pastor invisível'
                   when 'Recepção Sítio'  then 'Fila / Confronto'
                 end
 where public._area_com_cor(area_alocada)
   and atuacao in ('Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho');

-- ---------------------------------------------------------------------------
-- 4. O catalogo de atuacoes dessas nove areas passa a ser so de FUNCOES
-- ---------------------------------------------------------------------------
delete from public.atuacoes_areas
 where public._area_com_cor(area_nome);

insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider) values
  ('Espírito Santo',   'Espírito Santo',   1, true,  false),
  ('Espírito Santo',   'Líder',            2, false, true),

  -- Drone e funcao, nao cor: quem pilota o drone tambem pode acompanhar uma
  -- cor. Por isso ele fica aqui e a cor fica na coluna nova.
  ('Fotografia',       'Apoio',            1, true,  false),
  ('Fotografia',       'Líder',            2, false, true),
  ('Fotografia',       'Drone',            3, false, false),

  ('Guia',             'Guia',             1, true,  false),
  ('Guia',             'Líder',            2, false, true),

  ('Infiltrados',      'Infiltrado',       1, true,  false),
  ('Infiltrados',      'Líder',            2, false, true),

  ('Inimigo',          'Inimigo',          1, true,  false),
  ('Inimigo',          'Líder',            2, false, true),

  ('Invisível',        'Invisível',        1, true,  false),
  ('Invisível',        'Líder',            2, false, true),

  ('Marcador',         'Marcador',         1, true,  false),
  ('Marcador',         'Líder',            2, false, true),

  ('Pastor Invisível', 'Pastor invisível', 1, true,  false),
  ('Pastor Invisível', 'Líder',            2, false, true),

  ('Recepção Sítio',   'Fila / Confronto', 1, true,  false),
  ('Recepção Sítio',   'Celular / Mesa',   2, false, false),
  ('Recepção Sítio',   'Líder',            3, false, true);

-- Quem tinha atuacao que sumiu do catalogo fica com a padrao da area.
update public.escalas e
   set atuacao = public._atuacao_padrao(e.area_alocada)
 where public._area_com_cor(e.area_alocada)
   and e.atuacao is not null
   and not exists (
     select 1 from public.atuacoes_areas a
      where a.area_nome = e.area_alocada and a.atuacao = e.atuacao);

-- ---------------------------------------------------------------------------
-- 5. Definir a cor de uma alocacao
--
-- Mesma forma de definir_atuacao_alocacao: organizador, uma alocacao por vez,
-- e o proprio banco recusa cor em area que nao trabalha por cor.
-- ---------------------------------------------------------------------------
create or replace function public.definir_cor_alocacao(p_escala_id uuid, p_cor text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_area text;
  v_cor  text := nullif(btrim(coalesce(p_cor, '')), '');
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem mudar a cor.');
  end if;

  select e.area_alocada into v_area from public.escalas e where e.id = p_escala_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Alocação não encontrada.');
  end if;

  if v_cor is not null then
    if not public._area_com_cor(v_area) then
      return jsonb_build_object('ok', false, 'erro',
        format('%s não trabalha dividida por cores.', v_area));
    end if;
    if v_cor not in ('Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho') then
      return jsonb_build_object('ok', false, 'erro', format('"%s" não é uma cor de grupo.', v_cor));
    end if;
  end if;

  update public.escalas set cor = v_cor where id = p_escala_id;

  return jsonb_build_object('ok', true, 'area', v_area, 'cor', v_cor);
end;
$fn$;

revoke all on function public.definir_cor_alocacao(uuid, text) from public;
revoke all on function public.definir_cor_alocacao(uuid, text) from anon;
grant execute on function public.definir_cor_alocacao(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Mudar de area limpa a cor quando a area nova nao trabalha por cor
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
     SET area_alocada = v_nova,
         atuacao = public._atuacao_padrao(v_nova),
         -- Cor so existe nas areas que trabalham por cor. Ir para uma que
         -- nao trabalha assim apaga a cor, senao ela ficaria escondida na
         -- linha e voltaria sozinha se a pessoa retornasse.
         cor = case when public._area_com_cor(v_nova) then cor else null end
   WHERE id = p_escala_id;

  RETURN jsonb_build_object('ok', true, 'area_anterior', v_linha.area_alocada, 'area', v_nova);
END;
$fn$;
