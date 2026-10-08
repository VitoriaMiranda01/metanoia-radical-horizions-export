-- ---------------------------------------------------------------------------
-- Editar e cadastrar igrejas pela tela (Patrick, 08/10/2026)
--
-- Em Configuracoes > "Todas as igrejas cadastradas":
--   * Editar: codigo, nome e pastor de cada igreja. O codigo novo nao pode ser
--     de outra igreja (nem a 146, vaga de proposito). Trocar o codigo ou o
--     nome atualiza o "NNN - NOME" em todo lugar que guarda o texto (fichas,
--     decisoes, lotes de aprovacao, limite por igreja) e a conta do parceiro.
--   * Adicionar nova igreja: codigo (vem o proximo livre), nome, limite de
--     inscricoes (vai para "Limite de inscricoes por igreja") e pastor -- os
--     quatro obrigatorios.
--
-- A lista dos formularios passa a vir do banco (opcoes_de_igreja -> lista):
-- a constante do site vira so a reserva para quando o banco nao responde.
-- Hoje os dois bancos estao identicos a constante (conferido em 08/10/2026),
-- entao nada muda para quem se inscreve.
--
--  1. igrejas_parceiras.pastor (para a automacao futura) e na_lista (a 999 de
--     teste e a 146 vaga ficam fora da lista dos formularios).
--  2. opcoes_de_igreja(): + 'lista' (todas as igrejas, "NNN - NOME", na ordem
--     do codigo). 'novas' continua, para o site antigo durante a publicacao.
--  3. igrejas_cadastro(): codigo, nome, pastor e limite de cada igreja e o
--     proximo codigo (so organizador).
--  4. editar_igreja(codigo, codigo_novo, nome, pastor).
--  5. cadastrar_igreja(codigo, nome, pastor, limite).
--
-- A 84 - DIVERSOS e usada pelo servidor (_dados_inscricao_validos) pelo
-- texto: o pastor pode mudar, o codigo e o nome nao.
--
-- Parceiro logado quando o codigo da igreja dele muda continua com o codigo
-- antigo na sessao: precisa sair e entrar de novo com o codigo novo. Se a
-- igreja ainda nao criou a propria senha, a senha de primeiro acesso passa a
-- ser a do codigo novo (a formula e pelo codigo).
-- ---------------------------------------------------------------------------

-- 1. Colunas -------------------------------------------------------------------
alter table public.igrejas_parceiras add column if not exists pastor   text;
alter table public.igrejas_parceiras add column if not exists na_lista boolean not null default true;

update public.igrejas_parceiras set na_lista = false
 where na_lista
   and (codigo !~ '^\d+$' or codigo::int >= 900 or (codigo = '146' and nome = 'Igreja 146'));

-- Normaliza o codigo digitado: so digitos, 1 a 899; abaixo de 10 com zero na
-- frente ("01"), como as igrejas da lista original.
create or replace function public._codigo_igreja(p_codigo text)
returns text
language sql
immutable
set search_path to 'public'
as $fn$
  select case
    when btrim(coalesce(p_codigo, '')) !~ '^\d{1,3}$' then null
    when btrim(p_codigo)::int < 1 or btrim(p_codigo)::int > 899 then null
    when btrim(p_codigo)::int < 10 then '0' || (btrim(p_codigo)::int)::text
    else (btrim(p_codigo)::int)::text
  end;
$fn$;
revoke all on function public._codigo_igreja(text) from public, anon, authenticated;

-- Nome de igreja: maiusculas, espacos simples, 3 a 80 caracteres, so letras,
-- numeros e pontuacao simples. Devolve o erro (ou null se estiver ok).
create or replace function public._erro_nome_igreja(p_nome text)
returns text
language sql
immutable
set search_path to 'public'
as $fn$
  select case
    when length(p_nome) < 3 or length(p_nome) > 80 then 'Escreva o nome da igreja (de 3 a 80 caracteres).'
    when p_nome ~ '[^[:alnum:][:space:].,''’°ºª()|&/–-]' then 'O nome tem algum símbolo que não pode: use letras, números e pontuação simples.'
    else null
  end;
$fn$;
revoke all on function public._erro_nome_igreja(text) from public, anon, authenticated;

