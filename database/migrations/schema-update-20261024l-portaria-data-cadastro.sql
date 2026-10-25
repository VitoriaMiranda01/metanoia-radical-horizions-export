-- Portaria: portaria_lista() passa a devolver a data de cadastro do equipante
-- ('cadastrado_em' = equipantes.created_at), para o filtro "cadastrou a partir de".
-- So acrescenta um campo; permissao e demais campos intocados.
do $$
declare
  v_def text;
  v_novo text;
begin
  v_def := pg_get_functiondef('public.portaria_lista()'::regprocedure);
  if v_def like '%''cadastrado_em''%' then
    return; -- ja aplicada
  end if;
  v_novo := replace(v_def, '''entrou_em'', en.entrou_em,', '''cadastrado_em'', e.created_at,' || chr(10) || '             ''entrou_em'', en.entrou_em,');
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em portaria_lista()';
  end if;
  execute v_novo;
end $$;
