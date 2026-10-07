-- ---------------------------------------------------------------------------
-- Igrejas "OUTRA": vincular a uma igreja que ja existe, ou criar a igreja nova
-- no proximo codigo (Patrick, 07/10/2026).
--
--  1. vincular_outra_igreja(texto, igreja): todo equipante que escreveu aquele
--     nome em OUTRA passa para a igreja escolhida (igreja = "NNN - NOME",
--     igreja_outra = null). A ficha entra na igreja certa: o parceiro dela
--     passa a ver e a aprovar.
--  2. criar_igreja_parceira(nome, texto): cria a igreja com o PROXIMO CODIGO
--     (maior codigo + 1; o 146, vago de proposito, nao e reaproveitado), com
--     conta de parceiro igual as outras (senha de primeiro acesso pela formula
--     do banco, acesso trancado ate a organizacao liberar em Senhas dos
--     Parceiros) e, se veio de um nome digitado, vincula quem escreveu aquele
--     nome.
--  3. opcoes_de_igreja(): o que o formulario publico precisa saber alem da lista
--     do site -- as igrejas criadas aqui, as acrescentadas sem codigo e se
--     OUTRA / "84 - DIVERSOS" ainda valem nesta edicao.
--  4. Na virada de edicao (resetar_para_nova_edicao) as opcoes OUTRA (equipante)
--     e 84 - DIVERSOS (acampante) deixam de existir: a tela esconde e o servidor
--     recusa (IGREJA_OUTRA_ENCERRADA / IGREJA_DIVERSOS_ENCERRADA).
-- ---------------------------------------------------------------------------

create or replace function pg_temp._patch(p_fn regprocedure, p_de text, p_para text, p_vezes int default 1)
returns void
language plpgsql
as $fn$
declare
  d text := pg_get_functiondef(p_fn);
  n int := (length(d) - length(replace(d, p_de, ''))) / length(p_de);
begin
  if n <> p_vezes then
    raise exception 'patch %: esperava % ocorrencia(s) de [%], achou %', p_fn, p_vezes, left(p_de, 80), n;
  end if;
  execute replace(d, p_de, p_para);
end;
$fn$;

alter table public.igrejas_parceiras add column if not exists criada_pela_tela boolean not null default false;
alter table public.igrejas_parceiras add column if not exists criada_por text;

alter table public.configuracoes add column if not exists permite_igreja_outra    boolean not null default true;
alter table public.configuracoes add column if not exists permite_igreja_diversos boolean not null default true;

-- ---------------------------------------------------------------------------
-- O que o formulario publico precisa saber sobre igrejas
-- ---------------------------------------------------------------------------
create or replace function public.opcoes_de_igreja()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select jsonb_build_object(
    'novas', coalesce((select jsonb_agg(i.codigo || ' - ' || i.nome order by lpad(i.codigo, 4, '0'))
                         from public.igrejas_parceiras i where i.criada_pela_tela), '[]'::jsonb),
    'extras', coalesce((select jsonb_agg(x.nome order by x.nome) from public.igrejas_extras x), '[]'::jsonb),
    'permite_outra', coalesce((select c.permite_igreja_outra from public.configuracoes c
                                order by c.edicao_numero desc limit 1), true),
    'permite_diversos', coalesce((select c.permite_igreja_diversos from public.configuracoes c
                                   order by c.edicao_numero desc limit 1), true));
$fn$;

revoke all on function public.opcoes_de_igreja() from public;
grant execute on function public.opcoes_de_igreja() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vincular os nomes digitados em OUTRA a uma igreja que ja existe
-- ---------------------------------------------------------------------------
create or replace function public.vincular_outra_igreja(p_texto text, p_igreja text)
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

  -- A igreja de destino precisa existir de verdade (conta de parceiro ou
  -- igreja acrescentada), e nunca pode ser a propria OUTRA.
  if upper(v_igreja) = 'OUTRA'
     or not (exists (select 1 from public.igrejas_parceiras i where i.codigo || ' - ' || i.nome = v_igreja)
          or exists (select 1 from public.igrejas_extras x where x.nome = v_igreja)) then
    return jsonb_build_object('ok', false, 'erro', 'Escolha uma igreja da lista.');
  end if;

  update public.equipantes e
     set igreja = v_igreja, igreja_outra = null
   where e.tipo = 'equipante'
     and upper(coalesce(e.igreja, '')) = 'OUTRA'
     and upper(public.unaccent_simples(btrim(coalesce(e.igreja_outra, '')))) = v_chave;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Nenhuma inscrição com este nome em OUTRA (talvez já tenha sido vinculada).');
  end if;

  return jsonb_build_object('ok', true, 'vinculados', v_n, 'igreja', v_igreja);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Criar a igreja nova no proximo codigo
