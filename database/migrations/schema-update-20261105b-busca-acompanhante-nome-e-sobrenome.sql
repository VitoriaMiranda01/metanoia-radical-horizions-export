-- Revisao da 20261105a (05/11/2026): a busca do acompanhante na janela do
-- menor aceitava 3 letras ("ana") e o pastor parceiro via nome, igreja e
-- situacao de equipantes de OUTRAS igrejas. Agora so com nome e sobrenome
-- (2 palavras de 2+ letras, fora de/da/do/dos/das/e).
do $$
declare
  v_def text := pg_get_functiondef('public.buscar_acompanhante(uuid, text)'::regprocedure);
  v_novo text;
begin
  v_novo := replace(v_def,
$a$  if coalesce(cardinality(v_ws), 0) = 0 or length(btrim(coalesce(p_termo, ''))) < 3 then$a$,
$b$  if coalesce(cardinality(v_ws), 0) < 2 then$b$);
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em buscar_acompanhante';
  end if;
  execute v_novo;
end $$;
