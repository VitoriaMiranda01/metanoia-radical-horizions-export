-- ---------------------------------------------------------------------------
-- Atuacoes dentro da area + as areas que so a diretoria preenche
--
-- Decidido com o Patrick em 12/09/2026, depois de comparar o sistema com as
-- escalas oficiais das edicoes 33, 35 e 36.
--
-- O QUE FALTAVA
-- -------------
-- 1) A escala oficial tem uma coluna ATUACAO: a funcao da pessoa DENTRO da
--    area. Na Seguranca ha "SEGURANCA" e "LIDER"; na Recepcao Sitio ha
--    "CELULAR / MESA" e "FILA / CONFRONTO"; na Cracolandia ha traficante,
--    policial, mae, filha, bebado. O sistema so sabia em que area a pessoa
--    estava.
--
-- 2) Cerca de 11 areas da escala oficial nao existiam no sistema
--    (Estacionamento, Som/Multimidia, Apresentadores, Infiltrados, Pastor
--    Invisivel, Depressao, Ataque/Madrugada, Base Operacional,
--    Som/Projecao, Secretaria, Equipe de Manutencao) -- cerca de 60
--    pessoas por edicao, 6,6% da escala.
--
-- COMO FICOU
-- ----------
-- As 11 areas entram na tela de Geracao de Escalas, mas NAO no formulario
-- do equipante: quem trabalha nelas e escolhido pela diretoria. Elas nao
-- sao "areas especiais" no sentido do botao de CPFs (Guia/Inimigo/Espirito
-- Santo) -- o organizador simplesmente realoca gente para elas na tela.
-- A marca disso e limites_areas.somente_organizador.
--
-- Toda pessoa alocada recebe automaticamente a atuacao PADRAO da area (na
-- Seguranca, "Segurança"; na Selva, "Selva"; na Recepcao, "Fila /
-- Confronto"). O organizador troca no menu suspenso da tela quem for
-- lider, traficante, policial etc. Foi o pedido do Patrick: "coloque
-- todos como atuação segurança primeiro e depois que entrar o organizador
-- troca para líder".
--
-- Onde a escala oficial tem um LIDER, a atuacao "Líder" existe na lista da
-- area e vem marcada com eh_lider -- e a tela avisa enquanto ninguem
-- estiver com ela.
--
-- FONTE DOS DADOS: contagem das 3 escalas oficiais somadas. Ex.: Seguranca
-- 199 "SEGURANCA" contra 6 "LIDER"; Recepcao Sitio 75 "FILA / CONFRONTO"
-- contra 28 "CELULAR / MESA". O mais numeroso virou o padrao.
--
-- DUAS AREAS SEM REFERENCIA OFICIAL: "Louvor nas cenas" e "Teatro" nao
-- aparecem em nenhuma das 3 edicoes (a cena teatral oficial e o
-- "Hospital"). As atuacoes delas sao um chute razoavel -- confirmar com a
-- Vitoria.
--
-- RECEPCAO: a oficial separa "RECEPCAO IGREJA" (mesa de cracha) de
-- "RECEPCAO SITIO" (celular/mesa, fila/confronto). Aqui continua uma area
-- so, com as 4 atuacoes -- e o formulario do equipante continua com uma
-- opcao so, como sempre foi. Se a equipe preferir separar em duas areas, e
-- so pedir.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 1. Colunas novas
-- ---------------------------------------------------------------------
alter table public.escalas
  add column if not exists atuacao text;

comment on column public.escalas.atuacao is
  'Funcao da pessoa dentro da area (coluna ATUACAO da escala oficial). Preenchida com a atuacao padrao da area no momento da alocacao; o organizador troca na tela.';

alter table public.limites_areas
  add column if not exists somente_organizador boolean not null default false;

comment on column public.limites_areas.somente_organizador is
  'true = area que o equipante NAO escolhe no formulario; quem entra nela e escolhido pela diretoria (ou, no caso de Guia/Inimigo/Espirito Santo, pelo botao de CPFs). Nunca recebe gente pela alocacao automatica nem pelo coringa "Disponível para qualquer área".';


-- ---------------------------------------------------------------------
-- 2. Catalogo de atuacoes por area
-- ---------------------------------------------------------------------
create table if not exists public.atuacoes_areas (
  id         uuid primary key default gen_random_uuid(),
  area_nome  text    not null,
  atuacao    text    not null,
  ordem      integer not null default 0,
  eh_padrao  boolean not null default false,
  eh_lider   boolean not null default false,
  unique (area_nome, atuacao)
);

-- Uma unica atuacao padrao por area.
create unique index if not exists atuacoes_areas_um_padrao_por_area
  on public.atuacoes_areas (area_nome) where eh_padrao;

alter table public.atuacoes_areas enable row level security;
revoke all on public.atuacoes_areas from anon, authenticated;
grant select on public.atuacoes_areas to authenticated;

drop policy if exists "organizador e parceiro leem atuacoes" on public.atuacoes_areas;
create policy "organizador e parceiro leem atuacoes" on public.atuacoes_areas
for select to authenticated
using (public.eh_organizador() or public.eh_parceiro());

-- Escrita so por migration/organizador via SQL: a lista muda uma vez por
-- edicao, nao vale expor uma tela pra isso agora.


-- ---------------------------------------------------------------------
-- 3. As 11 areas que so a diretoria preenche
--
-- Tetos pelo maior valor das 3 edicoes, arredondado para cima -- mesma
-- regra usada em schema-update-20260912d.
--
--   area                   | 33  35  36 | teto
--   -----------------------|------------|-----
--   Estacionamento         |  3   3   3 |   4
--   Som / Multimídia       |  1   1   1 |   3
--   Apresentadores         |  2   2   2 |   3
--   Infiltrados            | 15  15  15 |  16
--   Pastor Invisível       | 22  15  18 |  24
--   Depressão              |  3   2   3 |   4
--   Ataque / Madrugada     |  3   3   3 |   4
--   Base Operacional       |  4   3   4 |   5
--   Som / Projeção         |  5   5   5 |   6
--   Secretaria             |  2   2   2 |   3
--   Equipe de Manutenção   |  3   3   4 |   5
-- ---------------------------------------------------------------------
insert into public.limites_areas (area_nome, limite_maximo, somente_organizador)
values
  ('Estacionamento',        4, true),
  ('Som / Multimídia',      3, true),
  ('Apresentadores',        3, true),
  ('Infiltrados',          16, true),
  ('Pastor Invisível',     24, true),
  ('Depressão',             4, true),
  ('Ataque / Madrugada',    4, true),
  ('Base Operacional',      5, true),
  ('Som / Projeção',        6, true),
  ('Secretaria',            3, true),
  ('Equipe de Manutenção',  5, true)
on conflict (area_nome) do update
  set limite_maximo       = excluded.limite_maximo,
      somente_organizador = excluded.somente_organizador,
      updated_at          = now();

-- Guia, Inimigo e Espirito Santo tambem nao sao escolhidas no formulario
-- (vao pelo botao de CPFs). Marcar aqui substitui a lista de nomes que
-- estava escrita a mao dentro de _area_com_mais_vaga.
update public.limites_areas set somente_organizador = true
where area_nome in ('Guia', 'Inimigo', 'Espírito Santo');


-- ---------------------------------------------------------------------
-- 4. Atuacoes de cada area
--
-- A PRIMEIRA da lista e a padrao (todo mundo entra com ela). Qualquer
-- atuacao que contenha "líder" conta como lider da area.
-- ---------------------------------------------------------------------
with dados(area, lista) as (values
  -- areas que o equipante escolhe no formulario
  ('Contêiner',                      array['Ministrador']),
  ('Copa',                           array['Copa','Líder']),
  ('Cozinha',                        array['Cozinha','Líder']),
  ('Cracolândia',                    array['Cracolândia','Líder','Traficante','Traficante / Líder','Policial','Mãe','Filha','Bêbado']),
  ('Cristolândia',                   array['Cristolândia','Ministrador','Louvor / Vocal','Louvor / Teclado','Louvor / Violão','Louvor / Cajon']),
  ('Dia do arrebatamento da igreja', array['Arrebatamento da igreja','Líder','Igreja','Jesus','Pastor','Ministrador','Som']),
  ('Falsa baiana',                   array['Apoio','Líder']),
  ('Família',                        array['Voz','Pai','Mãe','Filho','Filha','Namorado','Ministrador','Violão','Cajon']),
  ('Família muçulmana',              array['Pai','Esposa','Filho','Filha']),
  ('Fotografia',                     array['Apoio','Líder','Amarelo','Azul','Verde','Vermelho','Roxo','Drone']),
  ('Hospital (Cena teatral)',        array['Hospital','Líder']),
  ('Igreja subterrânea',             array['Bíblia','Líder']),
  ('Invisível',                      array['Amarelo','Azul','Verde','Vermelho','Roxo','Líder / Amarelo','Líder / Azul','Líder / Verde','Líder / Vermelho','Líder / Roxo']),
  ('Logística',                      array['Logística','Líder']),
  ('Louvor nas cenas',               array['Voz','Violão','Teclado','Cajon','Ministrador']),
  ('Marcador',                       array['Amarelo','Azul','Verde','Vermelho','Roxo']),
  ('Oração Itinerante',              array['Trilha A','Trilha B']),
  ('Pastor Enforcado',               array['Pastor enforcado','Ministrador','Voz','Esposa','Violão','Cajon']),
  ('Perseguidos',                    array['Filha','Filho']),
  ('Presídio',                       array['Preso','Carcereiro','Carcereiro / Líder','Preso / Testemunho']),
  ('Primeiros socorros - Saúde',     array['Apoio','Líder']),
  ('Recepção',                       array['Fila / Confronto','Celular / Mesa','Mesa crachá masculino','Mesa crachá feminino']),
  ('Segurança',                      array['Segurança','Líder']),
  ('Selva',                          array['Selva','Líder']),
  ('Teatro',                         array['Ator','Ministrador','Apoio']),
  ('Túmulo',                         array['Mãe','Irmã / Voz','Violão']),

  -- areas por CPF (botao "Alocar Áreas Especiais"): a atuacao e a cor da trilha
  ('Guia',                           array['Amarelo','Azul','Verde','Vermelho','Roxo']),
  ('Inimigo',                        array['Amarelo','Azul','Verde','Vermelho','Roxo']),
  ('Espírito Santo',                 array['Amarelo','Azul','Verde','Vermelho','Roxo']),

  -- areas que so a diretoria preenche
  ('Estacionamento',                 array['Estacionamento']),
  ('Som / Multimídia',               array['Multi mídia','Som']),
  ('Apresentadores',                 array['Apresentador']),
  ('Infiltrados',                    array['Amarelo','Azul','Verde','Vermelho','Roxo']),
  ('Pastor Invisível',               array['Amarelo','Azul','Verde','Vermelho','Roxo']),
  ('Depressão',                      array['Mulher','Ministrador']),
  ('Ataque / Madrugada',             array['Jesus','Acusador','Anjo']),
  ('Base Operacional',               array['Apoio / Rádio','Líder']),
  ('Som / Projeção',                 array['Projeção / Som']),
  ('Secretaria',                     array['Secretária']),
  ('Equipe de Manutenção',           array['Manutenção'])
)
insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider)
select d.area, t.atuacao, t.ord, t.ord = 1, t.atuacao ilike '%líder%'
  from dados d, unnest(d.lista) with ordinality as t(atuacao, ord)
