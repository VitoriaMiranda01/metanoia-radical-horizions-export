-- Migration: Remove o zero a esquerda dos codigos de login "01" a "09"
-- Date: 2026-09-10
--
-- Contexto: a usuaria pediu pra tirar o zero a frente dos codigos de
-- login das primeiras 9 igrejas parceiras (igrejas_parceiras.codigo),
-- pra ficar "1", "2", ..., "9" em vez de "01", "02", ..., "09" --
-- consistente com os codigos "10" em diante, que ja nao tem zero a
-- esquerda.
--
-- IMPORTANTE: a senha de cada conta segue o padrao "<codigo>.123456"
-- (ver migrations anteriores de criacao de login). Como o codigo muda,
-- a senha em texto plano tambem muda (de "01.123456" pra "1.123456",
-- etc) -- por isso o UPDATE abaixo troca codigo E senha juntos. Cada
-- hash foi gerado com bcryptjs (mesma lib que o app usa), cost factor 6,
-- e conferido contra a senha em texto plano antes de aplicar.
--
-- Rode primeiro esse SELECT pra ver o estado atual antes de aplicar:
--
--   SELECT codigo, nome FROM igrejas_parceiras WHERE codigo IN ('01','02','03','04','05','06','07','08','09');

UPDATE igrejas_parceiras SET codigo = '1', senha = '$2a$06$KEzepBzMig3.8PccU95OHeo5bY66P3I5gfAQ3h1ae.pwGJdCCW4Fy' WHERE codigo = '01';
UPDATE igrejas_parceiras SET codigo = '2', senha = '$2a$06$IAQ.C3GfkxSki.opuQDFYORt3wQ7vP.RBHxFX4GmTDPxwlxdSPGaS' WHERE codigo = '02';
UPDATE igrejas_parceiras SET codigo = '3', senha = '$2a$06$iF3Zyi2xAgxVpZdAZRUu7ezwCiyRM3lmaEPzN9dXFvqk2BbQ6/z.C' WHERE codigo = '03';
UPDATE igrejas_parceiras SET codigo = '4', senha = '$2a$06$WMk8FOEqvEbxRP8aA9P5H.8fKgIUJ3BVB3J4AQQtj.AMBCkYKwdOK' WHERE codigo = '04';
UPDATE igrejas_parceiras SET codigo = '5', senha = '$2a$06$IvuTpm/kW/DqOPqUNuwOVeM9V4e2d0ak0ZpQLhULVW4Z47h8Wgh4O' WHERE codigo = '05';
UPDATE igrejas_parceiras SET codigo = '6', senha = '$2a$06$Tt01iVmctH.pJDcJ7PWRwOy5p1SQFHOewCFfMnVfVbyYmtxE44Z8a' WHERE codigo = '06';
UPDATE igrejas_parceiras SET codigo = '7', senha = '$2a$06$blznR/49bFf2iWogvTP3k.JxTzHlM7qnMz6BQw1RjzNDAU4BzkBc.' WHERE codigo = '07';
UPDATE igrejas_parceiras SET codigo = '8', senha = '$2a$06$Rfc3ztOQtU1s7gKDdN/U8OdLQesDYXmWfC2tpUlji9mPtdgqvn5ha' WHERE codigo = '08';
UPDATE igrejas_parceiras SET codigo = '9', senha = '$2a$06$yW2pMQewJUs5lGqEU8L6Uup43VXGZYzOiOT./HX3usRBF.tr.vcyW' WHERE codigo = '09';
