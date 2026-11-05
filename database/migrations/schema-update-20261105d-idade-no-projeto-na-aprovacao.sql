-- Aprovacao do menor (05/11/2026): a janela mostrava so a idade de HOJE, mas
-- a regra (menor de 18 e acompanhante abaixo de 16, 20261105c) usa a idade no
-- 1o dia do projeto. Ex.: 15 anos hoje e 16 no projeto aparecia "15 anos" sem
-- acompanhante. menores_da_aprovacao passa a devolver idade_no_projeto.
do $$
declare
  v_def text := pg_get_functiondef('public.menores_da_aprovacao()'::regprocedure);
  v_novo text;
begin
  v_novo := replace(v_def,
$a$public.idade(e) as idade,$a$,
$b$public.idade(e) as idade,
           extract(year from age(coalesce(v_cfg.data_evento_inicio, current_date), e.data_nascimento))::int as idade_no_projeto,$b$);
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em menores_da_aprovacao';
  end if;
  execute v_novo;
end $$;