on conflict (area_nome, atuacao) do update
  set ordem     = excluded.ordem,
      eh_padrao = excluded.eh_padrao,
      eh_lider  = excluded.eh_lider;


-- ---------------------------------------------------------------------
-- 5. Atuacao padrao da area
-- ---------------------------------------------------------------------
create or replace function public._atuacao_padrao(p_area text)
returns text
language sql stable security definer
set search_path to 'public'
as $fn$
  select a.atuacao from public.atuacoes_areas a
   where a.area_nome = public._area_canonica(p_area) and a.eh_padrao
   limit 1;
$fn$;
revoke all on function public._atuacao_padrao(text) from public;
grant execute on function public._atuacao_padrao(text) to authenticated;


-- ---------------------------------------------------------------------
-- 6. O coringa passa a respeitar somente_organizador
--
-- Antes a lista de excecoes estava escrita a mao dentro da funcao
-- ('Guia','Inimigo','Espírito Santo'). Agora quem manda e a coluna -- e
-- as 11 areas novas entram na regra sem mexer em codigo.
-- ---------------------------------------------------------------------
create or replace function public._area_com_mais_vaga(p_sexo text)
returns text
language sql stable security definer
set search_path to 'public'
as $fn$
  select l.area_nome
    from public.limites_areas l
   where not l.somente_organizador
     and l.area_nome <> 'Disponível para qualquer área'
     and (public._equipante_area_tem_vaga(l.area_nome, p_sexo)).tem_vaga
   order by l.limite_maximo
            - (select count(*) from public.escalas e where e.area_alocada = l.area_nome) desc,
            l.area_nome
   limit 1;
