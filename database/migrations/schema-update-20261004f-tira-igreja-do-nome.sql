-- =============================================================================
-- Tira a palavra "IGREJA" do comeco do nome das igrejas parceiras (04/10/2026)
--
-- Pedido do Patrick: com varios nomes comecando com "IGREJA", a busca e a
-- ordem alfabetica do seletor de igreja perdiam a funcao. Ex.: "156 - IGREJA
-- PENTECOSTAL JESUS ESTA VOLTANDO" vira "156 - PENTECOSTAL JESUS ESTA VOLTANDO".
--
-- Ficaram como estavam (sem o "Igreja" o nome comecaria por "de"/"das"):
-- 03 - IGREJAS DE PETROPOLIS, 10 - IGREJA DE DEUS EM PIMENTEIRAS,
-- 16 - IGREJA DE CRISTO EM TERESOPOLIS, 100 - IGREJA DAS NACOES.
--
-- O nome completo ("NNN - NOME") esta gravado nas fichas (equipantes.igreja,
-- equipantes.decidido_por_igreja, acampantes.admin_responsavel), nos limites
-- por igreja e na conta do parceiro (so o nome). O site (IGREJAS_PARCEIRAS)
-- muda junto. O login do parceiro e pelo codigo, nao muda.
-- =============================================================================

do $m$
declare
  r record;
  v_antes text;
  v_depois text;
  v_n int;
begin
  for r in select * from (values
    ('135', 'IGREJA PENTECOSTAL ICTHUS', 'PENTECOSTAL ICTHUS'),
    ('136', 'IGREJA BATISTA DE MOTTAS', 'BATISTA DE MOTTAS'),
    ('138', 'IGREJA BATISTA DO RECREIO DOS BANDEIRANTES RJ', 'BATISTA DO RECREIO DOS BANDEIRANTES RJ'),
    ('140', 'IGREJA PENTECOATAL CRISTO ESPERANÇA NOSSA', 'PENTECOATAL CRISTO ESPERANÇA NOSSA'),
    ('141', 'IGREJA BATISTA DO ALTO', 'BATISTA DO ALTO'),
    ('142', 'IGREJA BATISTA NOVA FILADÉLFIA', 'BATISTA NOVA FILADÉLFIA'),
    ('143', 'IGREJA NOVOS COMEÇOS', 'NOVOS COMEÇOS'),
    ('144', 'IGREJA METODISTA CAMPUS ALBUQUERQUE', 'METODISTA CAMPUS ALBUQUERQUE'),
    ('153', 'IGREJA BATISTA ATITUDE', 'BATISTA ATITUDE'),
    ('154', 'IGREJA BATISTA ATITUDE | OCEANICA', 'BATISTA ATITUDE | OCEANICA'),
    ('155', 'IGREJA BATISTA NA TIJUCA', 'BATISTA NA TIJUCA'),
    ('156', 'IGREJA PENTECOSTAL JESUS ESTÁ VOLTANDO', 'PENTECOSTAL JESUS ESTÁ VOLTANDO')
  ) as t(codigo, antigo, novo)
  loop
    v_antes  := r.codigo || ' - ' || r.antigo;
    v_depois := r.codigo || ' - ' || r.novo;

    update public.igrejas_parceiras set nome = r.novo where codigo = r.codigo and nome = r.antigo;
    get diagnostics v_n = row_count;
    if v_n <> 1 then
      raise exception 'conta do parceiro % nao encontrada com o nome antigo', r.codigo;
    end if;

    update public.equipantes set igreja = v_depois where igreja = v_antes;
    update public.equipantes set decidido_por_igreja = v_depois where decidido_por_igreja = v_antes;
    update public.acampantes set admin_responsavel = v_depois where admin_responsavel = v_antes;
    update public.limites_igrejas set igreja = v_depois, updated_at = now() where igreja = v_antes;
  end loop;
end;
$m$;
