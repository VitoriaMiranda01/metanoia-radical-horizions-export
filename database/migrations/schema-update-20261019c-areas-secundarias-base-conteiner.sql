-- Base Operacional e Contêiner viram areas SECUNDARIAS (19/10/2026, Patrick):
-- nao se reunem (sem local de reuniao), aparecem embaixo na revelacao e a
-- presenca "confirmada" nao conta para elas. Espelha AREAS_SECUNDARIAS em
-- src/constants/workAreas.js.
do $$
declare
  v_def text := pg_get_functiondef('public._area_principal(text)'::regprocedure);
  v_novo text;
begin
  v_novo := replace(v_def, $a$'Família muçulmana', 'Apresentadores', 'Equipe de Manutenção'$a$,
                           $a$'Família muçulmana', 'Apresentadores', 'Equipe de Manutenção',
    'Base Operacional', 'Contêiner'$a$);
  if v_novo = v_def then
    if v_def like '%''Base Operacional'', ''Contêiner''%' then
      return; -- ja aplicado
    end if;
    raise exception 'trecho não encontrado em _area_principal';
  end if;
  execute v_novo;
end $$;
