-- =============================================================================
-- Corrige erros de digitacao em dois nomes da lista oficial (04/10/2026)
--   93: "PENTECOTAL"    -> "PENTECOSTAL JESUS E O CAMINHO DEUS E O SENHOR"
--  132: "ASSASSEMBLEIA" -> "ASSEMBLEIA DE DEUS MINISTERIO VINDE A MIM UNAMAR"
-- Pedido do Patrick. Mesmos lugares da 20261004f: conta do parceiro, fichas
-- (igreja, decidido_por_igreja, admin_responsavel) e limites por igreja.
-- =============================================================================

do $m$
declare
  r record;
  v_antes text;
  v_depois text;
  v_n int;
begin
  for r in select * from (values
    ('93',  'PENTECOTAL JESUS É O CAMINHO DEUS É O SENHOR',   'PENTECOSTAL JESUS É O CAMINHO DEUS É O SENHOR'),
    ('132', 'ASSASSEMBLEIA DE DEUS MINISTÉRIO VINDE A MIM UNAMAR', 'ASSEMBLEIA DE DEUS MINISTÉRIO VINDE A MIM UNAMAR')
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
