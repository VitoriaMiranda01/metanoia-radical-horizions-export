-- Migration: Cria contas de login de parceiro para as igrejas 51 a 141
-- Date: 2026-09-03
--
-- Contexto: a tabela igrejas_parceiras ja tinha 50 contas cadastradas
-- (codigos "01" a "50"), batendo com os 50 primeiros nomes de
-- IGREJAS_PARCEIRAS (src/constants/igrejas.js). A usuaria pediu pra criar
-- as contas que faltam, pras igrejas 51 a 141 (91 contas), no mesmo
-- padrao das que ja existem:
--   codigo: numero da igreja, mesmo formato usado em IGREJAS_PARCEIRAS
--   ("51", "52", ..., "141" -- sem zero a esquerda, pois todos ja tem
--   2+ digitos)
--   senha: bcrypt hash de "<codigo>.123456" (ex: "51.123456" pra codigo
--   "51"), cost factor 6 -- igual ao das 50 contas ja existentes
--   ($2a$06$...), gerado com a mesma biblioteca que o app usa pra
--   comparar (bcryptjs) e verificado batendo cada hash contra sua senha
--   em texto plano antes de aplicar
--   nome: "Igreja <codigo>" -- segue o mesmo placeholder generico que as
--   50 contas existentes ja usam (nenhuma das 50 tem o nome real da
--   igreja preenchido, entao mantive o mesmo padrao aqui)
--
-- IMPORTANTE: as senhas em texto plano (ex: "51.123456") NAO ficam
-- gravadas em lugar nenhum -- so o hash bcrypt, que e o que a tabela ja
-- guarda hoje pras outras 50 contas.
INSERT INTO igrejas_parceiras (id, codigo, nome, senha, criado_em) VALUES
  ('5805882f-4f86-4d1c-aa06-3ceceaabeeec', '51', 'Igreja 51', '$2a$06$93mTU13yp7.mAswCxhzN4.oDeaI54bYICcRn56zp6Op05unOu6nGm', now()),
  ('f1424455-2f7d-45da-94be-b1f31ad94939', '52', 'Igreja 52', '$2a$06$CQwzxpsel7s3/bVKfn.5iu7/P9yzeu9.yxEOaTs63ltH9GNrzpgDS', now()),
  ('69743be2-cce3-4e8a-9926-f3bdc3e57c68', '53', 'Igreja 53', '$2a$06$L8TjhYq9AoVjiOjSp4Ba2eL1Y82DdDK60K2s49CqUccuEqq8c3.xy', now()),
  ('2062b596-1f34-4966-a103-aef60a8ea7fc', '54', 'Igreja 54', '$2a$06$dLoJSC/wEQMvrgsZWdIELutx7UGQkk6JqDZ8b9.j6jd4bUueuHcka', now()),
  ('bfd7b3dd-b48f-4335-9ce7-8dcc2441c53c', '55', 'Igreja 55', '$2a$06$TDXg6G.gVgkafmWX0VNcfesisOgVdDPZU2U1OhRMfNq9XCsvBAScS', now()),
  ('2d65a5ba-d663-4f06-9127-6380f09174ed', '56', 'Igreja 56', '$2a$06$OqRPBUmMOykR9qpQJxsewO4pYRQHQbgaZLUw0YSLRj.GT.J6BjB7m', now()),
  ('dfd1cce5-9efc-4809-abb8-447d2f2a90d8', '57', 'Igreja 57', '$2a$06$CHkRN1gdi4/pt/LsEdiqL.xrI5aj7sbspXOMHD4DkIuAcyngMif9u', now()),
  ('97db450b-20ea-4335-b35d-8c0e2b1fdf26', '58', 'Igreja 58', '$2a$06$ZgQsBoQ2nvTX9AP2eSE2zuGOpbW9wfXeJUGf22bmuB8wuOf7BXgku', now()),
  ('19278858-3912-4aef-a5e8-f8bd983897d1', '59', 'Igreja 59', '$2a$06$3B4SIM/LXWnm438Acqt0xOv0b.3sYQWLCBRFqB.0F3Vv0PlK2fziK', now()),
  ('e1040e4a-5852-4531-bcf3-1e41af196143', '60', 'Igreja 60', '$2a$06$qSCbOdm5MM2W9DpGtpGjFeQATtf5s/JW78aoyj0hsWFoacqYD/GMa', now()),
  ('2efc9cbf-98fd-4480-9303-724a866b7513', '61', 'Igreja 61', '$2a$06$5Y6KjTXqkqgds6JWZOHDouDEa0vUP2347K74/LHl5K9aH23QZ/so.', now()),
  ('b4d74dd9-a839-4537-a85e-acb1b0a96cf8', '62', 'Igreja 62', '$2a$06$PlMQ.1uKnkbmtvs5tGxMEOr.VAnNWTJBPJfK0q978OJHtW5L9Mpay', now()),
  ('a68ca134-fab4-45dc-85f1-3f31e1f8cf18', '63', 'Igreja 63', '$2a$06$E3v1Fxz36ixB1CatHlt9Buo7CNGfHuJ.8r08neGMnY2i0F49HIn6.', now()),
  ('d1c645e7-0935-4f95-a5a4-63614a1b9239', '64', 'Igreja 64', '$2a$06$cesTiRaeyAxTQ9UNqSxSDuKmBzvV92J5MEku3di.rZdCVdATGFsWm', now()),
  ('43119bff-4f8f-4e65-85a9-f33e1934f4c2', '65', 'Igreja 65', '$2a$06$ly/axY280ZSEab6ojaL4le1qw6hWCTNIjUVSGk2ZdX4qsfO261Mk.', now()),
  ('db829ebd-ee4b-4204-87f9-c4a86c3f64e6', '66', 'Igreja 66', '$2a$06$C6r1YEagyBKWqpEYZgx6j.1jpOzHRq9X/S7wp.D7quAGAQnKAEmVK', now()),
  ('6268324e-864b-4fc4-881f-a74eab02a691', '67', 'Igreja 67', '$2a$06$J5ppLzx3YCaJe2D59LVUHOkwMxOrmazRmZa70ozE5za3Mm1Cnfzki', now()),
  ('047a6258-e3b5-46f1-9c47-c93587d1d5af', '68', 'Igreja 68', '$2a$06$3cjZtbgkeYLsOdKjW1WzY.FrBQ2NOSQ/r0J/PgkkNflipuU1Yhfx.', now()),
  ('88b84017-3718-4f72-a41c-640fbf56b184', '69', 'Igreja 69', '$2a$06$gQv2idq.haAf2KO7Pf2hx.oCLT6SfDsfbZwXpc0kZIo4yg5I39Ujq', now()),
  ('655c6403-43de-4d02-b3bf-d53ef15e2b2b', '70', 'Igreja 70', '$2a$06$lipnJGgxZGJ2OGhxkV2ynuwr5B5Xl1sn79/OMl0EqfPL4TS8xc5UK', now()),
  ('b2b0e546-e33b-4bbd-a9a0-2b7cdc84dfc7', '71', 'Igreja 71', '$2a$06$O38EqSv4kD1O1o7k3jrNdOyLZqInxKlt3w1s6UapOp2laL4YV1AGm', now()),
  ('41d456bd-d475-43d5-a264-af8e1b0ff8e0', '72', 'Igreja 72', '$2a$06$1WbBrDB2MHaGMM8o.L9YleK90rLxVmXYaU5Y09IuwT2kXWgW/tFfq', now()),
  ('fb28810e-94d8-4bd2-b92d-32c7bd279537', '73', 'Igreja 73', '$2a$06$yIGteV.RM7LBDFobsJPg/OptqI0l89Z8qNvtTqBYnNkzL.GLdSG2S', now()),
  ('f0d76241-96c6-4ce1-8129-4a7c2e2f9678', '74', 'Igreja 74', '$2a$06$rGVJp7Ko5MKHeUJEmM7Oueo97zokm0s3biN0cjbpB6MaPwRp8Jhk.', now()),
  ('f8a2499a-8bf9-4619-96ea-e96171a57156', '75', 'Igreja 75', '$2a$06$3O1X3KsES.crV.xHivsrg.I7tl.60va4uAFV8mpmS40elQzY6YSCq', now()),
  ('a1f5e71c-3d1c-4fb7-a6bb-c1bee3964c65', '76', 'Igreja 76', '$2a$06$bX8XtGwT/u5pFn0QJr/lp.onOGnwjWEh.9bMID6V1TQoZQ9CNWplC', now()),
  ('9f5f95b0-604e-4f59-b973-67931a4edbc6', '77', 'Igreja 77', '$2a$06$qyrVMqk3Y0tbm1Fzbo2ET.YdIjt6RU2DtlNmMNTW6mQcYmX4AvPyO', now()),
  ('dfb1c48f-ef20-4146-8ec8-f99d74e9baf1', '78', 'Igreja 78', '$2a$06$L0w.ARgRrqoABUJOXkxXxekMla3u5sBn.mEXAEpBxo9wrz.5X1E3y', now()),
  ('ae01a5c7-3464-41bf-a85c-485896acb834', '79', 'Igreja 79', '$2a$06$y6ZTNtyezL8N7YxvlrsrS.GngWgNLQcEUo7NXmGcfdgtFd.xJ6you', now()),
  ('ff88586c-08eb-493a-b0d8-691938298516', '80', 'Igreja 80', '$2a$06$WWDy35pe/jtJ9x95nIVrKO74gk3KUd/AC4qtgDFiM1PWsMuQxywBy', now()),
  ('2284d365-2389-4519-b93f-cd70628bbb7b', '81', 'Igreja 81', '$2a$06$5gxbtHV9UGmbNkFqEiamhu17U5dgMT4TbKxSJqRQtOEjKOb33z46W', now()),
  ('3473fb86-650a-4f3b-9fee-f89d68930a94', '82', 'Igreja 82', '$2a$06$.pIz0YsEESKMQjeSa4k09.8/00raT5LSKToyqLYOiJJlC/1Trbmau', now()),
  ('83e05f5d-391f-422e-af3f-8fe2792c5438', '83', 'Igreja 83', '$2a$06$Sm/cMMN6btIi.uQ3nWF1FeH08HVLCLR7yHvUDB6OC2Vxm0kGxw9wK', now()),
  ('349ebee8-289a-480f-aa4d-a679b4bcc661', '84', 'Igreja 84', '$2a$06$6AMauN/UjUwj1XabZ/gLrewE/7hVwFJDFWDP8DmlQkI5UCbE.XAVq', now()),
  ('917d9284-9e3a-4ec9-871b-6121d8a9363b', '85', 'Igreja 85', '$2a$06$MkrBp8vJyAw7/Urr3mn1I.zt9YawOSwEBu9bWBgLBMKi4S74eRpDO', now()),
  ('58558d35-29be-4f50-98dd-5618a18dc1d2', '86', 'Igreja 86', '$2a$06$gThDdzU/7wcbOLhFOgOVu.AEWsHIdc9wMOrx0kDpdi/6uNDy01bwe', now()),
  ('6cca01b8-f6ea-4c08-a307-f3698a7918d8', '87', 'Igreja 87', '$2a$06$S6vdPOQKecsEjUFBtBv52.TbB/RJJuIakX33nIHIK4bzpBtngId4e', now()),
  ('dc7cd7df-93ce-47b9-b25b-fdbf7065eeb9', '88', 'Igreja 88', '$2a$06$yJaA7et35r2bxhENIsfcguR/V0yoJPoFcef/xby2VjRvo4psWvPi6', now()),
  ('1df75e3e-1945-4291-a884-5ec52d4da5ae', '89', 'Igreja 89', '$2a$06$T2OMIjMhBp32zrtjsmoMau4iDUxAug4QmR2W7KKAdXtBUWUj0oh7a', now()),
  ('c32d2dfe-d2c3-42b6-8e1d-94f085ebb85b', '90', 'Igreja 90', '$2a$06$63NqGBpxEZrSkbCUDCdwqOOInTRY9Tut9c53A9fE.S9IIOVPpj1.K', now()),
  ('5f6ccbe8-6225-44e1-8e3b-026e35948cd8', '91', 'Igreja 91', '$2a$06$lzKefRnx5IjUIGUIA936uenLE9LvgMc9gQIbCpj8ErEKeRNGZUJ9W', now()),
  ('fbdd2ddf-0212-419b-bb26-f9c6788682b6', '92', 'Igreja 92', '$2a$06$zZ6iD7bkre5TUgJcO9FuIusTGgtws15H6.X5wf2vOb/D0eG/L3Hf.', now()),
  ('987f27ed-8838-4fd4-bbe8-349b38d9a2b0', '93', 'Igreja 93', '$2a$06$zBJDCCShg.UCFKUSQDjmh.x7Qj8rp9.qI8gXUwU5B1gnyhYBZTUIm', now()),
  ('47f25697-0a02-4021-a04d-a60af7a5d8d6', '94', 'Igreja 94', '$2a$06$tan8F1CvsybVN96E4wjETeMRptM1GiZgYVZttUlqgfnK0bYwb7RZu', now()),
  ('c8827c38-39ca-4253-aa2c-2e0ddd8f401f', '95', 'Igreja 95', '$2a$06$X60Qikp0VWNNe1t8HvTcduFABMJvuvAcyiJvYsJ.nfHiLLqLDrfQm', now()),
  ('5e458af3-eb84-496e-b342-77d1b535be99', '96', 'Igreja 96', '$2a$06$6BLdFXTGqQY1I3AzCocx7eKg1/twUMISV62efll7I5G39HHNlNBya', now()),
  ('ee5f018d-2a51-4141-9c8f-146671d43798', '97', 'Igreja 97', '$2a$06$Nh6u6IX4mzlMtbXcl5Uiv.WdwhXPaY.1RlK4h8qtDRpHxDhN/H14a', now()),
  ('b3968e85-84a6-4183-90a0-cbf38600b3a2', '98', 'Igreja 98', '$2a$06$HjFy3OBayPtg1xLN.mlmUePsFi6MtERbSqv8VfKP7ypy3DyoKe74K', now()),
  ('98357408-45bd-4d87-8fc1-17ae4eb2c09c', '99', 'Igreja 99', '$2a$06$LQkkTSgcVDDIu.QpcY1bpOluxfzAd/Urk4OM44vQ3fAkwCNXx1Xv2', now()),
  ('4048a4d2-db8c-4423-b926-68ef7404d77b', '100', 'Igreja 100', '$2a$06$kEFsCshUeRb4EcRCPLNI.OOEj73LvhadlyOw2WTvSFwiL0FJS6Rte', now()),
  ('79b6908a-71d4-426e-9839-33ddbd768d02', '101', 'Igreja 101', '$2a$06$E96pWB6jZST0dVsUnzHIH.wJcUdsv82C6YAewvRhfIBnmJGfEWYD.', now()),
  ('11fe27d8-5f8d-4fab-85ba-30dd28e857fe', '102', 'Igreja 102', '$2a$06$x6jHhZi2sGOhTNWa4Xywg.vdX4QpRMfkQFvrtSzusEKZ4H4ZLByIO', now()),
  ('25480b1f-4c12-4d58-9d28-a18988ced59e', '103', 'Igreja 103', '$2a$06$BsA2tVkTVmsp9zSyYExLn.PEdLkRsqLzZxThkei.7wK5ztXEbVRMe', now()),
  ('2b197d31-e090-41d4-833c-63c41b82d79a', '104', 'Igreja 104', '$2a$06$00wC9qLotpAjS7TPKswnnOZ4tue7RCJ4iVQ7j2KbaEvSPpIn22h6u', now()),
  ('c4ab766f-61cb-4383-bed6-7a45f443a0e1', '105', 'Igreja 105', '$2a$06$MNET22Ty38K7lRULtG8hPuqgaz22YCNwYipB3M.jPxz7Wi5ye3lG2', now()),
  ('bd098d36-290b-4a72-9385-802bf07cd8ac', '106', 'Igreja 106', '$2a$06$UAXtlJPSry/S4qR7UIFANOnbUHt1Yhk3FzCEpfkB1kPCl1.Ao1D5S', now()),
  ('a8fce3c7-c2b1-4132-976b-ef3da3826165', '107', 'Igreja 107', '$2a$06$R52KgDbqj/YUxNe2Akd0pudJCU/lOsx1r4JykgyKKE0wFn3ffE0Oi', now()),
  ('5387736d-7265-4367-bf0e-63e460467be0', '108', 'Igreja 108', '$2a$06$hSC/FgDmAj7IGmBXnC6E2O./EbxZrbKPf/jQMgtIX.esuhFJHzIQ.', now()),
  ('d4769598-6c69-4c3f-b32e-7045ea02b3a1', '109', 'Igreja 109', '$2a$06$qkZlHmVUeruMvPtGre86G.m6RDnsudNTKWKVc1U5E1gMxHjyC27Pe', now()),
  ('be6a8070-36d8-40fa-a4f9-66cfe4e0c7a9', '110', 'Igreja 110', '$2a$06$2A7xYZasxPgPyeh76enPauylOaFns8nFimVsbChZl2Wf/NH1Ui/0C', now()),
  ('943a2dea-09de-487f-8594-aa131db0ad3e', '111', 'Igreja 111', '$2a$06$idgzCA7OTTeKYXJ1dYpz3OOuSOz/D.j6wEJsDGtlgwIr0iQamRhhi', now()),
  ('de83d700-e504-4478-a40d-06910995c189', '112', 'Igreja 112', '$2a$06$12fPyFfByb5dIpOIzCRfcerRgFR//3tzLvXm2VVNAdk/WSGIyL5Yi', now()),
  ('fac25e62-0837-4644-8703-53d482b17a17', '113', 'Igreja 113', '$2a$06$ZFGYzmU7iImkG/uUCmeA7u5UPJxewL0wKLkR9AWO2VbTZM.Z9/Zia', now()),
  ('df039940-a1a6-4969-9eb6-08fd01616de1', '114', 'Igreja 114', '$2a$06$cKgObZ70DAXHqlakgm9fTOMSwCj/B8GrMczQ/A8UE3iG6OYOAb9KS', now()),
  ('f8815134-ff0e-4406-add7-52280d7aca20', '115', 'Igreja 115', '$2a$06$qy6K9eG.SW.A.MaKwvrxb.PDrlHDBhHmgwYfJiFUe7O6EouadUA/W', now()),
  ('63200ac7-589f-4e37-9a28-d5ee0f4227c9', '116', 'Igreja 116', '$2a$06$upc3SRJDW4tMXrI6uDsVbu352TrAHqTS0QrkHvQvPtKXpfr.0taGK', now()),
  ('b71f7871-5a97-4e98-b433-db65c91cb727', '117', 'Igreja 117', '$2a$06$TRXcDcNSJ4xU2E28DQ.zQO8TvVf9o7mCTX.RziicH7T1HTdrSwyMq', now()),
  ('75a25420-8998-4bc7-9b35-7057313c97e3', '118', 'Igreja 118', '$2a$06$oWdLijo9kZox9gtXYjBpeuDBW5sMVP3faIw.Z9wpacssHnJILQ1fS', now()),
  ('073ecd19-e6dd-4363-b855-2253c4e73ca7', '119', 'Igreja 119', '$2a$06$xLTeuuR0VtLAu6F4nyF4j.UKLLhaOSWCnIfL7ua2bYcGXjM1x4wM2', now()),
  ('754b551e-f8d3-4a44-8305-f11ef987b0b4', '120', 'Igreja 120', '$2a$06$7rLtRK6es.zPF8vgUzk.Z.QgwKdM2zIX/650nEU.DF58qPI75erRy', now()),
  ('a15a808d-c5a2-49f5-abb2-b084fd425770', '121', 'Igreja 121', '$2a$06$KBiPPy5qdCYvadh8D46/JuCPgfih4nS1WG98iOZ88eLWLLcvHTlye', now()),
  ('1acb23e1-2f69-405c-b466-42321ff4ae36', '122', 'Igreja 122', '$2a$06$PtWqulWKKZUHZbR9I5dgI.qorWMpiBIY7lsAcv/W9kMbFA9v5j3ly', now()),
  ('54e9187e-f4e5-4bb7-9385-dafc43a46abb', '123', 'Igreja 123', '$2a$06$FltWE6Tg91eg702zX2hV1eF.zQaw9gUgpiLVpaYRwjBdZmN15nRc6', now()),
  ('8d5f0f54-dd67-417b-a74d-a4b749a7cdbe', '124', 'Igreja 124', '$2a$06$w0Ofbkgqhp8pFVOaaBthAejmzkBuh9gY/O.Ie75dn3IB07x1p.g8K', now()),
  ('0c469d6b-cb7c-42b6-a6c6-e181532107ed', '125', 'Igreja 125', '$2a$06$jYySzPlGAo2sY8adI/73x.f8TGF3nB0jo6MOvheMzOn4lfyVGieMK', now()),
  ('e12c024a-265b-4b1b-ac67-26a6f116ef19', '126', 'Igreja 126', '$2a$06$qRvA.G9ALi/fIZRuqqwDjuqQT3fwbwWmoqHtehCKcDhN1.6n2Obfa', now()),
  ('73c1dd4c-e05b-47e3-96e8-d1071bc36036', '127', 'Igreja 127', '$2a$06$asn/NVQsAWMzanMbALOiKOkEdDhGQPXXB1Tvr3rGsruK5uMBjYn16', now()),
  ('d86e6f14-f53f-42a1-bdc8-51941bde1542', '128', 'Igreja 128', '$2a$06$xOVL/WUm8Fbv6IxSR82m3uk5ttF6QIjiOakjec61j92mdeTuYVWCS', now()),
  ('e09d6263-aa82-4303-8a15-d9c3837ef0da', '129', 'Igreja 129', '$2a$06$JGZoE2ugaKisfcDVRBT51OBEFUxzNBa5JZoDQ7OvKSh5FwF8CZSRK', now()),
  ('12fc4c37-0770-4b3b-85d7-a73bb097f4e1', '130', 'Igreja 130', '$2a$06$mvgzfuLkwRZNlz1N/0OVfuNAd4jd0.Ed1Xr3JHphM3eQJhZdFau1K', now()),
  ('b73b5872-1749-44fc-8bbe-55f9e4e18c80', '131', 'Igreja 131', '$2a$06$7yEM0vU9M/3lJ0irsQ5SRumOpmSlCJ.fy5/cV5PdLoL4bZlGnh4gO', now()),
  ('8ca76705-bc3c-4cf0-a54b-54bcfbf48bb4', '132', 'Igreja 132', '$2a$06$bfI00FIoKTTBsOP7zAFAwudS2JeERcwByRKKXM8D4GpMMyx/JIf2.', now()),
  ('b715a139-d76c-46d0-881a-a8a2dccaef93', '133', 'Igreja 133', '$2a$06$2UcXmTVnxlhM.mcEet4S7ujbsHoeFEtGLr/lqF2SkoPu/uGHDnAcO', now()),
  ('7338de48-49fb-4f04-ab5b-7c29758f2473', '134', 'Igreja 134', '$2a$06$mkeMNutB7oA5tcYCvQmn..fn7ceceVwipXJCaAO0z8RufBfSMGMYa', now()),
  ('92722832-ade9-46af-b4b5-51917b6fa1a1', '135', 'Igreja 135', '$2a$06$wkWVMH9JkwOjBx0Xgr9zg.yoznl53QDf/5ZgPWlBCLXoCkNmk.4Cm', now()),
  ('7f24c173-e9c6-408f-b073-42fd1fdfae41', '136', 'Igreja 136', '$2a$06$HUUlsPvwZeBs2NUXVSdoCeFgQNEfk5o70IkNKJI7gheF/Y5xKnN.W', now()),
  ('8ed391da-af21-426c-8ac2-5584b544657c', '137', 'Igreja 137', '$2a$06$gKmY9w/HdIB51FGt.8XCYOnLLvDzZjyu130A/gb7ruklk52AiCe/G', now()),
  ('22f54368-09e7-4b33-a8d9-952204676ae1', '138', 'Igreja 138', '$2a$06$WGO3iniMC8YUn7nSNSkw8OY2ongBYEAvMtwwS9IQGxYY1EmgGa9LO', now()),
  ('7c1fa779-d3d5-4856-95d5-8a66b20209b5', '139', 'Igreja 139', '$2a$06$QWq4UqNR3gMrSEbHLcfcv.jVSfb6xHkz5CQExHK9h85KV3j8M1kX6', now()),
  ('69acab49-3550-467b-ba3d-dd3561490389', '140', 'Igreja 140', '$2a$06$NZXZKHWZcQyX71h4Rl/yiOw86Z2Y4xgBeynNjzPcQ9n1jX8aEGCoG', now()),
  ('f6a2db49-733b-45d3-9a39-9ce2de56e242', '141', 'Igreja 141', '$2a$06$DWwTG7ICzPAF1.DFBPwygu4z56qVDGjvnW5K159j0vVnMtq51W5by', now());
