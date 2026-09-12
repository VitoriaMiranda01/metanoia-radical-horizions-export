-- ---------------------------------------------------------------------------
-- Senhas dos organizadores: troca pelo proprio e redefinicao pelo "maximo"
--
-- Ate aqui os 8 organizadores tinham senha em bcrypt custo 06 (fraco; o
-- recomendado e 12) e nenhuma forma de troca-la pelo site -- so mexendo no
-- banco. Decidido com o Patrick em 12/09/2026:
--
--   - cada organizador troca a propria senha, provando quem e com a senha
--     atual;
--   - a conta "Desenvolvedores" e a de permissao maxima: gera senha nova
--     para qualquer um dos outros;
--   - quem recebe senha gerada e OBRIGADO a criar a sua no proximo acesso
--     (mesma regra das igrejas) -- a senha temporaria morre no primeiro uso;
--   - NAO existe "esqueci minha senha" para organizador: sao 8 pessoas que
--     se conhecem, e pedir ao Desenvolvedores e mais simples e mais seguro
--     que um botao automatico.
--
-- O custo 12 entra POR TROCA: toda senha gravada por estas funcoes usa
-- gen_salt('bf', 12). As antigas so sobem quando forem trocadas -- nao da
-- para re-proteger um hash sem conhecer a senha original.
--
-- O "maximo" e reconhecido pelo NOME da conta. O cracha carrega o id em
-- "sub" (ver Edge Function login), e dele se chega a linha.
-- ---------------------------------------------------------------------------

alter table public.organizadores_auth
  add column if not exists senha_definida      boolean not null default true,
  add column if not exists senha_atualizada_em timestamptz,
  add column if not exists ultimo_acesso       timestamptz;

comment on column public.organizadores_auth.senha_definida is
  'false = senha temporaria gerada pelo Desenvolvedores; o site obriga a trocar no proximo acesso.';

create or replace function public._organizador_do_cracha()
returns public.organizadores_auth
language sql stable security definer set search_path to 'public'
as $fn$
  select o.* from public.organizadores_auth o
  where public.eh_organizador()
    and o.id::text = coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')
  limit 1;
$fn$;
revoke all on function public._organizador_do_cracha() from public, anon, authenticated;

create or replace function public.eh_organizador_maximo()
returns boolean
language sql stable security definer set search_path to 'public'
as $fn$
  select coalesce((select nome from public._organizador_do_cracha()) ilike 'Desenvolvedores', false);
$fn$;
revoke all on function public.eh_organizador_maximo() from public;
grant execute on function public.eh_organizador_maximo() to anon, authenticated;

-- _criticar_senha nasceu so para as igrejas ("o codigo da sua igreja").
-- Ganha um rotulo para servir tambem aos organizadores, com o texto antigo
-- como padrao para nao mexer em quem ja chama com dois argumentos.
create or replace function public._criticar_senha(
  p_senha text, p_codigo text, p_rotulo text default 'o código da sua igreja'
)
returns text
language plpgsql immutable set search_path to 'public'
as $fn$
declare v_baixa text := lower(coalesce(p_senha, ''));
begin
  if length(coalesce(p_senha, '')) < 8 then return 'A senha precisa ter pelo menos 8 caracteres.'; end if;
  if p_senha !~ '[A-Za-zÀ-ÿ]' then return 'A senha precisa ter pelo menos uma letra.'; end if;
  if p_senha !~ '[0-9]' then return 'A senha precisa ter pelo menos um número.'; end if;
  if v_baixa like '%metanoia%' then return 'A senha não pode conter a palavra "metanoia".'; end if;
  if p_codigo is not null and v_baixa like '%' || lower(p_codigo) || '%' then
    return 'A senha não pode conter ' || p_rotulo || '.';
  end if;
  if v_baixa in ('senha123','12345678','123456789','abcd1234','senha1234',
                 'igreja123','parceiro1','password1','qwerty123','1234abcd') then
    return 'Essa senha é muito comum. Escolha outra.';
  end if;
  return null;
end;
$fn$;
revoke all on function public._criticar_senha(text, text, text) from public, anon, authenticated;

