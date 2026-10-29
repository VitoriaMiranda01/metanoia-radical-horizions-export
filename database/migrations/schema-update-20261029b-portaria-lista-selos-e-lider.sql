-- Portaria: a lista informa os selos da organização e se o equipante é líder (29/10/2026,
-- pedido do Patrick) para a tela mostrar os mesmos ícones das outras telas:
--   selo     = pastor_diretor | diretor | dev | dev_rosa (tabela selos_organizacao), ou null;
--   feminino = o título do selo concorda com o sexo da ficha (Pastora Diretora, Diretora);
--   lider_de = áreas em que a pessoa é líder na escala (public._eh_lider), ou null.
-- A conta da portaria continua sem ler nenhuma tabela: tudo sai pela função fechada.

do $$
declare
  v_def  text := pg_get_functiondef('public.portaria_lista()'::regprocedure);
  v_novo text;
begin
  if v_def like '%''lider_de''%' then return; end if;
  v_novo := replace(v_def,
    $a$             'so_domingo', coalesce(e.so_domingo, false),$a$,
    $a$             'so_domingo', coalesce(e.so_domingo, false),
             'selo', (select so.selo from public.selos_organizacao so where so.equipante_id = e.id),
             'feminino', (e.sexo = 'Feminino'),
             'lider_de', (select string_agg(distinct s.area_alocada, ' · ')
                            from public.escalas s
                           where s.equipante_id = e.id and s.area_alocada <> 'Não será escalado'
                             and public._eh_lider(s.area_alocada, s.atuacao)),$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em portaria_lista'; end if;
  execute v_novo;
end $$;
