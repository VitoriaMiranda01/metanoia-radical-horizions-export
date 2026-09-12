-- ---------------------------------------------------------------------------
-- Geracao de escalas: conserta a alocacao pelo parceiro, o coringa
-- "Disponível para qualquer área" e os tetos de cada area.
--
-- Encontrado no teste de ponta a ponta de 12/09/2026 (120 equipantes de
-- teste, distribuicao copiada das edicoes 33/35/36).
--
-- ACHADO 1 -- ALOCACAO PELO PARCEIRO NAO FUNCIONAVA (o mais grave)
-- ----------------------------------------------------------------
-- As 4 funcoes de alocacao nasceram SECURITY INVOKER, quando qualquer
-- visitante ainda podia escrever em escalas. Depois de trancar as tabelas
-- (schema-update-20260911c) so o organizador tem policy em escalas -- e
-- quem aprova a maior parte dos equipantes e o PARCEIRO da igreja.
-- Reproduzido em producao, com o cracha de parceiro da igreja 01:
--
--   parceiro enxerga em escalas ....... 0 linhas   (o real eram 100)
--   alocar_equipante_automaticamente .. ERRO 42501:
--       new row violates row-level security policy for table "escalas"
--   liberar_vaga_e_realocar ........... ERRO 42501 (mesma coisa)
--
-- Como equipanteAllocationService.js engole o erro de proposito (para nao
-- travar a aprovacao), ninguem via nada: a inscricao ficava 'aprovado',
-- scale_status ficava 'pendente' e a pessoa nunca entrava na escala.
-- Silenciosamente, para TODO equipante aprovado por parceiro.
--
-- E, antes mesmo do erro, a conta de vagas ja estaria errada: como o
-- parceiro nao enxerga nenhuma linha de escalas, _equipante_area_tem_vaga
-- acharia todas as areas vazias e estouraria todos os limites.
--
-- Correcao: as funcoes passam a ser SECURITY DEFINER (rodam com os
-- privilegios do dono, entao enxergam a tabela inteira e conseguem gravar)
-- e cada uma passa a conferir POR DENTRO quem esta chamando. Isto e mais
-- restritivo que o estado anterior, nao menos: antes bastava ter cracha de
-- qualquer tipo para chamar as 4 funcoes.
--
--   alocar_equipante_automaticamente .. organizador, ou parceiro DA IGREJA
--                                       daquele equipante
--   liberar_vaga_e_realocar ........... idem
--   alocar_equipante_manualmente ...... so organizador (acao da tela de escalas)
--   realocar_equipante ................ so organizador (idem)
--
-- Quando quem chama e parceiro, liberar_vaga_e_realocar continua puxando
-- alguem da lista de espera para a vaga -- mas devolve o nome em branco: a
-- pessoa realocada pode ser de outra igreja, e parceiro nao ve gente de
-- outra igreja. A tela ja trata esse caso ("Ninguém na lista de espera se
-- encaixou nela por enquanto").
--
-- ACHADO 2 -- "Disponível para qualquer área" VIRAVA UM DEPOSITO
-- -------------------------------------------------------------
-- Ela e uma PREFERENCIA ("me ponha onde precisar"), nao um lugar de
-- trabalho -- nao existe nas escalas oficiais das edicoes 33/35/36. Mas a
-- funcao tratava como area normal: as pessoas iam todas para la e, passado
-- o teto (15), caiam na lista de espera. Justamente quem tinha dito que
-- aceitava qualquer coisa.
--
-- Agora essa opcao e resolvida na hora: a pessoa vai para a area
-- configurada com MAIS VAGAS LIVRES naquele momento, o que tambem espalha
-- o pessoal em vez de amontoar. Ficam de fora as 3 areas especiais (Guia,
-- Inimigo, Espírito Santo), que sao escolhidas por CPF pelo organizador.
--
-- ACHADO 3 -- TETOS DE 5 PESSOAS EM 25 DAS 30 AREAS
-- -------------------------------------------------
-- So 5 areas tinham limite configurado; as outras 25 caiam no padrao de 5.
-- Nas edicoes reais a Selva tem 129-153 pessoas, o Invisível 99-119, a
-- Cristolândia 91-108. Do jeito que estava, a escala automatica pararia
-- em ~150 pessoas e a Vitoria teria de alocar ~700 na mao, uma a uma.
-- No teste: 120 equipantes -> 24 na lista de espera com quase todas as
-- areas em 5/5.
--
-- Os tetos abaixo saem das 3 edicoes oficiais (arquivos do Patrick), pelo
-- MAIOR valor das tres, arredondado para cima. Sao um ponto de partida: a
-- propria tela de Geracao de Escalas deixa a Vitoria editar cada um.
--
-- ACHADO 4 -- 5 NOMES DE AREA DIVERGENTES ENTRE FORMULARIO E ESCALAS
-- ------------------------------------------------------------------
-- Corrigido no front (src/constants/workAreas.js virou fonte unica). Aqui
-- vai so a normalizacao do que ja estiver gravado -- hoje nao ha nenhuma
-- inscricao em producao, entao e no-op; fica para o caso de rodar em
-- alguma base que ja tenha dados.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 0. Normaliza nomes de area ja gravados (no-op numa base vazia)
-- ---------------------------------------------------------------------
create or replace function public._area_canonica(p_area text)
returns text
language sql immutable
set search_path to 'public'
as $fn$
  select case btrim(coalesce(p_area, ''))
    when 'Fotografia (necessário possuir equipamento próprio)' then 'Fotografia'
    when 'Hospital (cena teatral)'                             then 'Hospital (Cena teatral)'
    when 'Oração itinerante'                                   then 'Oração Itinerante'
    when 'Pastor enforcado'                                    then 'Pastor Enforcado'
    when 'Primeiros socorros – Saúde'                          then 'Primeiros socorros - Saúde'
    else nullif(btrim(coalesce(p_area, '')), '')
  end;
$fn$;
revoke all on function public._area_canonica(text) from public, anon, authenticated;

update public.equipantes set
  area_trabalho_opcao1 = public._area_canonica(area_trabalho_opcao1),
  area_trabalho_opcao2 = public._area_canonica(area_trabalho_opcao2),
  area_trabalho_opcao3 = public._area_canonica(area_trabalho_opcao3)
where public._area_canonica(area_trabalho_opcao1) is distinct from area_trabalho_opcao1
   or public._area_canonica(area_trabalho_opcao2) is distinct from area_trabalho_opcao2
   or public._area_canonica(area_trabalho_opcao3) is distinct from area_trabalho_opcao3;

update public.escalas set area_alocada = public._area_canonica(area_alocada)
where public._area_canonica(area_alocada) is distinct from area_alocada;

update public.limites_areas set area_nome = public._area_canonica(area_nome)
where public._area_canonica(area_nome) is distinct from area_nome;


-- ---------------------------------------------------------------------
-- 1. Quem pode mexer na escala deste equipante
-- ---------------------------------------------------------------------
-- SECURITY DEFINER porque precisa ler equipantes.igreja mesmo quando quem
-- chama e um parceiro (que so enxerga a propria igreja por RLS) -- e e
-- exatamente isso que estamos conferindo.
create or replace function public._pode_escalar_equipante(p_equipante_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $fn$
  select public.eh_organizador()
      or (
        public.eh_parceiro()
        and exists (
          select 1 from public.equipantes q
          where q.id = p_equipante_id
            and q.igreja is not null
            and q.igreja like public.jwt_igreja() || ' - %'
        )
      );
$fn$;
revoke all on function public._pode_escalar_equipante(uuid) from public;
grant execute on function public._pode_escalar_equipante(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 2. Tem vaga nesta area, para este sexo?
--
-- Mesma regra de antes; muda so o SECURITY DEFINER (para contar as linhas
-- de escalas de verdade, e nao as que o chamador enxerga) e a
-- canonicalizacao do nome da area.
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
    tem_vaga := false;
    motivo := 'Área não informada';
    RETURN;
  END IF;

  SELECT limite_maximo, limite_mulheres, limite_homens
    INTO v_limite_maximo, v_limite_mulheres, v_limite_homens
    FROM limites_areas
    WHERE area_nome = v_area;

  IF NOT FOUND THEN
    -- Area nunca configurada: mesmo padrao do front (DEFAULT_AREA_CAPACITY,
    -- em src/constants/workAreas.js).
    v_limite_maximo := 5;
    v_limite_mulheres := NULL;
    v_limite_homens := NULL;
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
    tem_vaga := false;
    motivo := 'Capacidade total da área atingida';
    RETURN;
  END IF;

  IF v_limite_sexo_efetivo IS NOT NULL AND v_sexo_ocupado >= v_limite_sexo_efetivo THEN
    tem_vaga := false;
    motivo := 'Limite para o sexo atingido nesta área';
    RETURN;
  END IF;

  tem_vaga := true;
  motivo := NULL;
END;
$fn$;
revoke all on function public._equipante_area_tem_vaga(text, text) from public;
grant execute on function public._equipante_area_tem_vaga(text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Coringa: para onde vai quem marcou "Disponível para qualquer área"
--
-- A area configurada com mais vagas livres agora. Fora as 3 especiais
-- (escolhidas por CPF) e a propria opcao coringa.
-- ---------------------------------------------------------------------
create or replace function public._area_com_mais_vaga(p_sexo text)
returns text
language sql stable security definer
set search_path to 'public'
as $fn$
  select l.area_nome
    from public.limites_areas l
   where l.area_nome not in (
           'Disponível para qualquer área', 'Guia', 'Inimigo', 'Espírito Santo'
         )
     and (public._equipante_area_tem_vaga(l.area_nome, p_sexo)).tem_vaga
   order by l.limite_maximo
            - (select count(*) from public.escalas e where e.area_alocada = l.area_nome) desc,
            l.area_nome
   limit 1;
$fn$;
revoke all on function public._area_com_mais_vaga(text) from public;
grant execute on function public._area_com_mais_vaga(text) to authenticated;


-- ---------------------------------------------------------------------
-- 4. Alocacao automatica (chamada logo apos a aprovacao)
-- ---------------------------------------------------------------------
create or replace function public.alocar_equipante_automaticamente(p_equipante_id uuid)
returns table(alocado boolean, area_alocada text)
language plpgsql security definer
set search_path to 'public'
as $fn$
DECLARE
  v_equipante      RECORD;
  v_area           text;
  v_destino        text;
  v_area_existente text;
  v_disponibilidade RECORD;
BEGIN
  IF NOT public._pode_escalar_equipante(p_equipante_id) THEN
    RAISE EXCEPTION 'Sem permissão para escalar este equipante'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  SELECT id, nome, sexo, status,
         area_trabalho_opcao1, area_trabalho_opcao2, area_trabalho_opcao3
    INTO v_equipante
    FROM equipantes
    WHERE id = p_equipante_id AND tipo = 'equipante';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  IF v_equipante.status <> 'aprovado' THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  -- Idempotente: se ja tem alocacao, devolve a existente sem mexer.
  SELECT e.area_alocada INTO v_area_existente FROM escalas e WHERE e.equipante_id = p_equipante_id;
  IF FOUND THEN
    RETURN QUERY SELECT true, v_area_existente;
    RETURN;
  END IF;

  FOREACH v_area IN ARRAY ARRAY[
    v_equipante.area_trabalho_opcao1,
    v_equipante.area_trabalho_opcao2,
    v_equipante.area_trabalho_opcao3
  ] LOOP
    v_area := public._area_canonica(v_area);
    CONTINUE WHEN v_area IS NULL;

    IF v_area = 'Disponível para qualquer área' THEN
      -- Nao e um lugar: e "me ponha onde precisar".
      v_destino := public._area_com_mais_vaga(v_equipante.sexo);
      IF v_destino IS NULL THEN
        CONTINUE;
      END IF;
    ELSE
      SELECT * INTO v_disponibilidade
        FROM public._equipante_area_tem_vaga(v_area, v_equipante.sexo);
      IF NOT v_disponibilidade.tem_vaga THEN
        CONTINUE;
      END IF;
      v_destino := v_area;
    END IF;

    INSERT INTO escalas (equipante_id, area_alocada) VALUES (v_equipante.id, v_destino);
    UPDATE equipantes SET scale_status = 'ok' WHERE id = p_equipante_id;

    RETURN QUERY SELECT true, v_destino;
    RETURN;
  END LOOP;

  -- Nenhuma das 3 opcoes tinha vaga: fica na lista de espera, que e
  -- simplesmente "aprovado e sem linha em escalas".
  RETURN QUERY SELECT false, NULL::text;
END;
$fn$;


-- ---------------------------------------------------------------------
-- 5. Alocacao manual da lista de espera (tela de escalas -- so organizador)
-- ---------------------------------------------------------------------
create or replace function public.alocar_equipante_manualmente(p_equipante_id uuid, p_area text)
returns table(sucesso boolean, mensagem text)
language plpgsql security definer
set search_path to 'public'
as $fn$
DECLARE
  v_equipante       RECORD;
  v_disponibilidade RECORD;
  v_area_existente  text;
  v_area            text := public._area_canonica(p_area);
BEGIN
  IF NOT public.eh_organizador() THEN
    RETURN QUERY SELECT false, 'Apenas organizadores podem alocar manualmente.'::text;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  IF v_area IS NULL THEN
    RETURN QUERY SELECT false, 'Área não informada'::text;
    RETURN;
  END IF;

  SELECT id, nome, sexo, status INTO v_equipante
    FROM equipantes WHERE id = p_equipante_id AND tipo = 'equipante';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Equipante não encontrado'::text;
    RETURN;
  END IF;

  IF v_equipante.status <> 'aprovado' THEN
    RETURN QUERY SELECT false, 'Equipante ainda não está aprovado'::text;
    RETURN;
  END IF;

  SELECT e.area_alocada INTO v_area_existente FROM escalas e WHERE e.equipante_id = p_equipante_id;
  IF FOUND THEN
    RETURN QUERY SELECT false, format('Equipante já está alocado em %s', v_area_existente);
    RETURN;
  END IF;

  SELECT * INTO v_disponibilidade FROM public._equipante_area_tem_vaga(v_area, v_equipante.sexo);
  IF NOT v_disponibilidade.tem_vaga THEN
    RETURN QUERY SELECT false, v_disponibilidade.motivo;
    RETURN;
  END IF;

  INSERT INTO escalas (equipante_id, area_alocada) VALUES (v_equipante.id, v_area);
  UPDATE equipantes SET scale_status = 'ok' WHERE id = p_equipante_id;

  RETURN QUERY SELECT true, 'Alocado com sucesso'::text;
END;
$fn$;


-- ---------------------------------------------------------------------
-- 6. Realocacao de quem JA esta alocado (tela de escalas -- so organizador)
-- ---------------------------------------------------------------------
create or replace function public.realocar_equipante(p_equipante_id uuid, p_nova_area text)
returns table(sucesso boolean, mensagem text, area_anterior text)
language plpgsql security definer
set search_path to 'public'
as $fn$
DECLARE
  v_equipante       RECORD;
  v_disponibilidade RECORD;
  v_area_atual      text;
  v_nova            text := public._area_canonica(p_nova_area);
BEGIN
  IF NOT public.eh_organizador() THEN
    RETURN QUERY SELECT false, 'Apenas organizadores podem realocar.'::text, NULL::text;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  IF v_nova IS NULL THEN
    RETURN QUERY SELECT false, 'Área não informada'::text, NULL::text;
    RETURN;
  END IF;

  SELECT id, nome, sexo, status INTO v_equipante
    FROM equipantes WHERE id = p_equipante_id AND tipo = 'equipante';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Equipante não encontrado'::text, NULL::text;
    RETURN;
  END IF;

  IF v_equipante.status <> 'aprovado' THEN
    RETURN QUERY SELECT false, 'Equipante ainda não está aprovado'::text, NULL::text;
    RETURN;
  END IF;

  SELECT e.area_alocada INTO v_area_atual FROM escalas e WHERE e.equipante_id = p_equipante_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false,
      'Equipante ainda não está alocado em nenhuma área (use a alocação manual da lista de espera)'::text,
      NULL::text;
    RETURN;
  END IF;

  IF v_area_atual = v_nova THEN
    RETURN QUERY SELECT false, 'Equipante já está alocado nessa área'::text, v_area_atual;
    RETURN;
  END IF;

  SELECT * INTO v_disponibilidade FROM public._equipante_area_tem_vaga(v_nova, v_equipante.sexo);
  IF NOT v_disponibilidade.tem_vaga THEN
    RETURN QUERY SELECT false, v_disponibilidade.motivo, v_area_atual;
    RETURN;
  END IF;

  UPDATE escalas SET area_alocada = v_nova WHERE equipante_id = p_equipante_id;

  RETURN QUERY SELECT true, 'Realocado com sucesso'::text, v_area_atual;
END;
$fn$;


-- ---------------------------------------------------------------------
-- 7. Cancelamento: libera a vaga e puxa alguem da lista de espera
-- ---------------------------------------------------------------------
create or replace function public.liberar_vaga_e_realocar(p_equipante_id uuid)
returns table(
  vaga_liberada boolean, area_liberada text,
  novo_alocado_id uuid, novo_alocado_nome text, novo_alocado_area text
)
language plpgsql security definer
set search_path to 'public'
as $fn$
DECLARE
  v_area_liberada text;
  v_teve_vaga     boolean;
  v_candidato     RECORD;
  v_eh_parceiro   boolean := public.eh_parceiro() and not public.eh_organizador();
  v_area          text;
  v_destino       text;
  v_disp          RECORD;
BEGIN
  IF NOT public._pode_escalar_equipante(p_equipante_id) THEN
    RAISE EXCEPTION 'Sem permissão para liberar a vaga deste equipante'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  SELECT e.area_alocada INTO v_area_liberada FROM escalas e WHERE e.equipante_id = p_equipante_id;
  v_teve_vaga := FOUND;

  IF v_teve_vaga THEN
    DELETE FROM escalas WHERE equipante_id = p_equipante_id;
    UPDATE equipantes SET scale_status = 'pendente' WHERE id = p_equipante_id;
  END IF;

  -- Percorre a lista de espera por ordem de chegada e para no primeiro que
  -- conseguir vaga. Chama a alocacao automatica direto (nao pela funcao
  -- publica) para nao esbarrar na checagem de permissao: quem esta na
  -- espera pode ser de outra igreja, e a decisao de puxar alguem e do
  -- sistema, nao de quem cancelou.
  FOR v_candidato IN
    SELECT eq.id, eq.nome, eq.sexo,
           eq.area_trabalho_opcao1, eq.area_trabalho_opcao2, eq.area_trabalho_opcao3
      FROM equipantes eq
     WHERE eq.tipo = 'equipante'
       AND eq.status = 'aprovado'
       AND eq.id <> p_equipante_id
       AND NOT EXISTS (SELECT 1 FROM escalas e WHERE e.equipante_id = eq.id)
     ORDER BY eq.created_at ASC NULLS LAST, eq.id ASC
  LOOP
    FOREACH v_area IN ARRAY ARRAY[
      v_candidato.area_trabalho_opcao1,
      v_candidato.area_trabalho_opcao2,
      v_candidato.area_trabalho_opcao3
    ] LOOP
      v_area := public._area_canonica(v_area);
      CONTINUE WHEN v_area IS NULL;

      IF v_area = 'Disponível para qualquer área' THEN
        v_destino := public._area_com_mais_vaga(v_candidato.sexo);
        IF v_destino IS NULL THEN CONTINUE; END IF;
      ELSE
        SELECT * INTO v_disp FROM public._equipante_area_tem_vaga(v_area, v_candidato.sexo);
        IF NOT v_disp.tem_vaga THEN CONTINUE; END IF;
        v_destino := v_area;
      END IF;

      INSERT INTO escalas (equipante_id, area_alocada) VALUES (v_candidato.id, v_destino);
      UPDATE equipantes SET scale_status = 'ok' WHERE id = v_candidato.id;

      -- Parceiro nao pode ver gente de outra igreja: a realocacao
      -- acontece, mas o nome nao volta para a tela dele.
      IF v_eh_parceiro THEN
        RETURN QUERY SELECT v_teve_vaga, v_area_liberada, NULL::uuid, NULL::text, NULL::text;
      ELSE
        RETURN QUERY SELECT v_teve_vaga, v_area_liberada,
                            v_candidato.id, v_candidato.nome, v_destino;
      END IF;
      RETURN;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_teve_vaga, v_area_liberada, NULL::uuid, NULL::text, NULL::text;
END;
$fn$;


-- ---------------------------------------------------------------------
-- 8. Permissoes
--
-- SECURITY DEFINER ignora RLS -- por isso a checagem de quem esta
-- chamando esta DENTRO de cada funcao, e nada aqui vai para anon.
-- ---------------------------------------------------------------------
revoke all on function public.alocar_equipante_automaticamente(uuid) from public, anon, authenticated;
revoke all on function public.alocar_equipante_manualmente(uuid, text) from public, anon, authenticated;
revoke all on function public.realocar_equipante(uuid, text)          from public, anon, authenticated;
revoke all on function public.liberar_vaga_e_realocar(uuid)           from public, anon, authenticated;

grant execute on function public.alocar_equipante_automaticamente(uuid) to authenticated;
grant execute on function public.alocar_equipante_manualmente(uuid, text) to authenticated;
grant execute on function public.realocar_equipante(uuid, text)          to authenticated;
grant execute on function public.liberar_vaga_e_realocar(uuid)           to authenticated;


-- ---------------------------------------------------------------------
-- 9. Tetos por area, a partir das edicoes 33/35/36
--
-- Regra: maior das 3 edicoes, arredondado para cima. Onde a area nao
-- existe na escala oficial (Louvor nas cenas, Teatro), um numero modesto
-- para nao virar deposito. Tudo editavel na tela de Geracao de Escalas.
--
--   area do sistema              | 33   35   36  | teto
--   -----------------------------|---------------|-----
--   Contêiner                    |  2    2    2  |   4
--   Copa                         |  -   28   20  |  30
--   Cozinha                      | 42   20   18  |  45
--   Cracolândia                  | 59   74   61  |  75
--   Cristolândia                 |103  108   91  | 110
--   Dia do arrebatamento         | 63   65   54  |  70
--   Espírito Santo               |  5    5    5  |   6
--   Falsa baiana                 | 33   47   52  |  55
--   Família                      | 11   11   11  |  12
--   Família muçulmana            |  4    4    4  |   4
--   Fotografia                   | 10   10    9  |  10
--   Guia                         | 25   25   25  |  26
--   Hospital (Cena teatral)      |  9   10    9  |  10
--   Igreja subterrânea           | 17   17   18  |  18
--   Inimigo                      |  5    5    5  |   6
--   Invisível                    | 99  119  111  | 120
--   Logística                    | 19   22   20  |  22
--   Marcador                     |  5    5    5  |   6
--   Oração Itinerante (A+B)      |  4    4    4  |   6
--   Pastor Enforcado             |  7    7    8  |   8
--   Perseguidos                  | 10    8    8  |  10
--   Presídio                     | 21   27   24  |  27
--   Primeiros socorros - Saúde   | 39   36   33  |  40
--   Recepção (igreja + sítio)    | 38   36   36  |  40
--   Segurança                    | 70   62   86  |  86
--   Selva                        |145  153  129  | 155
--   Túmulo                       |  3    3    3  |   4
--   Louvor nas cenas             |  -    -    -  |  15
--   Teatro                       |  -    -    -  |  15
--
-- Soma: 1035 vagas em 29 areas -- um pouco acima das edicoes reais
-- (911, 967, 911 lugares), de proposito, para caber crescimento.
--
-- Presídio continua so para homens (limite_homens preenchido,
-- limite_mulheres NULL = zero), como ja estava configurado. Copa continua
-- metade/metade. Se a Vitoria quiser mudar, e na tela.
-- ---------------------------------------------------------------------
insert into public.limites_areas (area_nome, limite_maximo, limite_mulheres, limite_homens)
values
  ('Contêiner',                       4, null, null),
  ('Copa',                           30,   15,   15),
  ('Cozinha',                        45, null, null),
  ('Cracolândia',                    75, null, null),
  ('Cristolândia',                  110, null, null),
  ('Dia do arrebatamento da igreja', 70, null, null),
  ('Espírito Santo',                  6, null, null),
  ('Falsa baiana',                   55, null, null),
  ('Família',                        12, null, null),
  ('Família muçulmana',               4, null, null),
  ('Fotografia',                     10, null, null),
  ('Guia',                           26, null, null),
  ('Hospital (Cena teatral)',        10, null, null),
  ('Igreja subterrânea',             18, null, null),
  ('Inimigo',                         6, null, null),
  ('Invisível',                     120, null, null),
  ('Logística',                      22, null, null),
  ('Louvor nas cenas',               15, null, null),
  ('Marcador',                        6, null, null),
  ('Oração Itinerante',               6, null, null),
  ('Pastor Enforcado',                8, null, null),
  ('Perseguidos',                    10, null, null),
  ('Presídio',                       27, null,   27),
  ('Primeiros socorros - Saúde',     40, null, null),
  ('Recepção',                       40, null, null),
  ('Segurança',                      86, null, null),
  ('Selva',                         155, null, null),
  ('Teatro',                         15, null, null),
  ('Túmulo',                          4, null, null)
on conflict (area_nome) do update
  set limite_maximo   = excluded.limite_maximo,
      limite_mulheres = excluded.limite_mulheres,
      limite_homens   = excluded.limite_homens,
      updated_at      = now();

-- "Disponível para qualquer área" nao e destino de ninguem: sai da tabela
-- de limites para nao aparecer como area na tela nem ser escolhida pelo
-- coringa.
delete from public.limites_areas where area_nome = 'Disponível para qualquer área';