-- 2. Lista dos formularios -------------------------------------------------------
create or replace function public.opcoes_de_igreja()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select jsonb_build_object(
    'lista', coalesce((select jsonb_agg(i.codigo || ' - ' || i.nome order by i.codigo::int)
                         from public.igrejas_parceiras i
                        where i.na_lista and i.codigo ~ '^\d+$'), '[]'::jsonb),
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

-- 3. Dados do quadro (organizador) ------------------------------------------------
create or replace function public.igrejas_cadastro()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'igrejas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'codigo', i.codigo, 'nome', i.nome, 'pastor', i.pastor,
               'limite', l.limite_maximo,
               'fixa', i.codigo = '84')
             order by i.codigo::int)
        from public.igrejas_parceiras i
        left join public.limites_igrejas l on l.igreja = i.codigo || ' - ' || i.nome
       where i.na_lista and i.codigo ~ '^\d+$'), '[]'::jsonb),
    'proximo_codigo', (select (coalesce(max(i.codigo::int), 0) + 1)::text
                         from public.igrejas_parceiras i
                        where i.codigo ~ '^\d+$' and i.codigo::int < 900));
end;
$fn$;

revoke all on function public.igrejas_cadastro() from public, anon;
grant execute on function public.igrejas_cadastro() to authenticated;

