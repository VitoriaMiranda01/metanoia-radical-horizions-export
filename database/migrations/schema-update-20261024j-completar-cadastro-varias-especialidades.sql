-- Completar cadastro: quem ainda NAO informou a especialidade da Saude pode
-- marcar mais de uma (24/10/2026, pedido do Patrick). Quem ja informou (ou
-- escreveu "Outro") nao tem a pendencia, entao nao passa por aqui: a Vera e a
-- organizacao ajustam pela tela da Saude.
-- completar_minha_inscricao aceita especialidade_saude_adicionais (array) so
-- junto com a pendencia "especialidade_saude".

do $mig$
declare
  v text;
begin
  v := pg_get_functiondef('public.completar_minha_inscricao(uuid,text,text,date,jsonb)'::regprocedure);
  if position('  s_esp text; s_esp_outro text;' in v) = 0
     or position(E'    v_tmp := public._especialidade_saude_erro(s_esp, s_esp_outro);\n' in v) = 0
     or position(E'      especialidade_saude_outro = case when s_esp is not null then s_esp_outro else q.especialidade_saude_outro end\n' in v) = 0
     or position($a$'depois', s_esp || case when s_esp_outro is not null then ' — ' || s_esp_outro else '' end, 'em', v_agora));$a$ in v) = 0 then
    raise exception 'completar_minha_inscricao: trecho nao encontrado';
  end if;

  v := replace(v, '  s_esp text; s_esp_outro text;', '  s_esp text; s_esp_outro text; s_esp_adic text[];');

  v := replace(v, E'    v_tmp := public._especialidade_saude_erro(s_esp, s_esp_outro);\n', $b$    v_tmp := public._especialidade_saude_erro(s_esp, s_esp_outro);
    if v_tmp is null and jsonb_typeof(d -> 'especialidade_saude_adicionais') = 'array' then
      select array_agg(btrim(x)) into s_esp_adic
        from jsonb_array_elements_text(d -> 'especialidade_saude_adicionais') x
       where btrim(x) <> '';
      if exists (select 1 from unnest(coalesce(s_esp_adic, '{}')) x
                  where x = 'Outro' or not exists (select 1 from public.especialidades_saude s where s.nome = x)) then
        v_tmp := 'Escolha uma especialidade da lista.';
      end if;
    end if;
$b$);

  v := replace(v, E'      especialidade_saude_outro = case when s_esp is not null then s_esp_outro else q.especialidade_saude_outro end\n',
    $b$      especialidade_saude_outro = case when s_esp is not null then s_esp_outro else q.especialidade_saude_outro end,
      especialidades_saude_adicionais = case when s_esp is not null then s_esp_adic else q.especialidades_saude_adicionais end
$b$);

  v := replace(v, $a$'depois', s_esp || case when s_esp_outro is not null then ' — ' || s_esp_outro else '' end, 'em', v_agora));$a$,
    $a$'depois', s_esp || case when s_esp_outro is not null then ' — ' || s_esp_outro else '' end
                 || case when s_esp_adic is not null then ' + ' || array_to_string(s_esp_adic, ', ') else '' end, 'em', v_agora));$a$);
  execute v;
end
$mig$;
