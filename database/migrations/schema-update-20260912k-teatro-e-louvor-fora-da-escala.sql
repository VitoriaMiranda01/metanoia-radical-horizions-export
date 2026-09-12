-- ---------------------------------------------------------------------------
-- "Teatro" e "Louvor nas cenas" saem da geracao de escalas
--
-- Pedido do Patrick em 12/09/2026: elas nao sao cena. Sao pergunta do
-- formulario -- a pessoa marca para dizer que prefere cena teatral, ou que
-- quer tocar/cantar em cena. Quem decide para qual cena de verdade ela vai
-- (Cristolândia, Pastor Enforcado, Família, Túmulo...) e o organizador.
--
-- Entao passam a ter o mesmo tratamento de "Disponível para qualquer área":
-- continuam no formulario, mas nao sao area na tela de escalas e ninguem
-- pode ser alocado nelas. A escolha continua aparecendo embaixo do nome na
-- fila "A escalar", como sugestao -- e so isso.
--
-- No front: AREAS_SO_PREFERENCIA, em src/constants/workAreas.js.
--
-- A tela foi de 41 para 39 areas.
-- ---------------------------------------------------------------------------

delete from public.atuacoes_areas where area_nome in ('Teatro', 'Louvor nas cenas');
delete from public.limites_areas  where area_nome in ('Teatro', 'Louvor nas cenas');


-- ---------------------------------------------------------------------
-- Reforco: so alocar em area que existe em limites_areas
--
-- Antes, uma area desconhecida caia no teto padrao de 5 e a alocacao
-- PASSAVA. Um nome errado, ou uma preferencia que deixou de ser area (como
-- estas duas), criava uma "area fantasma" com gente dentro que a tela nem
-- desenha -- o mesmo tipo de sumico que os nomes divergentes causavam antes
-- da correcao de 20260912d. Agora recusa, dizendo o nome.
-- ---------------------------------------------------------------------
create or replace function public._equipante_area_tem_vaga(
  p_area text,
  p_sexo text,
  OUT tem_vaga boolean,
  OUT motivo text
)
language plpgsql stable security definer
set search_path to 'public'
as $fn$
DECLARE
  v_area                text := public._area_canonica(p_area);
  v_limite_maximo       integer;
  v_limite_mulheres     integer;
  v_limite_homens       integer;
  v_total_ocupado       integer;
  v_sexo_ocupado        integer;
  v_limite_sexo_efetivo integer; -- NULL = sem restricao especifica por sexo
BEGIN
  IF v_area IS NULL THEN
    tem_vaga := false; motivo := 'Área não informada'; RETURN;
  END IF;

  SELECT limite_maximo, limite_mulheres, limite_homens
    INTO v_limite_maximo, v_limite_mulheres, v_limite_homens
    FROM limites_areas
    WHERE area_nome = v_area;

  IF NOT FOUND THEN
    tem_vaga := false;
    motivo := format('"%s" não é uma área da escala.', v_area);
    RETURN;
  END IF;

  -- Um dos dois campos preenchido e o outro NULL significa ZERO vaga para o
  -- sexo do campo NULL (ex.: Presídio tem limite_homens e nao tem
  -- limite_mulheres -> nenhuma mulher). Os DOIS NULL = sem restricao por
  -- sexo, so o teto total conta.
  IF p_sexo = 'Feminino' THEN
    IF v_limite_mulheres IS NULL AND v_limite_homens IS NOT NULL THEN
      v_limite_sexo_efetivo := 0;
    ELSE
      v_limite_sexo_efetivo := v_limite_mulheres;
    END IF;
  ELSE
    IF v_limite_homens IS NULL AND v_limite_mulheres IS NOT NULL THEN
      v_limite_sexo_efetivo := 0;
    ELSE
      v_limite_sexo_efetivo := v_limite_homens;
    END IF;
  END IF;

  SELECT count(*) INTO v_total_ocupado
    FROM escalas WHERE area_alocada = v_area;

  SELECT count(*) INTO v_sexo_ocupado
    FROM escalas e JOIN equipantes eq ON eq.id = e.equipante_id
    WHERE e.area_alocada = v_area AND eq.sexo = p_sexo;

  IF v_total_ocupado >= v_limite_maximo THEN
    tem_vaga := false; motivo := 'Capacidade total da área atingida'; RETURN;
  END IF;

  IF v_limite_sexo_efetivo IS NOT NULL AND v_sexo_ocupado >= v_limite_sexo_efetivo THEN
    tem_vaga := false; motivo := 'Limite para o sexo atingido nesta área'; RETURN;
  END IF;

  tem_vaga := true; motivo := NULL;
END;
$fn$;
revoke all on function public._equipante_area_tem_vaga(text, text) from public, anon;
grant execute on function public._equipante_area_tem_vaga(text, text) to authenticated;


-- ---------------------------------------------------------------------
-- CONFERENCIA (feita depois de aplicar, com cracha de organizador)
-- ---------------------------------------------------------------------
--   alocar em Teatro ................. "Teatro" não é uma área da escala.
--   alocar em Louvor nas cenas ....... "Louvor nas cenas" não é uma área...
--   alocar em area inventada ......... "Area Inventada" não é uma área...
--   alocar na 3a preferencia (Selva) . Alocado com sucesso
--   areas em limites_areas ........... 39
--   atuacoes ......................... 136
--
-- Na tela: 39 blocos, nenhum Teatro nem Louvor, e a pessoa que pediu
-- "1ª Teatro · 2ª Louvor nas cenas · 3ª Selva" aparece na fila com as tres
-- escolhas visiveis e so a Selva com estrela no menu de areas.
-- ---------------------------------------------------------------------
