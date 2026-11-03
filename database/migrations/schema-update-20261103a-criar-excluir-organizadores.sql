-- ---------------------------------------------------------------------------
-- Criar e excluir organizadores pela tela (03/11/2026)
--
-- Pedido do Patrick: uma organizadora saiu e outros vao entrar. Ate aqui a
-- lista de organizadores so mudava mexendo no banco. Decidido com ele:
--
--   - so o login de permissao maxima ("Desenvolvedores") cria e exclui,
--     como ja e para redefinir senha;
--   - excluir APAGA a conta (a pessoa nao entra mais e some da lista). O que
--     ela fez fica nos registros, que guardam o nome em texto. A unica tabela
--     ligada pelo id e avisos_ocultos, que ja apaga em cascata;
--   - a conta Desenvolvedores nao pode ser excluida (e a unica que gere as
--     outras, entao isso tambem impede excluir a si mesmo);
--   - nome repetido e recusado;
--   - conta nova = organizador com aprovacao (o mesmo papel de todos os
--     organizadores de hoje: a tabela nao tem coluna de papel e o login
--     entrega "organizador", que ja aprova). Senha temporaria, como na
--     redefinicao: a pessoa cria a dela no primeiro acesso.
--
-- ATENCAO: algumas permissoes especiais sao pelo NOME da conta (gerar escala
-- e inscricao manual: raquel, eduardo, desenvolvedores; camisas: raquel).
-- Quem for criado com um desses nomes herda a permissao.
--
-- Uma sessao ja aberta da pessoa excluida segue valendo ate o cracha vencer
-- (8 h, ver Edge Function login). Entrar de novo ja e recusado na hora.
-- ---------------------------------------------------------------------------

alter table public.organizadores_auth
  add column if not exists criado_por text;

create or replace function public.criar_organizador(p_nome text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_nome  text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_senha text;
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas o login de permissão máxima pode cadastrar organizadores.');
  end if;
  -- O nome e o usuario do login: so letras (com acento), ate duas palavras.
  -- Nada de numero ou simbolo (o login procura o nome com ilike).
  if v_nome !~ '^[A-Za-zÀ-ÖØ-öø-ÿ]{2,20}( [A-Za-zÀ-ÖØ-öø-ÿ]{2,20})?$' then
    return jsonb_build_object('ok', false, 'erro',
      'Use só o primeiro nome (ou nome e sobrenome), apenas letras. Ex.: "Carlos" ou "Carlos Souza".');
  end if;
  if exists (select 1 from public.organizadores_auth where lower(nome) = lower(v_nome)) then
    return jsonb_build_object('ok', false, 'erro',
      format('Já existe um organizador "%s". Use também o sobrenome.', v_nome));
  end if;

  v_senha := public._gerar_senha_legivel();
  insert into public.organizadores_auth (nome, senha, senha_definida, senha_atualizada_em, criado_por)
  values (v_nome, extensions.crypt(v_senha, extensions.gen_salt('bf', 12)), false, now(),
          public._nome_organizador_logado());

  return jsonb_build_object(
    'ok', true, 'nome', v_nome, 'senha', v_senha,
    'mensagem',
      'Acesso de organizador do Metanoia Radical Serra.' || chr(10) || chr(10) ||
      'Site: https://metanoiaradicalserra.com.br/login' || chr(10) ||
      'Tipo de acesso: Organizador' || chr(10) ||
      'Usuário: ' || v_nome || chr(10) ||
      'Senha: ' || v_senha || chr(10) || chr(10) ||
      'Ao entrar, o sistema vai pedir para você criar a SUA senha ' ||
      '(mínimo 8 caracteres, com letras e números).'
  );
end;
$fn$;
revoke all on function public.criar_organizador(text) from public, anon;
grant execute on function public.criar_organizador(text) to authenticated;

create or replace function public.excluir_organizador(p_nome text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_alvo public.organizadores_auth%rowtype;
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas o login de permissão máxima pode excluir organizadores.');
  end if;
  select * into v_alvo from public.organizadores_auth
   where lower(nome) = lower(btrim(coalesce(p_nome, ''))) limit 1;
  if v_alvo.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Organizador não encontrado.');
  end if;
  if v_alvo.nome ilike 'Desenvolvedores' then
    return jsonb_build_object('ok', false, 'erro',
      'A conta Desenvolvedores não pode ser excluída.');
  end if;

  delete from public.organizadores_auth where id = v_alvo.id;
  delete from public.login_tentativas where tipo = 'organizador' and identificador = lower(v_alvo.nome);

  return jsonb_build_object('ok', true, 'nome', v_alvo.nome);
end;
$fn$;
revoke all on function public.excluir_organizador(text) from public, anon;
grant execute on function public.excluir_organizador(text) to authenticated;
