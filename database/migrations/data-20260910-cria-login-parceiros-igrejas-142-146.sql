-- Migration: Cria contas de login de parceiro para as igrejas 142 a 146
-- Date: 2026-09-10
--
-- Contexto: a lista de igrejas (IGREJAS_PARCEIRAS, src/constants/igrejas.js)
-- foi trocada em 2026-09-10 por uma nova de 146 igrejas. A tabela
-- igrejas_parceiras so tinha contas ate o codigo "141" (ver migration
-- data-20260903-cria-login-parceiros-igrejas-51-141.sql). A usuaria
-- confirmou que o codigo de login nao esta vinculado ao nome real de
-- nenhuma igreja (o campo "nome" e sempre um placeholder generico "Igreja
-- NN"), entao a troca da lista de nomes nao exige sincronizar essa
-- tabela -- so falta completar os codigos que ainda nao tem conta,
-- 142 a 146.
--
-- Mesmo padrao das contas ja existentes:
--   codigo: numero da igreja, sem zero a esquerda ("142", ..., "146")
--   senha: bcrypt hash de "<codigo>.123456" (ex: "142.123456" pra codigo
--   "142"), cost factor 6 -- igual as contas ja existentes ($2a$06$...),
--   gerado com bcryptjs (mesma biblioteca que o app usa pra comparar) e
--   verificado batendo cada hash contra sua senha em texto plano antes
--   de aplicar
--   nome: "Igreja <codigo>" -- mesmo placeholder generico das contas
--   existentes
--
-- IMPORTANTE: as senhas em texto plano (ex: "142.123456") NAO ficam
-- gravadas em lugar nenhum -- so o hash bcrypt.
--
-- Rode primeiro esse SELECT pra conferir que nenhum desses codigos ja
-- existe (evita duplicar caso alguma dessas contas ja tenha sido criada
-- por fora):
--
--   SELECT codigo, nome FROM igrejas_parceiras WHERE codigo IN ('142','143','144','145','146');
--
-- Se vier vazio, pode rodar o INSERT abaixo com seguranca.

INSERT INTO igrejas_parceiras (id, codigo, nome, senha, criado_em) VALUES
  ('f1725d3b-3d11-4ee8-bf2d-d41c27adb184', '142', 'Igreja 142', '$2a$06$oCI6F1gA5i9LNJzdHXw27.sulBtjFJLKpzeWI8uHLz3WLdQagEr4K', now()),
  ('d50788b9-bea5-4f0a-8237-8828e6bec624', '143', 'Igreja 143', '$2a$06$mAzpQZrp2jVa0X0fVaD8T.LAHJWFpR2jJu/w97/tQ5KZVYhtlWzNS', now()),
  ('364528e2-a331-4b83-b7ab-b54821fa35ad', '144', 'Igreja 144', '$2a$06$yZYhI1/cK8N3FM8DpFEL.ORxDsm.Vc6C9FvUGeqAkrvfO.dsIPgf2', now()),
  ('50b81af3-7a2f-49b3-95c9-3cf9a7266861', '145', 'Igreja 145', '$2a$06$UCFmBTdyWw8VUERzeHdH..IQ/upOYRAlATz5uldYyNPZNQqJMkvr6', now()),
  ('840af885-a967-435c-bd5b-a8b3c29795d4', '146', 'Igreja 146', '$2a$06$J/qmZ02AmL2cv48OAGIB7u2tQL2NHRrHvEVNIDMuK5EMFh8o/055y', now());