-- 4. Editar ----------------------------------------------------------------------
create or replace function public.editar_igreja(p_codigo text, p_codigo_novo text, p_nome text, p_pastor text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_ig        public.igrejas_parceiras%rowtype;
  v_cod       text := public._codigo_igreja(p_codigo_novo);
  v_nome      text := upper(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')));
  v_pastor    text := nullif(btrim(regexp_replace(coalesce(p_pastor, ''), '\s+', ' ', 'g')), '');
  v_antes     text;
  v_depois    text;
  v_erro      text;
  v_outra     text;
  v_fichas    int := 0;
  v_n         int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores podem editar igrejas.');
  end if;

  perform pg_advisory_xact_lock(hashtext('criar_igreja_parceira'));

  select * into v_ig from public.igrejas_parceiras
   where codigo = btrim(coalesce(p_codigo, '')) and na_lista;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Igreja não encontrada. Atualize a lista e tente de novo.');
  end if;

  if v_cod is null then
    return jsonb_build_object('ok', false, 'erro', 'O código precisa ser um número de 1 a 899.');
  end if;
  if v_pastor is not null and (length(v_pastor) < 3 or length(v_pastor) > 80) then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o nome do pastor (de 3 a 80 caracteres) ou deixe em branco.');
  end if;

  v_antes  := v_ig.codigo || ' - ' || v_ig.nome;
  v_depois := v_cod || ' - ' || v_nome;

  if v_depois <> v_antes then
    if v_ig.codigo = '84' then
      return jsonb_build_object('ok', false, 'erro',
        'A 84 - DIVERSOS é usada pelo sistema: o código e o nome dela não podem mudar (o pastor pode).');
    end if;

    if v_nome <> v_ig.nome then
      v_erro := public._erro_nome_igreja(v_nome);
      if v_erro is not null then
        return jsonb_build_object('ok', false, 'erro', v_erro);
      end if;
      select i.codigo into v_outra from public.igrejas_parceiras i
       where i.id <> v_ig.id
         and upper(public.unaccent_simples(i.nome)) = upper(public.unaccent_simples(v_nome))
       limit 1;
      if v_outra is not null then
        return jsonb_build_object('ok', false, 'erro', format('Já existe uma igreja com este nome (código %s).', v_outra));
      end if;
    end if;

    if v_cod <> v_ig.codigo then
      select i.codigo || ' - ' || i.nome into v_outra from public.igrejas_parceiras i
       where i.id <> v_ig.id and i.codigo ~ '^\d+$' and i.codigo::int = v_cod::int
       limit 1;
      if v_outra is not null then
        return jsonb_build_object('ok', false, 'erro', format('O código %s já é de outra igreja (%s).', v_cod, v_outra));
      end if;
    end if;

    -- O texto "NNN - NOME" em todo lugar que o guarda.
    update public.equipantes set igreja = v_depois where igreja = v_antes;
    get diagnostics v_n = row_count; v_fichas := v_fichas + v_n;
    update public.equipantes set decidido_por_igreja = v_depois where decidido_por_igreja = v_antes;
    update public.acampantes set admin_responsavel = v_depois where admin_responsavel = v_antes;
    get diagnostics v_n = row_count; v_fichas := v_fichas + v_n;
    update public.acampantes set igreja = v_depois where igreja = v_antes;
    update public.lotes_aprovacao_itens set igreja = v_depois where igreja = v_antes;
    update public.limites_igrejas set igreja = v_depois, updated_at = now() where igreja = v_antes;

    if v_cod <> v_ig.codigo then
      update public.primeiro_acesso_parceiros set codigo = v_cod where codigo = v_ig.codigo;
      update public.solicitacoes_senha set codigo = v_cod where codigo = v_ig.codigo;
    end if;
    update public.primeiro_acesso_parceiros set igreja_nome = v_nome where codigo = v_cod;
  end if;

  update public.igrejas_parceiras set
    codigo = v_cod,
    nome   = v_nome,
    pastor = v_pastor,
    -- Sem senha propria, a senha de primeiro acesso e a formula do codigo.
    senha  = case when v_cod <> v_ig.codigo and not v_ig.senha_definida
                  then extensions.crypt(public._senha_primeiro_acesso(v_cod), extensions.gen_salt('bf', 12))
                  else senha end
   where id = v_ig.id;

  return jsonb_build_object('ok', true, 'igreja', v_depois, 'antes', v_antes,
                            'codigo_mudou', v_cod <> v_ig.codigo, 'fichas', v_fichas);
end;
$fn$;

revoke all on function public.editar_igreja(text, text, text, text) from public, anon;
grant execute on function public.editar_igreja(text, text, text, text) to authenticated;

-- 5. Cadastrar ---------------------------------------------------------------------
create or replace function public.cadastrar_igreja(p_codigo text, p_nome text, p_pastor text, p_limite int)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_cod    text := public._codigo_igreja(p_codigo);
  v_nome   text := upper(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')));
  v_pastor text := btrim(regexp_replace(coalesce(p_pastor, ''), '\s+', ' ', 'g'));
  v_erro   text;
  v_outra  text;
  v_full   text;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores podem cadastrar igrejas.');
  end if;

  perform pg_advisory_xact_lock(hashtext('criar_igreja_parceira'));

  if v_cod is null then
    return jsonb_build_object('ok', false, 'erro', 'O código precisa ser um número de 1 a 899.');
  end if;
  v_erro := public._erro_nome_igreja(v_nome);
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;
  if length(v_pastor) < 3 or length(v_pastor) > 80 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o nome do pastor (de 3 a 80 caracteres).');
  end if;
  if p_limite is null or p_limite < 1 or p_limite > 1000 then
    return jsonb_build_object('ok', false, 'erro', 'Informe o limite de inscrições (de 1 a 1000).');
  end if;

  select i.codigo || ' - ' || i.nome into v_outra from public.igrejas_parceiras i
   where i.codigo ~ '^\d+$' and i.codigo::int = v_cod::int
   limit 1;
  if v_outra is not null then
    return jsonb_build_object('ok', false, 'erro', format('O código %s já é de outra igreja (%s).', v_cod, v_outra));
  end if;
  select i.codigo into v_outra from public.igrejas_parceiras i
   where upper(public.unaccent_simples(i.nome)) = upper(public.unaccent_simples(v_nome))
   limit 1;
  if v_outra is not null then
    return jsonb_build_object('ok', false, 'erro', format('Já existe uma igreja com este nome (código %s).', v_outra));
  end if;

  v_full := v_cod || ' - ' || v_nome;

  -- Conta de parceiro igual as outras: senha de primeiro acesso pela formula
  -- e acesso trancado ate a organizacao liberar em Senhas dos Parceiros.
  insert into public.igrejas_parceiras (codigo, nome, pastor, senha, acesso_liberado, senha_definida, criada_pela_tela, criada_por)
  values (v_cod, v_nome, v_pastor,
          extensions.crypt(public._senha_primeiro_acesso(v_cod), extensions.gen_salt('bf', 12)),
          false, false, true, coalesce(public._nome_organizador_logado(), 'organizador'));

  insert into public.limites_igrejas (igreja, limite_maximo) values (v_full, p_limite)
  on conflict (igreja) do update set limite_maximo = excluded.limite_maximo, updated_at = now();

  return jsonb_build_object('ok', true, 'codigo', v_cod, 'nome', v_nome, 'igreja', v_full, 'limite', p_limite);
end;
$fn$;

revoke all on function public.cadastrar_igreja(text, text, text, int) from public, anon;
grant execute on function public.cadastrar_igreja(text, text, text, int) to authenticated;
