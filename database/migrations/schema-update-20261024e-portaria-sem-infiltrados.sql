-- ---------------------------------------------------------------------------
-- Portaria: infiltrado fica de fora (Patrick, 24/10/2026)
--
-- Quem esta escalado em "Infiltrados" finge nao ser da equipe de trabalho e
-- entra junto com os acampantes. Sai da lista da portaria dos equipantes, e
-- "Pagar agora" / "Liberar entrada" recusam essa pessoa (_e_infiltrado).
-- ---------------------------------------------------------------------------

do $$
declare
  v_def text;
  c_msg constant text := '''Infiltrado entra junto com os acampantes, não pela portaria dos equipantes.''';
begin
  -- Lista
  v_def := pg_get_functiondef('public.portaria_lista()'::regprocedure);
  if position('where e.tipo = ''equipante''' in v_def) = 0 then
    raise exception 'portaria_lista: trecho não encontrado';
  end if;
  execute replace(v_def, 'where e.tipo = ''equipante''',
    'where e.tipo = ''equipante''' || chr(10) ||
    '       and not public._e_infiltrado(''equipante'', e.id)');

  -- Pagar agora
  v_def := pg_get_functiondef('public.portaria_dar_baixa(text, uuid, text, numeric, boolean)'::regprocedure);
  if position('  if not public._equipante_na_escala(p_id) then' in v_def) = 0 then
    raise exception 'portaria_dar_baixa: trecho não encontrado';
  end if;
  execute replace(v_def, '  if not public._equipante_na_escala(p_id) then',
    '  if public._e_infiltrado(''equipante'', p_id) then' || chr(10) ||
    '    return jsonb_build_object(''ok'', false, ''erro'', ' || c_msg || ');' || chr(10) ||
    '  end if;' || chr(10) ||
    '  if not public._equipante_na_escala(p_id) then');

  -- Liberar entrada
  v_def := pg_get_functiondef('public.portaria_liberar_entrada(uuid)'::regprocedure);
  if position('  select * into v_ja from' in v_def) = 0 then
    raise exception 'portaria_liberar_entrada: trecho não encontrado';
  end if;
  execute replace(v_def, '  select * into v_ja from',
    '  if public._e_infiltrado(''equipante'', p_id) then' || chr(10) ||
    '    return jsonb_build_object(''ok'', false, ''erro'', ' || c_msg || ');' || chr(10) ||
    '  end if;' || chr(10) || chr(10) ||
    '  select * into v_ja from');
end $$;