-- Troca pelo proprio organizador. A prova de identidade e a SENHA ATUAL --
-- por isso funciona antes de a sessao abrir (primeiro acesso apos redefinicao).
create or replace function public.trocar_senha_organizador(
  p_nome text, p_senha_atual text, p_senha_nova text
)
returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions'
as $fn$
declare
  v_linha public.organizadores_auth%rowtype;
  v_critica text;
begin
  select * into v_linha from public.organizadores_auth
  where nome ilike btrim(coalesce(p_nome, '')) limit 1;

  if v_linha.id is null or v_linha.senha is null
     or v_linha.senha <> extensions.crypt(coalesce(p_senha_atual, ''), v_linha.senha) then
    return jsonb_build_object('ok', false, 'erro', 'Usuário ou senha atual incorretos.');
  end if;

  -- Passa o proprio nome no lugar do "codigo": impede usar o nome como senha.
  v_critica := public._criticar_senha(p_senha_nova, v_linha.nome, 'o seu nome de usuário');
  if v_critica is not null then
    return jsonb_build_object('ok', false, 'erro', v_critica);
  end if;

  if v_linha.senha = extensions.crypt(p_senha_nova, v_linha.senha) then
    return jsonb_build_object('ok', false, 'erro', 'A senha nova precisa ser diferente da atual.');
  end if;

  update public.organizadores_auth
     set senha = extensions.crypt(p_senha_nova, extensions.gen_salt('bf', 12)),
         senha_definida = true, senha_atualizada_em = now()
   where id = v_linha.id;

  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.trocar_senha_organizador(text, text, text) from public;
grant execute on function public.trocar_senha_organizador(text, text, text) to anon, authenticated;

create or replace function public.listar_organizadores()
returns table (
  nome text, senha_definida boolean, senha_atualizada_em timestamptz,
  ultimo_acesso timestamptz, protecao_forte boolean, eh_o_maximo boolean
)
language sql security definer stable set search_path to 'public'
as $fn$
  select o.nome, o.senha_definida, o.senha_atualizada_em, o.ultimo_acesso,
         substring(o.senha from 1 for 7) = '$2a$12$',
         o.nome ilike 'Desenvolvedores'
    from public.organizadores_auth o
   where public.eh_organizador_maximo()
   order by (o.nome ilike 'Desenvolvedores') desc, o.nome;
$fn$;
revoke all on function public.listar_organizadores() from public;
grant execute on function public.listar_organizadores() to anon, authenticated;

create or replace function public.redefinir_senha_organizador(p_nome text)
returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions'
as $fn$
declare
  v_senha text;
  v_alvo public.organizadores_auth%rowtype;
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas o login de permissão máxima pode redefinir a senha de outro organizador.');
  end if;

  select * into v_alvo from public.organizadores_auth
  where nome ilike btrim(coalesce(p_nome, '')) limit 1;

  if v_alvo.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Organizador não encontrado.');
  end if;

  -- O "maximo" nao redefine a propria senha por aqui: se pudesse, quem
  -- pegasse a sessao dele aberta trocaria a senha sem saber a atual.
  if v_alvo.nome ilike 'Desenvolvedores' then
    return jsonb_build_object('ok', false, 'erro',
      'Para trocar a senha desta conta, use "Trocar minha senha" (pede a senha atual).');
  end if;

  v_senha := public._gerar_senha_legivel();

  update public.organizadores_auth
     set senha = extensions.crypt(v_senha, extensions.gen_salt('bf', 12)),
         senha_definida = false,   -- temporaria: trocada no proximo acesso
         senha_atualizada_em = now()
   where id = v_alvo.id;

  return jsonb_build_object(
    'ok', true, 'nome', v_alvo.nome, 'senha', v_senha,
    'mensagem',
      'Acesso de organizador do Metanoia Radical Serra.' || chr(10) || chr(10) ||
      'Site: https://metanoiaradicalserra.com.br/login' || chr(10) ||
      'Tipo de acesso: Organizador' || chr(10) ||
      'Usuário: ' || v_alvo.nome || chr(10) ||
      'Senha: ' || v_senha || chr(10) || chr(10) ||
      'Ao entrar, o sistema vai pedir para você criar a SUA senha ' ||
      '(mínimo 8 caracteres, com letras e números).'
  );
end;
$fn$;
revoke all on function public.redefinir_senha_organizador(text) from public;
grant execute on function public.redefinir_senha_organizador(text) to anon, authenticated;
