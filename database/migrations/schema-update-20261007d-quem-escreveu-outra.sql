-- ---------------------------------------------------------------------------
-- Igrejas "OUTRA": ver QUEM escreveu cada nome e vincular so algumas pessoas
-- (Patrick, 07/10/2026).
--
-- O organizador precisa abrir a ficha de quem escreveu (principalmente o nome do
-- pastor) para saber a igreja certa -- e o mesmo texto ("NOVA VIDA") pode ser
-- de igrejas diferentes. Por isso:
--  * pessoas_em_outra(texto): as fichas (inteiras, so organizador) de quem
--    escreveu aquele nome em OUTRA;
--  * vincular_outra_igreja e criar_igreja_parceira ganham p_ids: com ele, so
--    essas pessoas mudam de igreja (sem ele, todas que escreveram o nome, como
--    antes).
-- ---------------------------------------------------------------------------

create or replace function public.pessoas_em_outra(p_texto text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_chave text := upper(public.unaccent_simples(btrim(coalesce(p_texto, ''))));
begin
  if not public.eh_organizador() then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(e) || jsonb_build_object('idade', e.idade) order by e.nome)
      from public.equipantes e
     where e.tipo = 'equipante'
       and upper(coalesce(e.igreja, '')) = 'OUTRA'
       and upper(public.unaccent_simples(btrim(coalesce(e.igreja_outra, '')))) = v_chave
  ), '[]'::jsonb);
end;
$fn$;

drop function if exists public.vincular_outra_igreja(text, text);
create or replace function public.vincular_outra_igreja(p_texto text, p_igreja text, p_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_igreja text := btrim(coalesce(p_igreja, ''));
  v_chave  text := upper(public.unaccent_simples(btrim(coalesce(p_texto, ''))));
  v_n      int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores podem vincular igrejas.');
  end if;
  if v_chave = '' then
    return jsonb_build_object('ok', false, 'erro', 'Informe o nome digitado.');
  end if;
  if p_ids is not null and coalesce(cardinality(p_ids), 0) = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Marque pelo menos uma pessoa.');
  end if;

  if upper(v_igreja) = 'OUTRA'
     or not (exists (select 1 from public.igrejas_parceiras i where i.codigo || ' - ' || i.nome = v_igreja)
          or exists (select 1 from public.igrejas_extras x where x.nome = v_igreja)) then
    return jsonb_build_object('ok', false, 'erro', 'Escolha uma igreja da lista.');
  end if;

  update public.equipantes e
     set igreja = v_igreja, igreja_outra = null
   where e.tipo = 'equipante'
     and upper(coalesce(e.igreja, '')) = 'OUTRA'
     and upper(public.unaccent_simples(btrim(coalesce(e.igreja_outra, '')))) = v_chave
     and (p_ids is null or e.id = any (p_ids));
  get diagnostics v_n = row_count;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Nenhuma inscrição com este nome em OUTRA (talvez já tenha sido vinculada).');
  end if;

  return jsonb_build_object('ok', true, 'vinculados', v_n, 'igreja', v_igreja);
end;
$fn$;

drop function if exists public.criar_igreja_parceira(text, text);
create or replace function public.criar_igreja_parceira(p_nome text, p_texto text default null, p_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_nome   text := upper(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')));
  v_chave  text := upper(public.unaccent_simples(btrim(coalesce(p_texto, ''))));
  v_org    text;
  v_cod    text;
  v_full   text;
  v_igual  text;
  v_n      int := 0;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores podem criar igrejas.');
  end if;
  if p_ids is not null and coalesce(cardinality(p_ids), 0) = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Marque pelo menos uma pessoa.');
  end if;

  if length(v_nome) < 3 or length(v_nome) > 80 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o nome da igreja (de 3 a 80 caracteres).');
  end if;
  if v_nome ~ '[^[:alnum:][:space:].,''’°ºª()|&/-]' then
    return jsonb_build_object('ok', false, 'erro', 'O nome tem algum símbolo que não pode: use letras, números e pontuação simples.');
  end if;

  perform pg_advisory_xact_lock(hashtext('criar_igreja_parceira'));

  select i.codigo into v_igual
    from public.igrejas_parceiras i
   where upper(public.unaccent_simples(i.nome)) = upper(public.unaccent_simples(v_nome))
   limit 1;
  if v_igual is not null then
    return jsonb_build_object('ok', false, 'erro', 'Já existe uma igreja com este nome (código ' || v_igual || '). Use "Vincular".');
  end if;
  if exists (select 1 from public.igrejas_extras x
              where upper(public.unaccent_simples(x.nome)) = upper(public.unaccent_simples(v_nome))) then
    return jsonb_build_object('ok', false, 'erro', 'Esta igreja já está na lista, sem código. Use "Vincular".');
  end if;

  select (coalesce(max(i.codigo::int), 0) + 1)::text into v_cod
    from public.igrejas_parceiras i
   where i.codigo ~ '^\d+$' and i.codigo::int < 900;
  v_org := coalesce(public._nome_organizador_logado(), 'organizador');
  v_full := v_cod || ' - ' || v_nome;

  insert into public.igrejas_parceiras (codigo, nome, senha, acesso_liberado, senha_definida, criada_pela_tela, criada_por)
  values (v_cod, v_nome,
          extensions.crypt(public._senha_primeiro_acesso(v_cod), extensions.gen_salt('bf', 12)),
          false, false, true, v_org);

  if v_chave <> '' then
    update public.equipantes e
       set igreja = v_full, igreja_outra = null
     where e.tipo = 'equipante'
       and upper(coalesce(e.igreja, '')) = 'OUTRA'
       and upper(public.unaccent_simples(btrim(coalesce(e.igreja_outra, '')))) = v_chave
       and (p_ids is null or e.id = any (p_ids));
    get diagnostics v_n = row_count;
  end if;

  return jsonb_build_object('ok', true, 'codigo', v_cod, 'nome', v_nome, 'igreja', v_full, 'vinculados', v_n);
end;
$fn$;

revoke all on function public.pessoas_em_outra(text)                           from public, anon;
revoke all on function public.vincular_outra_igreja(text, text, uuid[])        from public, anon;
revoke all on function public.criar_igreja_parceira(text, text, uuid[])        from public, anon;
grant execute on function public.pessoas_em_outra(text)                        to authenticated;
grant execute on function public.vincular_outra_igreja(text, text, uuid[])     to authenticated;
grant execute on function public.criar_igreja_parceira(text, text, uuid[])     to authenticated;
