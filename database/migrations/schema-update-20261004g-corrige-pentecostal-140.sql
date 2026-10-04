-- =============================================================================
-- 140: corrige o erro de digitacao "PENTECOATAL" -> "PENTECOSTAL" (04/10/2026)
-- Pedido do Patrick. Mesmos lugares da 20261004f: conta do parceiro, fichas
-- (igreja, decidido_por_igreja, admin_responsavel) e limites por igreja.
-- =============================================================================

do $m$
declare
  v_antes  constant text := '140 - PENTECOATAL CRISTO ESPERANÇA NOSSA';
  v_depois constant text := '140 - PENTECOSTAL CRISTO ESPERANÇA NOSSA';
  v_n int;
begin
  update public.igrejas_parceiras set nome = 'PENTECOSTAL CRISTO ESPERANÇA NOSSA'
   where codigo = '140' and nome = 'PENTECOATAL CRISTO ESPERANÇA NOSSA';
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'conta do parceiro 140 nao encontrada com o nome antigo';
  end if;

  update public.equipantes set igreja = v_depois where igreja = v_antes;
  update public.equipantes set decidido_por_igreja = v_depois where decidido_por_igreja = v_antes;
  update public.acampantes set admin_responsavel = v_depois where admin_responsavel = v_antes;
  update public.limites_igrejas set igreja = v_depois, updated_at = now() where igreja = v_antes;
end;
$m$;