$fn$;
revoke all on function public._area_com_mais_vaga(text) from public;
grant execute on function public._area_com_mais_vaga(text) to authenticated;


-- ---------------------------------------------------------------------
-- 7. Toda alocacao passa a gravar a atuacao padrao
--
-- So muda o INSERT/UPDATE de escalas -- o resto das funcoes continua como
-- em schema-update-20260912d.
-- ---------------------------------------------------------------------
create or replace function public.alocar_equipante_automaticamente(p_equipante_id uuid)
returns table(alocado boolean, area_alocada text)
language plpgsql security definer
set search_path to 'public'
as $fn$
DECLARE
  v_equipante       RECORD;
  v_area            text;
  v_destino         text;
  v_area_existente  text;
  v_disponibilidade RECORD;
BEGIN
  IF NOT public._pode_escalar_equipante(p_equipante_id) THEN
    RAISE EXCEPTION 'Sem permissão para escalar este equipante' USING ERRCODE = '42501';
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
      v_destino := public._area_com_mais_vaga(v_equipante.sexo);
      IF v_destino IS NULL THEN CONTINUE; END IF;
    ELSE
      -- Uma area da diretoria nunca deveria estar numa preferencia (o
      -- formulario nao oferece), mas se aparecer -- dado antigo, digitacao
      -- direta no banco -- e ignorada aqui.
      IF EXISTS (SELECT 1 FROM limites_areas l
                  WHERE l.area_nome = v_area AND l.somente_organizador) THEN
        CONTINUE;
      END IF;
      SELECT * INTO v_disponibilidade
        FROM public._equipante_area_tem_vaga(v_area, v_equipante.sexo);
      IF NOT v_disponibilidade.tem_vaga THEN CONTINUE; END IF;
      v_destino := v_area;
    END IF;

    INSERT INTO escalas (equipante_id, area_alocada, atuacao)
    VALUES (v_equipante.id, v_destino, public._atuacao_padrao(v_destino));
    UPDATE equipantes SET scale_status = 'ok' WHERE id = p_equipante_id;

    RETURN QUERY SELECT true, v_destino;
    RETURN;
  END LOOP;

  RETURN QUERY SELECT false, NULL::text;
