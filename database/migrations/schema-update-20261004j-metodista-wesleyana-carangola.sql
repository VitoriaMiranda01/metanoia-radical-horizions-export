-- =============================================================================
-- 165 - METODISTA WESLEYANA CARANGOLA (04/10/2026)
--
-- A Raquel confirmou: sao duas Metodista Wesleyana -- a 164 (pastor Adriano
-- de Souza Dutra) e a de Carangola (pastor Filipe Fernandes).
--   - cria a 165 como parceira (trancada ate liberar) e move a inscrita que
--     escreveu "METODISTA WESLEYANA CARANGOLA";
--   - a inscrita que escreveu "METODISTA WESLEYANA LOTEAMENTO SAMAMBAIA"
--     (mesmo pastor da 164) vai para a 164.
-- =============================================================================

do $m$
declare
  v_n int;
begin
  if exists (select 1 from public.igrejas_parceiras where codigo = '165') then
    raise exception 'codigo 165 ja existe em igrejas_parceiras';
  end if;

  insert into public.igrejas_parceiras (codigo, nome, senha, acesso_liberado, senha_definida)
  values ('165', 'METODISTA WESLEYANA CARANGOLA',
          extensions.crypt(public._senha_primeiro_acesso('165'), extensions.gen_salt('bf', 12)), false, false);

  update public.equipantes e
     set igreja = m.igreja, igreja_outra = null
    from (values
      ('169327c4-03b6-46a5-9fa6-1a93905b58b0'::uuid, '165 - METODISTA WESLEYANA CARANGOLA'),
      ('7ee96506-ca3b-41fd-b47a-08f1d6e98764'::uuid, '164 - METODISTA WESLEYANA')
    ) as m(id, igreja)
   where e.id = m.id and upper(coalesce(e.igreja, '')) = 'OUTRA';
  get diagnostics v_n = row_count;
  if v_n <> 2 then
    raise exception 'esperava mover 2 equipantes de OUTRA, moveu %', v_n;
  end if;
end;
$m$;
