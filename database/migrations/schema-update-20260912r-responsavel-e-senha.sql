-- ---------------------------------------------------------------------------
-- Tres ajustes pedidos pelo Patrick depois de testar o primeiro acesso
-- (12/09/2026):
--
-- 1. A senha PODE conter "metanoia". A regra existia por herança da senha
--    antiga, que era publica; hoje a senha e escolhida pela pessoa e essa
--    proibicao so atrapalha (a palavra e a primeira que vem a cabeca de quem
--    trabalha no projeto). As outras regras continuam.
--
-- 2. O nome de quem fez o primeiro acesso passa a morar TAMBEM em
--    igrejas_parceiras.responsavel_nome. A tabela primeiro_acesso_parceiros
--    continua sendo o registro de auditoria (com horario e origem); a coluna
--    aqui existe porque e a linha da igreja que o login devolve ao site --
--    e o cabecalho precisa dizer "Olá, Fulano" em vez de "Olá, METODISTA".
--
-- 3. reabrir_primeiro_acesso limpa esse nome junto com o resto.
-- ---------------------------------------------------------------------------

alter table public.igrejas_parceiras
  add column if not exists responsavel_nome text;

comment on column public.igrejas_parceiras.responsavel_nome is
  'Nome informado por quem fez o primeiro acesso desta igreja. Vai para o navegador junto com a linha da igreja (login), para o site saudar a pessoa pelo nome.';

-- Copia o que ja foi registrado, para nao perder quem entrou antes deste ajuste.
update public.igrejas_parceiras i
   set responsavel_nome = p.responsavel_nome
  from public.primeiro_acesso_parceiros p
 where p.codigo = i.codigo
   and i.responsavel_nome is null;

-- ---------------------------------------------------------------------------
-- 1. Sem a regra do "metanoia"
-- ---------------------------------------------------------------------------
create or replace function public._criticar_senha(
  p_senha text,
  p_codigo text,
  p_rotulo text default 'o código da sua igreja'
)
returns text
language plpgsql
immutable
set search_path to 'public'
as $fn$
declare
  v_baixa text := lower(coalesce(p_senha, ''));
begin
  if length(coalesce(p_senha, '')) < 8 then
    return 'A senha precisa ter pelo menos 8 caracteres.';
  end if;
  if p_senha !~ '[A-Za-zÀ-ÿ]' then
    return 'A senha precisa ter pelo menos uma letra.';
  end if;
  if p_senha !~ '[0-9]' then
    return 'A senha precisa ter pelo menos um número.';
  end if;
  -- A senha nao pode ser o proprio codigo/nome de usuario disfarçado: isso
  -- continua, porque e o que a pessoa acabou de receber por escrito.
  if p_codigo is not null and v_baixa like '%' || lower(p_codigo) || '%' then
    return 'A senha não pode conter ' || p_rotulo || '.';
  end if;
  if v_baixa in (
    'senha123', '12345678', '123456789', 'abcd1234', 'senha1234',
    'igreja123', 'parceiro1', 'password1', 'qwerty123', '1234abcd'
  ) then
    return 'Essa senha é muito comum. Escolha outra.';
  end if;
  return null;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. O primeiro acesso grava o nome na linha da igreja
-- ---------------------------------------------------------------------------
create or replace function public.primeiro_acesso_parceiro(p_codigo text, p_responsavel text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_codigo text := trim(coalesce(p_codigo, ''));
  v_nome   text := regexp_replace(trim(coalesce(p_responsavel, '')), '\s+', ' ', 'g');
  v_linha  public.igrejas_parceiras%rowtype;
  v_senha  text;
begin
  if not public.primeiro_acesso_habilitado() then
    return jsonb_build_object('ok', false, 'erro',
      'O primeiro acesso está fechado no momento. Fale com a organização.');
  end if;

  if length(v_nome) < 5 or position(' ' in v_nome) = 0 then
    return jsonb_build_object('ok', false, 'erro',
      'Escreva seu nome completo (nome e sobrenome).');
  end if;

  select * into v_linha
    from public.igrejas_parceiras
   where codigo = v_codigo
   limit 1;

  if v_linha.id is null then
    return jsonb_build_object('ok', false, 'erro',
      'Igreja não encontrada. Escolha a sua na lista.');
  end if;

  if v_linha.senha_definida
     or exists (select 1 from public.primeiro_acesso_parceiros where codigo = v_codigo)
  then
    return jsonb_build_object('ok', false, 'erro',
      'Esta igreja já fez o primeiro acesso. Se você não sabe a senha, use "Esqueci minha senha".');
  end if;

  v_senha := public._senha_primeiro_acesso(v_linha.codigo);

  insert into public.primeiro_acesso_parceiros (codigo, igreja_nome, responsavel_nome, origem)
  values (
    v_linha.codigo,
    v_linha.nome,
    v_nome,
    left(coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for',
      ''), 120)
  );

  update public.igrejas_parceiras
     set senha               = extensions.crypt(v_senha, extensions.gen_salt('bf', 12)),
         senha_definida      = false,
         acesso_liberado     = true,
         responsavel_nome    = v_nome,
         senha_atualizada_em = now()
   where id = v_linha.id;

  return jsonb_build_object(
    'ok', true,
    'codigo', v_linha.codigo,
    'igreja', v_linha.nome,
    'senha', v_senha
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'erro',
      'Esta igreja já fez o primeiro acesso. Se você não sabe a senha, use "Esqueci minha senha".');
end;
$fn$;

revoke all on function public.primeiro_acesso_parceiro(text, text) from public;
grant execute on function public.primeiro_acesso_parceiro(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Zerar a igreja limpa o nome junto
-- ---------------------------------------------------------------------------
create or replace function public.reabrir_primeiro_acesso(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_codigo text := trim(coalesce(p_codigo, ''));
  v_id     uuid;
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas o login de permissão máxima pode fazer isso.');
  end if;

  select id into v_id from public.igrejas_parceiras where codigo = v_codigo limit 1;
  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Igreja não encontrada.');
  end if;

  delete from public.primeiro_acesso_parceiros where codigo = v_codigo;

  update public.igrejas_parceiras
     set senha               = extensions.crypt(public._senha_primeiro_acesso(v_codigo),
                                                extensions.gen_salt('bf', 12)),
         senha_definida      = false,
         acesso_liberado     = false,
         responsavel_nome    = null,
         senha_atualizada_em = now(),
         ultimo_acesso       = null
   where id = v_id;

  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.reabrir_primeiro_acesso(text) from public;
revoke all on function public.reabrir_primeiro_acesso(text) from anon;
grant execute on function public.reabrir_primeiro_acesso(text) to authenticated;