END;
$fn$;

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

  INSERT INTO escalas (equipante_id, area_alocada, atuacao)
  VALUES (v_equipante.id, v_area, public._atuacao_padrao(v_area));
  UPDATE equipantes SET scale_status = 'ok' WHERE id = p_equipante_id;

  RETURN QUERY SELECT true, 'Alocado com sucesso'::text;
END;
$fn$;

-- Ao trocar de area, a atuacao volta para a padrao da area de DESTINO --
-- senao um "Fila / Confronto" da Recepcao seguiria a pessoa para a Cozinha.
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

  UPDATE escalas
     SET area_alocada = v_nova,
         atuacao      = public._atuacao_padrao(v_nova)
   WHERE equipante_id = p_equipante_id;

  RETURN QUERY SELECT true, 'Realocado com sucesso'::text, v_area_atual;
END;
$fn$;

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
    RAISE EXCEPTION 'Sem permissão para liberar a vaga deste equipante' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  SELECT e.area_alocada INTO v_area_liberada FROM escalas e WHERE e.equipante_id = p_equipante_id;
  v_teve_vaga := FOUND;

  IF v_teve_vaga THEN
    DELETE FROM escalas WHERE equipante_id = p_equipante_id;
    UPDATE equipantes SET scale_status = 'pendente' WHERE id = p_equipante_id;
  END IF;

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
        IF EXISTS (SELECT 1 FROM limites_areas l
                    WHERE l.area_nome = v_area AND l.somente_organizador) THEN
          CONTINUE;
        END IF;
        SELECT * INTO v_disp FROM public._equipante_area_tem_vaga(v_area, v_candidato.sexo);
        IF NOT v_disp.tem_vaga THEN CONTINUE; END IF;
        v_destino := v_area;
      END IF;

      INSERT INTO escalas (equipante_id, area_alocada, atuacao)
      VALUES (v_candidato.id, v_destino, public._atuacao_padrao(v_destino));
      UPDATE equipantes SET scale_status = 'ok' WHERE id = v_candidato.id;

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
-- 8. Trocar a atuacao de uma pessoa (menu suspenso da tela de escalas)
-- ---------------------------------------------------------------------
create or replace function public.definir_atuacao_equipante(p_equipante_id uuid, p_atuacao text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
DECLARE
  v_area    text;
  v_atuacao text := nullif(btrim(coalesce(p_atuacao, '')), '');
BEGIN
  IF NOT public.eh_organizador() THEN
    RETURN jsonb_build_object('ok', false, 'erro',
      'Apenas organizadores podem mudar a atuação.');
  END IF;

  SELECT e.area_alocada INTO v_area FROM escalas e WHERE e.equipante_id = p_equipante_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro',
      'Este equipante não está alocado em nenhuma área.');
  END IF;

  -- Atuacao tem de pertencer a area onde a pessoa esta -- senao daria para
  -- gravar "Traficante" em alguem da Cozinha.
  IF v_atuacao IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM atuacoes_areas a
     WHERE a.area_nome = v_area AND a.atuacao = v_atuacao
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro',
      format('"%s" não é uma atuação de %s.', v_atuacao, v_area));
  END IF;

  UPDATE escalas SET atuacao = v_atuacao WHERE equipante_id = p_equipante_id;

  RETURN jsonb_build_object('ok', true, 'area', v_area, 'atuacao', v_atuacao);
END;
$fn$;
revoke all on function public.definir_atuacao_equipante(uuid, text) from public, anon, authenticated;
grant execute on function public.definir_atuacao_equipante(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 9. Preenche a atuacao de quem ja estava alocado (no-op numa base vazia)
-- ---------------------------------------------------------------------
update public.escalas e
   set atuacao = public._atuacao_padrao(e.area_alocada)
 where e.atuacao is null;
