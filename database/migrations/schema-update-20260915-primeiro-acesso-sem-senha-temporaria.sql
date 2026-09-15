-- ---------------------------------------------------------------------------
-- Primeiro acesso do parceiro sem senha temporaria
--
-- POR QUE
-- -------
-- No desenho original (ver schema-update-20260912p-primeiro-acesso-
-- parceiros.sql), o primeiro acesso gerava uma senha temporaria pela formula
-- ("<codigo><sufixo>"), mostrava na tela para o parceiro copiar, e so depois
-- ele trocava por uma senha propria. A ideia do Patrick era dar um jeito de a
-- pessoa continuar caso fechasse a tela antes de terminar -- mas o preco foi
-- alto: a conta so aceitava UM primeiro acesso (o INSERT em
-- primeiro_acesso_parceiros e UNIQUE por codigo, e bloqueava tentativas
-- seguintes), entao se a pessoa fechasse a tela sem copiar a senha, ficava
-- travada -- exatamente o problema que a senha temporaria tentava evitar.
--
-- Pedido da usuaria em 2026-09-15: tirar a etapa da senha temporaria. Agora
-- o primeiro acesso so confirma quem e a pessoa e por qual igreja ela
-- responde, e leva direto para a tela de criar a senha final -- sem mostrar
-- nem gravar senha nenhuma nesse passo. Se a pessoa fechar a tela antes de
-- terminar, ela so clica em "Primeiro acesso" de novo: como a conta ainda
-- nao tem senha_definida = true, o fluxo recomeca sem problema.
--
-- O QUE MUDA
-- ----------
-- 1. primeiro_acesso_parceiro(codigo, responsavel) para de gerar/gravar
--    senha. So confirma a identificacao, registra/atualiza quem se
--    apresentou (agora um UPSERT, nao um INSERT que falha na segunda vez) e
--    devolve { ok, codigo, igreja } -- sem "senha".
-- 2. Nova funcao definir_senha_primeiro_acesso(codigo, senha_nova): grava a
--    senha ESCOLHIDA pela pessoa, sem exigir senha atual como prova -- nao
--    ha mais "senha atual" nesse fluxo. A prova de identidade e a mesma que
--    ja valia no passo anterior: a igreja precisa estar com
--    acesso_liberado = true e ainda sem senha_definida.
-- 3. O bloqueio de "uma vez so" continua existindo, mas agora e so depois
--    que senha_definida vira true -- antes disso, repetir o primeiro acesso
--    e permitido e esperado.
--
-- O QUE NAO MUDA
-- --------------
-- A formula de senha (_senha_primeiro_acesso, config_senhas) continua
-- existindo -- ela ainda e usada pela tela do organizador (Senhas dos
-- Parceiros, botao "Liberar"), que segue mandando a senha-formula por
-- WhatsApp para quem a organizacao libera na mao, fora do fluxo de
-- autoatendimento. E um caminho DIFERENTE do primeiro acesso self-service e
-- nao foi tocado aqui. A tabela primeiro_acesso_parceiros tambem continua --
-- ela vira so um registro de quem se apresentou (usado na tela Senhas dos
-- Parceiros), sem mais travar tentativa nenhuma.
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
begin
  if not public.primeiro_acesso_habilitado() then
    return jsonb_build_object('ok', false, 'erro',
      'O primeiro acesso está fechado no momento. Fale com a organização.');
  end if;

  -- Nome e sobrenome: quem se apresenta so pelo apelido nao serve de
  -- registro para ninguem conferir depois.
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

  -- So bloqueia depois que a senha final ja foi criada. Antes disso, refazer
  -- o primeiro acesso e o caminho normal pra quem fechou a tela no meio.
  if v_linha.senha_definida then
    return jsonb_build_object('ok', false, 'erro',
      'Esta igreja já fez o primeiro acesso. Se você não sabe a senha, use "Esqueci minha senha".');
  end if;

  insert into public.primeiro_acesso_parceiros (codigo, igreja_nome, responsavel_nome, origem)
  values (
    v_linha.codigo,
    v_linha.nome,
    v_nome,
    left(coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for',
      ''), 120)
  )
  on conflict (codigo) do update
    set responsavel_nome = excluded.responsavel_nome,
        igreja_nome      = excluded.igreja_nome,
        criado_em        = now(),
        origem           = excluded.origem;

  update public.igrejas_parceiras
     set acesso_liberado = true
   where id = v_linha.id;

  return jsonb_build_object('ok', true, 'codigo', v_linha.codigo, 'igreja', v_linha.nome);
end;
$fn$;

revoke all on function public.primeiro_acesso_parceiro(text, text) from public;
grant execute on function public.primeiro_acesso_parceiro(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- A senha final, escolhida pela propria pessoa, sem senha atual como prova.
--
-- So tem efeito em cima de uma igreja que ja passou pelo
-- primeiro_acesso_parceiro acima (acesso_liberado = true) e que ainda nao
-- tem senha propria (senha_definida = false). Fora dessas condicoes, recusa
-- -- por isso pode ficar liberada para anon/authenticated como o resto do
-- fluxo de primeiro acesso, sem abrir brecha nova: quem ja tem senha
-- definida nao e afetado, e quem nao passou pelo primeiro acesso nem chega a
-- acesso_liberado = true.
-- ---------------------------------------------------------------------------
create or replace function public.definir_senha_primeiro_acesso(p_codigo text, p_senha_nova text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_codigo  text := trim(coalesce(p_codigo, ''));
  v_linha   public.igrejas_parceiras%rowtype;
  v_critica text;
begin
  select * into v_linha
    from public.igrejas_parceiras
   where codigo = v_codigo
   limit 1;

  if v_linha.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Igreja não encontrada.');
  end if;

  if v_linha.senha_definida then
    return jsonb_build_object('ok', false, 'erro',
      'Esta igreja já fez o primeiro acesso. Se você não sabe a senha, use "Esqueci minha senha".');
  end if;

  if not v_linha.acesso_liberado then
    return jsonb_build_object('ok', false, 'erro',
      'Faça o "Primeiro acesso" antes de criar sua senha.');
  end if;

  v_critica := public._criticar_senha(p_senha_nova, v_codigo);
  if v_critica is not null then
    return jsonb_build_object('ok', false, 'erro', v_critica);
  end if;

  update public.igrejas_parceiras
     set senha               = extensions.crypt(p_senha_nova, extensions.gen_salt('bf', 12)),
         senha_definida      = true,
         senha_atualizada_em = now()
   where id = v_linha.id;

  -- Terminou o primeiro acesso: se havia pedido de ajuda aberto, ja morreu.
  update public.solicitacoes_senha
     set atendida_em = now(), atendida_por = 'o próprio parceiro'
   where codigo = v_codigo and atendida_em is null;

  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.definir_senha_primeiro_acesso(text, text) from public;
grant execute on function public.definir_senha_primeiro_acesso(text, text) to anon, authenticated;
