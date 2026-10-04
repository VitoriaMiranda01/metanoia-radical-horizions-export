-- =============================================================================
-- As 16 igrejas que a Raquel acrescentou viram parceiras (04/10/2026)
--
-- Pedido do Patrick: as igrejas adicionadas pela tela de Configuracoes
-- (igrejas_extras) sao igrejas novas e precisam de codigo proprio para a
-- organizacao direcionar os parceiros delas. Codigos 147 a 162 (o 146 segue
-- vago, ver src/constants/igrejas.js). O site passa a lista-las em
-- IGREJAS_PARCEIRAS -- equipante, acampante ("igreja responsavel") e as telas
-- do organizador.
--
-- 1. Conta de parceiro para cada uma (mesma regra das outras: senha de
--    primeiro acesso pela formula do banco, acesso trancado ate a
--    organizacao liberar em "Senhas dos Parceiros").
-- 2. Quem ja estava gravado com o nome da igreja passa para "NNN - NOME".
-- 3. Os 42 equipantes que escolheram OUTRA e cuja igreja ficou clara na
--    planilha de 04/10 saem do OUTRA. Ficam de fora (para os diretores
--    decidirem) os 7 marcados "(confirmar)" e os 10 de igreja nova.
-- 4. As 16 saem de igrejas_extras (senao apareceriam duas vezes no
--    formulario).
-- =============================================================================

do $m$
declare
  v_novas constant text[] := array[
    '1° IGREJA BATISTA QUINTA LEBRÃO', 'ASSEMBLEIA DE DEUS FONTE SANTA', 'ASSEMBLEIA DE DEUS MISSÃO DO REINO',
    'BATISTA MONTE HERMON', 'CARA DE LEÃO JARDIM LEAL', 'CASA DA BENÇA RENOVO DE DAVI', 'IGREJA BATISTA ATITUDE',
    'IGREJA BATISTA ATITUDE | OCEANICA', 'IGREJA BATISTA NA TIJUCA', 'IGREJA PENTECOSTAL JESUS ESTÁ VOLTANDO',
    'MISSÃO SOCORRISTA EVANGELICA', 'NOVA VIDA CAXIAS', 'PRIMEIRA IGREJA BATISTA EM SANTO ALEIXO (PIBSA)',
    'PROJETO SEMEAR BREJAL', 'REFÚGIO DE LUZ', 'UNIVERSAL DO REINO DE DEUS'];
  v_cod text;
  v_n int;
