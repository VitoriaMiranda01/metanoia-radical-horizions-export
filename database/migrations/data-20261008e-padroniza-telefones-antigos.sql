-- ---------------------------------------------------------------------------
-- Telefones antigos no formato padrao (Patrick, 08/10/2026)
--
-- Cadastros de antes da padronizacao (migration 20261003d) ficaram com o
-- numero como a pessoa digitou: "(021)987968565", "+55 21 9...", com espaco
-- e traco. O numero esta certo, mas a tela mostrava "(02) 19879-6856" e o
-- link do WhatsApp saia errado. Aqui so muda o FORMATO: o valor gravado passa
-- a ser o que _telefone_normalizado devolve (so digitos, sem 0 nem 55 antes
-- do DDD) -- o mesmo que o gatilho _padronizar_telefones ja faz em qualquer
-- cadastro ou edicao. Numero que nao passa na conferencia NAO e tocado (fica
-- para corrigir a mao).
-- ---------------------------------------------------------------------------

do $m$
declare
  c record;
  v_n int;
  v_total int := 0;
begin
  for c in
    select * from (values
      ('acampantes', 'whatsapp', false),
      ('acampantes', 'contato_emergencia_telefone', true),
      ('acampantes', 'quem_indicou_telefone', true),
      ('equipantes', 'whatsapp', false),
      ('equipantes', 'contato_emergencia_telefone', true),
      ('equipantes', 'telefone_residencial', true),
      ('equipantes', 'telefone', true)
    ) as t(tabela, campo, aceita_fixo)
  loop
    execute format(
      'update public.%1$I set %2$I = public._telefone_normalizado(%2$I, %3$L, '
      || 'nullif(regexp_replace(coalesce(cpf, ''''), ''\D'', '''', ''g''), '''') is null) '
      || 'where nullif(btrim(coalesce(%2$I, '''')), '''') is not null '
      || 'and public._telefone_normalizado(%2$I, %3$L, nullif(regexp_replace(coalesce(cpf, ''''), ''\D'', '''', ''g''), '''') is null) '
      || 'is distinct from %2$I '
      || 'and public._telefone_normalizado(%2$I, %3$L, nullif(regexp_replace(coalesce(cpf, ''''), ''\D'', '''', ''g''), '''') is null) is not null',
      c.tabela, c.campo, c.aceita_fixo);
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    raise notice '% .%: % padronizados', c.tabela, c.campo, v_n;
  end loop;
  raise notice 'total: %', v_total;
end;
$m$;
