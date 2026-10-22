-- Quem concluiu e entra pelo CPF passa a cair na area dos status (acompanhamento),
-- onde esta o botao "Ver confirmacao da inscricao" (21/10/2026, Patrick). Antes ia
-- direto para a tela de confirmacao e o "Voltar a Area do Equipante" so levava ao CPF.
-- Equipante nunca mais volta 'concluido' em verificar_inscricao: recebe id e nome
-- como os demais e as telas conferem a prova de dono. Acampante nao muda.
do $$
declare
  v_def text := pg_get_functiondef('public.verificar_inscricao(text,text,text)'::regprocedure);
  v_novo text;
begin
  if v_def like '%or (false%' then return; end if;
  v_novo := replace(v_def,
    $a$or (v_cpf <> ''$a$,
    $a$or (false$a$);
  if v_novo = v_def then
    raise exception 'trecho não encontrado em verificar_inscricao';
  end if;
  execute v_novo;
end $$;