-- ---------------------------------------------------------------------------
create or replace function public.criar_igreja_parceira(p_nome text, p_texto text default null)
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

  if length(v_nome) < 3 or length(v_nome) > 80 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o nome da igreja (de 3 a 80 caracteres).');
  end if;
  if v_nome ~ '[^[:alnum:][:space:].,''’°ºª()|&/-]' then
    return jsonb_build_object('ok', false, 'erro', 'O nome tem algum símbolo que não pode: use letras, números e pontuação simples.');
  end if;

  -- Um criador por vez: o codigo e "o maior + 1".
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
   where i.codigo ~ '^\d+$' and i.codigo::int < 900;   -- 999 e a conta de teste
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
       and upper(public.unaccent_simples(btrim(coalesce(e.igreja_outra, '')))) = v_chave;
    get diagnostics v_n = row_count;
  end if;

  return jsonb_build_object('ok', true, 'codigo', v_cod, 'nome', v_nome, 'igreja', v_full, 'vinculados', v_n);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- A tela: nomes digitados, igrejas criadas aqui e o proximo codigo
-- ---------------------------------------------------------------------------
create or replace function public.outras_igrejas()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_digitadas jsonb;
  v_extras    jsonb;
  v_novas     jsonb;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;

  -- Agrupa sem diferenciar maiuscula/minuscula nem acento. So conta quem
  -- esta MESMO em OUTRA: ficha vinculada (igreja_outra limpa) sai da lista.
  select coalesce(jsonb_agg(t order by t.quantas desc, t.nome), '[]'::jsonb)
    into v_digitadas
  from (
    select max(btrim(e.igreja_outra)) as nome,
           count(*)                   as quantas,
           bool_or(x.id is not null)  as ja_na_lista
      from public.equipantes e
      left join public.igrejas_extras x
             on upper(public.unaccent_simples(x.nome))
              = upper(public.unaccent_simples(btrim(e.igreja_outra)))
     where e.tipo = 'equipante'
       and upper(coalesce(e.igreja, '')) = 'OUTRA'
       and coalesce(btrim(e.igreja_outra), '') <> ''
     group by upper(public.unaccent_simples(btrim(e.igreja_outra)))
  ) t;

  select coalesce(jsonb_agg(t order by t.nome), '[]'::jsonb)
    into v_extras
  from (
    select x.id, x.nome, x.criada_em, x.criada_por,
           (select count(*) from public.equipantes e
             where upper(public.unaccent_simples(btrim(coalesce(e.igreja_outra,''))))
                 = upper(public.unaccent_simples(x.nome))) as quantas
      from public.igrejas_extras x
  ) t;

  select coalesce(jsonb_agg(t order by lpad(t.codigo, 4, '0')), '[]'::jsonb)
    into v_novas
  from (
    select i.codigo, i.nome, i.criada_por, i.criado_em,
           (select count(*) from public.equipantes e where e.tipo = 'equipante' and e.igreja = i.codigo || ' - ' || i.nome) as equipantes,
           (select count(*) from public.acampantes a where a.admin_responsavel = i.codigo || ' - ' || i.nome) as acampantes
      from public.igrejas_parceiras i
     where i.criada_pela_tela
  ) t;

  return jsonb_build_object(
    'ok', true, 'digitadas', v_digitadas, 'extras', v_extras, 'novas', v_novas,
    'proximo_codigo', (select (coalesce(max(i.codigo::int), 0) + 1)::text
                         from public.igrejas_parceiras i
                        where i.codigo ~ '^\d+$' and i.codigo::int < 900),
    'permite_outra', coalesce((select c.permite_igreja_outra from public.configuracoes c
                                order by c.edicao_numero desc limit 1), true),
    'permite_diversos', coalesce((select c.permite_igreja_diversos from public.configuracoes c
                                   order by c.edicao_numero desc limit 1), true));
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Virada de edicao: OUTRA e DIVERSOS deixam de valer
-- ---------------------------------------------------------------------------
select pg_temp._patch(
  'public._dados_inscricao_validos(jsonb,text)'::regprocedure,
  '  v_campo text;' || chr(10) || 'begin' || chr(10),
  '  v_campo text;' || chr(10) || 'begin' || chr(10) ||
  '  if upper(btrim(coalesce(p_dados ->> ''igreja'', ''''))) = ''OUTRA''' || chr(10) ||
  '     and not coalesce((select c.permite_igreja_outra from public.configuracoes c' || chr(10) ||
  '                        order by c.edicao_numero desc limit 1), true) then' || chr(10) ||
  '    return ''IGREJA_OUTRA_ENCERRADA'';' || chr(10) ||
  '  end if;' || chr(10) ||
  '  if upper(btrim(coalesce(p_dados ->> ''admin_responsavel'', ''''))) = ''84 - DIVERSOS''' || chr(10) ||
  '     and not coalesce((select c.permite_igreja_diversos from public.configuracoes c' || chr(10) ||
  '                        order by c.edicao_numero desc limit 1), true) then' || chr(10) ||
  '    return ''IGREJA_DIVERSOS_ENCERRADA'';' || chr(10) ||
  '  end if;' || chr(10)
);

select pg_temp._patch(
  'public.resetar_para_nova_edicao(integer)'::regprocedure,
  '    inscricoes_equipantes  = false,',
  '    inscricoes_equipantes  = false,' || chr(10) ||
  '    permite_igreja_outra   = false,' || chr(10) ||
  '    permite_igreja_diversos = false,'
);

revoke all on function public.vincular_outra_igreja(text, text)   from public, anon;
revoke all on function public.criar_igreja_parceira(text, text)   from public, anon;
grant execute on function public.vincular_outra_igreja(text, text) to authenticated;
grant execute on function public.criar_igreja_parceira(text, text) to authenticated;
