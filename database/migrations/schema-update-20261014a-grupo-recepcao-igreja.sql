-- ---------------------------------------------------------------------------
-- Grupo "Recepção Igreja" (14/10/2026, Patrick)
--
-- A equipe que trabalha na igreja no dia da saida ganhou um modulo proprio na
-- tela de escalas, igual ao das Areas Especiais (pre-cadastro por CPF,
-- "Alocar", "Aplicar CPFs cadastrados"). Cinco areas:
--
--   Recepção Igreja    (ja existia, area da diretoria)
--   Cozinha Igreja     (NOVA -- a cozinha da igreja; a "Cozinha" do sitio
--                       continua sendo area comum, escolhida na inscricao)
--   Som / Multimídia   (ja existia, saiu do corpo da tela)
--   Estacionamento     (ja existia, saiu do corpo da tela)
--   Mesa crachá        (NOVA -- as atuacoes "Mesa crachá masculino/feminino"
--                       eram da Recepção Igreja e vieram para ca)
--
-- Diferente das especiais, NAO ha exclusividade: a mesma pessoa pode estar em
-- varias destas areas e tambem nas areas do sitio (na escala 37 o Rodolfo
-- esta na Recepção Igreja, na Cozinha Igreja e na Mesa crachá). Por isso
-- nada muda em _area_especial().
--
-- Todas ficam somente_organizador = true: a alocacao automatica e o coringa
-- nunca mandam ninguem para ca.
-- ---------------------------------------------------------------------------

-- Listas de pre-cadastro (mesmo formato das especiais: jsonb com CPFs).
alter table public.configuracoes
  add column if not exists cpfs_area_recepcao_igreja jsonb default '[]'::jsonb,
  add column if not exists cpfs_area_cozinha_igreja jsonb default '[]'::jsonb,
  add column if not exists cpfs_area_som_multimidia jsonb default '[]'::jsonb,
  add column if not exists cpfs_area_estacionamento jsonb default '[]'::jsonb,
  add column if not exists cpfs_area_mesa_cracha jsonb default '[]'::jsonb;

-- Limites (so aviso na alocacao manual), pelo tamanho da escala 37.
insert into public.limites_areas (area_nome, limite_maximo, somente_organizador)
values ('Cozinha Igreja', 2, true), ('Mesa crachá', 2, true)
on conflict (area_nome) do update set somente_organizador = true;

update public.limites_areas set limite_maximo = 6
 where area_nome = 'Recepção Igreja' and limite_maximo < 6;

-- Atuacoes, como na planilha da escala 37.
update public.atuacoes_areas set area_nome = 'Mesa crachá'
 where area_nome = 'Recepção Igreja' and atuacao in ('Mesa crachá masculino', 'Mesa crachá feminino');

insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider, sem_cor)
values ('Recepção Igreja', 'Recepção Igreja', 1, true, false, false),
       ('Recepção Igreja', 'Mesa', 2, false, false, false),
       ('Cozinha Igreja', 'Recepção Igreja', 1, true, false, false)
on conflict do nothing;
