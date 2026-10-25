-- 25/10/2026 (Patrick pediu para verificar o desempenho da tela de escalas).
--
-- Medido no oficial, logado como organizador: ler as escalas com os dados do
-- equipante (o que a tela de escalas faz a cada 30 s) levava ~102 ms; sem a
-- RLS, ~1 ms. Motivo: as policies chamam eh_organizador() / eh_parceiro() /
-- pode_gerir_escala() "soltas", e o Postgres avalia a funcao em CADA LINHA
-- (~2 mil linhas por leitura entre escalas e equipantes).
--
-- Correcao recomendada pelo Supabase: escrever "(select eh_organizador())".
-- O Postgres calcula uma vez por consulta (initplan) e reaproveita. A REGRA
-- E A MESMA -- as funcoes sao STABLE e nao recebem nada da linha.
--
-- Reescreve so as policies do schema public, so essas tres funcoes, e nunca
-- embrulha duas vezes (pode rodar de novo sem efeito).

do $$
declare
  r record;
  v_using text;
  v_check text;
  v_novo_using text;
  v_novo_check text;
  v_sql text;
  v_mudou int := 0;
  -- (?<!SELECT ) : nao mexe no que ja esta embrulhado
  v_padrao constant text := '(?<!SELECT )\m(eh_organizador|eh_parceiro|pode_gerir_escala)\(\)';
begin
  for r in
    select p.polname, c.relname,
           pg_get_expr(p.polqual, p.polrelid) as qual,
           pg_get_expr(p.polwithcheck, p.polrelid) as chk
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
  loop
    v_using := r.qual;
    v_check := r.chk;
    v_novo_using := case when v_using is null then null else regexp_replace(v_using, v_padrao, '( SELECT \1() AS \1)', 'g') end;
    v_novo_check := case when v_check is null then null else regexp_replace(v_check, v_padrao, '( SELECT \1() AS \1)', 'g') end;
    if v_novo_using is distinct from v_using or v_novo_check is distinct from v_check then
      v_sql := format('alter policy %I on public.%I', r.polname, r.relname);
      if v_novo_using is not null then v_sql := v_sql || format(' using (%s)', v_novo_using); end if;
      if v_novo_check is not null then v_sql := v_sql || format(' with check (%s)', v_novo_check); end if;
      execute v_sql;
      v_mudou := v_mudou + 1;
    end if;
  end loop;
  raise notice 'policies reescritas: %', v_mudou;
end $$;
