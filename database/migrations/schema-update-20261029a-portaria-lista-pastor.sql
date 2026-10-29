-- Portaria: a lista passa a informar se o equipante é pastor(a) (29/10/2026), para a tela
-- mostrar o mesmo ícone de igreja azul das outras telas. Mesma regra de utils/pastor.js
-- (cargo "PASTOR(A)" / "PASTOR(A) AUXILIAR" ou e_pastor marcado). Só o título, nada mais da ficha.

do $$
declare
  v_def  text := pg_get_functiondef('public.portaria_lista()'::regprocedure);
  v_novo text;
begin
  if v_def like '%''pastor'',%' then return; end if;
  v_novo := replace(v_def,
    $a$             'so_domingo', coalesce(e.so_domingo, false),$a$,
    $a$             'so_domingo', coalesce(e.so_domingo, false),
             'pastor', case
               when upper(btrim(coalesce(e.cargo_igreja, ''))) = 'PASTOR(A) AUXILIAR'
                 then case when e.sexo = 'Feminino' then 'Pastora auxiliar' else 'Pastor auxiliar' end
               when upper(btrim(coalesce(e.cargo_igreja, ''))) = 'PASTOR(A)' or e.e_pastor is true
                 then case when e.sexo = 'Feminino' then 'Pastora' else 'Pastor' end
             end,$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em portaria_lista'; end if;
  execute v_novo;
end $$;
