-- ---------------------------------------------------------------------------
-- Tamanho da camisa obrigatorio na inscricao do acampante (Patrick,
-- 06/10/2026).
--
-- A Raquel viu que a soma das camisas (160) nao batia com o total de
-- acampantes (162): duas inscricoes chegaram sem tamanho, porque nem a tela
-- nem o servidor conferiam o campo. A tela passou a barrar o envio; aqui o
-- servidor confere de novo, para quem chamar a API direto.
--
-- So vale para inscricoes NOVAS (criar_inscricao). As duas que ja existem
-- sem tamanho a Raquel completa pela ficha -- uma constraint na tabela
-- travaria qualquer outra edicao dessas fichas ate alguem escolher o tamanho.
--
-- A igreja responsavel continua opcional: ha quem nao frequente igreja.
-- ---------------------------------------------------------------------------
do $do$
declare
  v_def text := pg_get_functiondef('public.criar_inscricao(text,jsonb,text)'::regprocedure);
  v_ancora text := E'  v_a := jsonb_populate_record(null::public.acampantes, p_dados);\n';
begin
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'ancora de criar_inscricao nao e unica';
  end if;
  execute replace(v_def, v_ancora,
    E'  -- Tamanho da camisa obrigatorio para acampante (20261006b).\n'
    || E'  if upper(btrim(coalesce(p_dados ->> ''tamanho_camisa'', ''''))) not in (''PP'', ''P'', ''M'', ''G'', ''GG'', ''XG'', ''XXG'') then\n'
    || E'    raise exception ''CAMISA_OBRIGATORIA'';\n'
    || E'  end if;\n\n'
    || v_ancora);
end;
$do$;
