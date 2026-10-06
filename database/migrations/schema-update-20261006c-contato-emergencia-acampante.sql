-- ---------------------------------------------------------------------------
-- Contato de emergencia do acampante (Patrick, 06/10/2026)
--
-- Chegaram inscricoes com o telefone escrito no lugar do NOME do contato e
-- com o proprio WhatsApp repetido como telefone de emergencia -- ou seja,
-- sem contato de emergencia nenhum. A tela passou a barrar; aqui o servidor
-- confere de novo, so nas inscricoes NOVAS (as antigas a Raquel corrige pela
-- ficha):
--   CONTATO_NOME_INVALIDO   nome com numero, ou sem ao menos 2 caracteres
--   CONTATO_MESMO_TELEFONE  telefone de emergencia igual ao WhatsApp
-- ---------------------------------------------------------------------------
do $do$
declare
  v_def text := pg_get_functiondef('public.criar_inscricao(text,jsonb,text)'::regprocedure);
  v_ancora text := E'  -- Tamanho da camisa obrigatorio para acampante (20261006b).\n';
begin
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'ancora de criar_inscricao nao e unica';
  end if;
  execute replace(v_def, v_ancora,
    E'  -- Contato de emergencia (20261006c): nome sem numero; telefone de outra pessoa.\n'
    || E'  if coalesce(p_dados ->> ''contato_emergencia_nome'', '''') ~ ''[0-9]''\n'
    || E'     or length(regexp_replace(coalesce(p_dados ->> ''contato_emergencia_nome'', ''''), ''[[:space:]''''.-]'', '''', ''g'')) < 2 then\n'
    || E'    raise exception ''CONTATO_NOME_INVALIDO'';\n'
    || E'  end if;\n'
    || E'  if public._telefone_normalizado(p_dados ->> ''contato_emergencia_telefone'', true,\n'
    || E'       nullif(regexp_replace(coalesce(p_dados ->> ''cpf'', ''''), ''\\D'', '''', ''g''), '''') is null)\n'
    || E'     = public._telefone_normalizado(p_dados ->> ''whatsapp'', false,\n'
    || E'       nullif(regexp_replace(coalesce(p_dados ->> ''cpf'', ''''), ''\\D'', '''', ''g''), '''') is null) then\n'
    || E'    raise exception ''CONTATO_MESMO_TELEFONE'';\n'
    || E'  end if;\n\n'
    || v_ancora);
end;
$do$;
