-- Tela "Inscrição Confirmada!" chama a pessoa pelo nome (19/10/2026, Patrick).
-- Quem ja concluiu continua sem id nem nome completo devolvido; vai so o
-- PRIMEIRO nome -- quem digitou o CPF e a propria pessoa (o CPF e a prova de
-- dono no resto do site, ver situacao_inscricao).
do $$
declare
  v_def text := pg_get_functiondef('public.verificar_inscricao(text,text,text)'::regprocedure);
  v_novo text;
begin
  if v_def like '%''primeiro_nome''%' then return; end if;
  v_novo := replace(v_def,
    $a$'concluido', true, 'inscrito', v_inscrito);$a$,
    $a$'concluido', true, 'inscrito', v_inscrito,
                              'primeiro_nome', split_part(btrim(coalesce(v_nome, '')), ' ', 1));$a$);
  if v_novo = v_def then
    raise exception 'trecho não encontrado em verificar_inscricao';
  end if;
  execute v_novo;
end $$;
