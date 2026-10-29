-- =============================================================================
-- Pastor do quadro "Todas as igrejas cadastradas" vale nas fichas (29/10/2026)
-- =============================================================================
-- Pedido do Patrick: quando a igreja tem pastor no quadro, o "Nome do pastor"
-- de TODAS as fichas de equipante daquela igreja e o do quadro -- sempre. O
-- que o equipante escreve so vale para igreja sem pastor no quadro.
--
--   * gatilho pastor_do_quadro (BEFORE INSERT/UPDATE de igreja e pastor_nome):
--     inscricao, reinscricao, troca de igreja e Editar inscricao;
--   * editar_igreja: salvar o pastor leva o nome para as fichas da igreja na
--     hora (apagar o pastor do quadro deixa as fichas como estao);
--   * editar_igreja / cadastrar_igreja: pastor do quadro so com letras (a
--     mesma regra das fichas; senao o gatilho travaria as fichas da igreja);
--   * pastor_da_igreja_cadastrada(igreja): o formulario tranca o campo;
--   * corrige as fichas atuais.
-- Acampantes ficam de fora: a igreja deles e texto livre (a parceira e so
-- quem fez a inscricao).
-- =============================================================================

create or replace function public._pastor_do_quadro(p_igreja text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select nullif(btrim(i.pastor), '')
    from public.igrejas_parceiras i
   where i.codigo || ' - ' || i.nome = btrim(coalesce(p_igreja, ''))
     and public._nome_simples_valido(i.pastor)
   limit 1;
$$;
revoke all on function public._pastor_do_quadro(text) from public, anon, authenticated;

-- Para o formulario: o pastor do quadro da igreja escolhida, ou null.
create or replace function public.pastor_da_igreja_cadastrada(p_igreja text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select public._pastor_do_quadro(p_igreja);
$$;
revoke all on function public.pastor_da_igreja_cadastrada(text) from public;
grant execute on function public.pastor_da_igreja_cadastrada(text) to anon, authenticated;

create or replace function public._tg_pastor_do_quadro()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v text := public._pastor_do_quadro(new.igreja);
begin
  if v is not null then
    new.pastor_nome := v;
  end if;
  return new;
end;
$$;
revoke all on function public._tg_pastor_do_quadro() from public, anon, authenticated;

-- "pastor_do_quadro" roda antes de validar_ficha (ordem alfabetica).
drop trigger if exists pastor_do_quadro on public.equipantes;
create trigger pastor_do_quadro
  before insert or update of igreja, pastor_nome on public.equipantes
  for each row execute function public._tg_pastor_do_quadro();

-- editar_igreja: pastor so com letras + leva o nome para as fichas.
do $$
declare
  v_def text := pg_get_functiondef('public.editar_igreja(text,text,text,text)'::regprocedure);
  v_novo text;
begin
  v_novo := replace(v_def,
$a$  if v_pastor is not null and (length(v_pastor) < 3 or length(v_pastor) > 80) then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o nome do pastor (de 3 a 80 caracteres) ou deixe em branco.');
  end if;$a$,
$a$  if v_pastor is not null and (length(v_pastor) < 3 or length(v_pastor) > 80) then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o nome do pastor (de 3 a 80 caracteres) ou deixe em branco.');
  end if;
  if v_pastor is not null and not public._nome_simples_valido(v_pastor) then
    return jsonb_build_object('ok', false, 'erro', 'O nome do pastor só pode ter letras (sem barras, números ou outros sinais).');
  end if;$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado (validação do pastor)'; end if;
  v_def := v_novo;

  v_novo := replace(v_def,
$a$   where id = v_ig.id;

  return jsonb_build_object('ok', true, 'igreja', v_depois, 'antes', v_antes,
                            'codigo_mudou', v_cod <> v_ig.codigo, 'fichas', v_fichas);$a$,
$a$   where id = v_ig.id;

  -- Pastor do quadro vale em todas as fichas da igreja (20261029e).
  v_n := 0;
  if v_pastor is not null then
    update public.equipantes set pastor_nome = v_pastor
     where igreja = v_depois and pastor_nome is distinct from v_pastor;
    get diagnostics v_n = row_count;
  end if;

  return jsonb_build_object('ok', true, 'igreja', v_depois, 'antes', v_antes,
                            'codigo_mudou', v_cod <> v_ig.codigo, 'fichas', v_fichas,
                            'fichas_pastor', v_n);$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado (fichas do pastor)'; end if;
  execute v_novo;
end;
$$;

-- cadastrar_igreja: pastor so com letras.
do $$
declare
  v_def text := pg_get_functiondef('public.cadastrar_igreja(text,text,text,integer)'::regprocedure);
  v_novo text;
begin
  v_novo := replace(v_def,
$a$    return jsonb_build_object('ok', false, 'erro', 'Escreva o nome do pastor (de 3 a 80 caracteres).');
  end if;$a$,
$a$    return jsonb_build_object('ok', false, 'erro', 'Escreva o nome do pastor (de 3 a 80 caracteres).');
  end if;
  if not public._nome_simples_valido(v_pastor) then
    return jsonb_build_object('ok', false, 'erro', 'O nome do pastor só pode ter letras (sem barras, números ou outros sinais).');
  end if;$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado (cadastrar_igreja)'; end if;
  execute v_novo;
end;
$$;

-- Fichas atuais.
update public.equipantes e
   set pastor_nome = public._pastor_do_quadro(e.igreja)
 where public._pastor_do_quadro(e.igreja) is not null
   and e.pastor_nome is distinct from public._pastor_do_quadro(e.igreja);