begin
  for i in 1 .. array_length(v_novas, 1) loop
    v_cod := (146 + i)::text;

    if exists (select 1 from public.igrejas_parceiras where codigo = v_cod) then
      raise exception 'codigo % ja existe em igrejas_parceiras', v_cod;
    end if;

    insert into public.igrejas_parceiras (codigo, nome, senha, acesso_liberado, senha_definida)
    values (v_cod, v_novas[i],
            extensions.crypt(public._senha_primeiro_acesso(v_cod), extensions.gen_salt('bf', 12)),
            false, false);

    update public.equipantes set igreja = v_cod || ' - ' || v_novas[i], igreja_outra = null
     where igreja = v_novas[i];
    update public.acampantes set admin_responsavel = v_cod || ' - ' || v_novas[i]
     where admin_responsavel = v_novas[i];
  end loop;

  -- 3. OUTRA -> igreja certa (ids da planilha Igrejas_OUTRA_simples de 04/10).
  update public.equipantes e
     set igreja = m.igreja, igreja_outra = null
    from (values
      ('f42260ce-8415-44af-b116-9d5927684083'::uuid, '101 - METODISTA EM VILA DO PIÃO'),
      ('ca15a0d8-856b-46e2-bc77-9882906ce327'::uuid, '104 - MINISTÉRIO RECOMEÇAR EM CRISTO'),
      ('38d5de1f-ee99-42d8-b086-5b5a465e369d'::uuid, '143 - IGREJA NOVOS COMEÇOS'),
      ('62ac99e0-e1f2-4ca5-a81e-f26ac2c10527'::uuid, '33 - MINISTERIO FAMILIA EM GRAÇA'),
      ('079b541d-7635-4a3b-afcf-27f407661e15'::uuid, '94 - ASSEMBLEIA DE DEUS IDE - SJVRP'),
      ('c1ba8dd9-ae6a-4260-9a99-6c6de9e62dd9'::uuid, '94 - ASSEMBLEIA DE DEUS IDE - SJVRP'),
      ('d03a4225-a537-4b6a-b53c-9b6df52aa0f1'::uuid, '94 - ASSEMBLEIA DE DEUS IDE - SJVRP'),
      ('ec3e39d4-e437-4926-a778-827cc8440e92'::uuid, '147 - 1° IGREJA BATISTA QUINTA LEBRÃO'),
      ('b4f2f597-9b51-4723-94fc-8f718f093779'::uuid, '147 - 1° IGREJA BATISTA QUINTA LEBRÃO'),
      ('08fae59e-394c-42aa-9e6b-9286e2dfd0eb'::uuid, '148 - ASSEMBLEIA DE DEUS FONTE SANTA'),
      ('ce1da39a-4453-4c95-b4bb-0b086369906c'::uuid, '149 - ASSEMBLEIA DE DEUS MISSÃO DO REINO'),
      ('6d7c374f-f964-4292-973e-b5a80ecd215c'::uuid, '150 - BATISTA MONTE HERMON'),
      ('1c346956-b624-4ac4-8a63-e2fd449c80b5'::uuid, '151 - CARA DE LEÃO JARDIM LEAL'),
      ('788f9e29-20fb-4206-b3ef-14804c921e2b'::uuid, '151 - CARA DE LEÃO JARDIM LEAL'),
      ('b77605e5-e63b-4977-88ee-05f1b678c8ea'::uuid, '151 - CARA DE LEÃO JARDIM LEAL'),
      ('cd00754b-aa3a-4f1a-9920-08d8707d2944'::uuid, '152 - CASA DA BENÇA RENOVO DE DAVI'),
      ('5fcc7a75-5287-4fc9-b4c7-3b5084496f0b'::uuid, '152 - CASA DA BENÇA RENOVO DE DAVI'),
      ('de4380d1-7446-4bf8-865f-d396663be322'::uuid, '153 - IGREJA BATISTA ATITUDE'),
      ('07e3137b-51d3-4a44-a6ad-d2e902aabe17'::uuid, '154 - IGREJA BATISTA ATITUDE | OCEANICA'),
      ('010e011a-dd08-41ff-a758-7370cb5cf1ff'::uuid, '155 - IGREJA BATISTA NA TIJUCA'),
      ('3c15f5b9-2925-4403-873c-b748881c85c6'::uuid, '156 - IGREJA PENTECOSTAL JESUS ESTÁ VOLTANDO'),
      ('73a79bfb-8aa9-42a4-a721-4baae748cf97'::uuid, '156 - IGREJA PENTECOSTAL JESUS ESTÁ VOLTANDO'),
      ('d53f616b-49e8-4d10-abfa-265404c2e572'::uuid, '156 - IGREJA PENTECOSTAL JESUS ESTÁ VOLTANDO'),
      ('496c8296-ec87-40b3-b22c-f9f0ee8adfd7'::uuid, '156 - IGREJA PENTECOSTAL JESUS ESTÁ VOLTANDO'),
      ('daf1ea56-8c4d-4aed-af15-74d0706a5b79'::uuid, '156 - IGREJA PENTECOSTAL JESUS ESTÁ VOLTANDO'),
      ('8e15c68d-b427-4422-9dad-04d269f07db8'::uuid, '156 - IGREJA PENTECOSTAL JESUS ESTÁ VOLTANDO'),
      ('189ea224-72fb-4f75-81a7-f10b69806a9d'::uuid, '156 - IGREJA PENTECOSTAL JESUS ESTÁ VOLTANDO'),
      ('7882ba34-96ef-4d44-b75d-8de2d93fd467'::uuid, '157 - MISSÃO SOCORRISTA EVANGELICA'),
      ('bdc5753a-33db-4279-8bd3-c05fa819677c'::uuid, '157 - MISSÃO SOCORRISTA EVANGELICA'),
      ('eab350c9-964f-40e2-b6f5-e67523bf5ffc'::uuid, '158 - NOVA VIDA CAXIAS'),
      ('71dd136e-8494-40be-b814-31e316abbfac'::uuid, '158 - NOVA VIDA CAXIAS'),
      ('46d6c87b-930d-4eb7-90fe-1e1f15025dc8'::uuid, '158 - NOVA VIDA CAXIAS'),
      ('d2c21b02-278a-41dd-8b32-1bc5f9c35424'::uuid, '158 - NOVA VIDA CAXIAS'),
      ('2dee8f0a-b7de-4009-9c3e-79cf6ff99c16'::uuid, '158 - NOVA VIDA CAXIAS'),
      ('b67adb8f-fee9-4a27-9e87-0ecfd6b04560'::uuid, '159 - PRIMEIRA IGREJA BATISTA EM SANTO ALEIXO (PIBSA)'),
      ('c28166d2-e079-49f9-96b9-385b1c862e3a'::uuid, '159 - PRIMEIRA IGREJA BATISTA EM SANTO ALEIXO (PIBSA)'),
      ('4cf46071-6211-4b4d-aa0e-7033510cfb88'::uuid, '159 - PRIMEIRA IGREJA BATISTA EM SANTO ALEIXO (PIBSA)'),
      ('d6a35205-17c5-4a79-aa99-dc3c97b54ca6'::uuid, '160 - PROJETO SEMEAR BREJAL'),
      ('da340b9f-dcb1-43e6-857e-182085528833'::uuid, '160 - PROJETO SEMEAR BREJAL'),
      ('5ebe46f1-b72f-4b53-9ac4-d564fd593649'::uuid, '161 - REFÚGIO DE LUZ'),
      ('4a161584-b2fd-486c-bd77-f43e6d7d2e9e'::uuid, '162 - UNIVERSAL DO REINO DE DEUS'),
      ('5ad3762a-d417-4c25-a72a-aeafdf952c66'::uuid, '162 - UNIVERSAL DO REINO DE DEUS')
    ) as m(id, igreja)
   where e.id = m.id and upper(coalesce(e.igreja, '')) = 'OUTRA';
  get diagnostics v_n = row_count;
  if v_n <> 42 then
    raise exception 'esperava mover 42 equipantes de OUTRA, moveu %', v_n;
  end if;

  -- 4. Viraram parceiras: saem da relacao de igrejas acrescentadas.
  delete from public.igrejas_extras where nome = any (v_novas);
  get diagnostics v_n = row_count;
  if v_n <> 16 then
    raise exception 'esperava tirar 16 igrejas acrescentadas, tirou %', v_n;
  end if;
end;
$m$;
