-- ---------------------------------------------------------------------------
-- Primeiro acesso dos parceiros: a propria igreja se apresenta e recebe o
-- acesso, em vez de um organizador liberar uma a uma.
--
-- POR QUE
-- -------
-- Ate aqui o caminho era: o organizador abria a tela de senhas, liberava a
-- igreja, copiava a mensagem pronta e mandava no WhatsApp -- 145 vezes. O
-- Patrick pediu (12/09/2026) para inverter: um botao "Primeiro acesso" na
-- tela de login do parceiro, onde a pessoa informa o nome dela e a igreja
-- pela qual responde, e recebe ali mesmo o codigo e a senha, ja seguindo
-- direto para criar a senha propria.
--
-- O QUE PROTEGE ISSO
-- ------------------
-- 1. Um interruptor (configuracoes.primeiro_acesso_parceiros), desligado por
--    padrao e ligado so pelo login de permissao maxima (Desenvolvedores).
--    Fora da janela de cadastramento dos parceiros, a porta nem existe.
-- 2. UMA VEZ POR IGREJA. Feito o primeiro acesso, a igreja sai do alcance
--    dessa tela para sempre -- quem chegar depois cai em "Esqueci minha
--    senha", que avisa a organizacao em vez de dar acesso.
-- 3. Fica registrado quem pediu: nome informado, igreja, horario e o
--    x-forwarded-for da chamada (tabela primeiro_acesso_parceiros). O
--    organizador ve isso na tela de senhas, ao lado da igreja.
--
-- O QUE ISSO NAO PROTEGE (registrado de proposito, decisao do Patrick)
-- --------------------------------------------------------------------
-- Nada impede alguem de se apresentar como responsavel por uma igreja que
-- nao e a dele -- a checagem e humana, feita depois, olhando o registro.
-- E como a senha entregue continua sendo a FORMULA de primeiro acesso
-- ("<codigo><sufixo>"), quem fizer um primeiro acesso descobre o sufixo e
-- passa a saber a senha inicial de qualquer outra igreja. Isso so tem valor
-- contra igrejas que ainda nao fizeram o primeiro acesso E que um
-- organizador tenha liberado na mao -- nas outras a senha ja e a da propria
-- igreja. Trocar a formula por uma senha sorteada aqui dentro elimina esse
-- resto de risco sem mudar mais nada; ficou como escolha do Patrick.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. O interruptor
-- ---------------------------------------------------------------------------
alter table public.configuracoes
  add column if not exists primeiro_acesso_parceiros boolean not null default false;

comment on column public.configuracoes.primeiro_acesso_parceiros is
  'Mostra (e faz funcionar) o botao "Primeiro acesso" na tela de login do parceiro. Ligado/desligado so pelo login de permissao maxima.';

-- ---------------------------------------------------------------------------
-- 2. O registro de quem se apresentou
--
-- codigo e UNIQUE: essa unicidade e a trava de "uma vez por igreja". Mesmo
-- que duas pessoas apertem o botao no mesmo instante, o banco deixa passar
-- so uma.
-- ---------------------------------------------------------------------------
create table if not exists public.primeiro_acesso_parceiros (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique,
  igreja_nome      text not null,
  responsavel_nome text not null,
  criado_em        timestamptz not null default now(),
  origem           text
);

alter table public.primeiro_acesso_parceiros enable row level security;

-- Sem policy nenhuma: ninguem le nem escreve direto. So as funcoes
-- SECURITY DEFINER abaixo tocam nessa tabela. (Revogar do PUBLIC nao basta:
-- o Supabase concede privilegios a anon e authenticated por padrao, entao os
-- dois precisam ser nomeados.)
revoke all on public.primeiro_acesso_parceiros from public;
revoke all on public.primeiro_acesso_parceiros from anon;
revoke all on public.primeiro_acesso_parceiros from authenticated;

-- ---------------------------------------------------------------------------
-- 3. A tela de login precisa saber se mostra o botao
-- ---------------------------------------------------------------------------
create or replace function public.primeiro_acesso_habilitado()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select coalesce(
    (select c.primeiro_acesso_parceiros
       from public.configuracoes c
      order by c.edicao_numero desc nulls last
      limit 1),
    false);
$fn$;

revoke all on function public.primeiro_acesso_habilitado() from public;
grant execute on function public.primeiro_acesso_habilitado() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. O primeiro acesso em si
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

  -- Uma vez por igreja. senha_definida diz "ja tem dono"; a tabela de
  -- registro cobre o caso de alguem ter feito o primeiro acesso e nao ter
  -- terminado de criar a senha.
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
         senha_definida      = false,   -- obriga a criar a senha propria
         acesso_liberado     = true,
         senha_atualizada_em = now()
   where id = v_linha.id;

  return jsonb_build_object(
    'ok', true,
    'codigo', v_linha.codigo,
    'igreja', v_linha.nome,
    'senha', v_senha
  );
exception
  -- Dois cliques ao mesmo tempo: o UNIQUE do codigo decide, o segundo recebe
  -- a mesma resposta de "ja fez".
  when unique_violation then
    return jsonb_build_object('ok', false, 'erro',
      'Esta igreja já fez o primeiro acesso. Se você não sabe a senha, use "Esqueci minha senha".');
end;
$fn$;

revoke all on function public.primeiro_acesso_parceiro(text, text) from public;
grant execute on function public.primeiro_acesso_parceiro(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Ligar e desligar -- so o login de permissao maxima
-- ---------------------------------------------------------------------------
create or replace function public.definir_primeiro_acesso_parceiros(p_ativo boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_id uuid;
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas o login de permissão máxima pode mexer nisso.');
  end if;

  select c.id into v_id
    from public.configuracoes c
   order by c.edicao_numero desc nulls last
   limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Configuração do evento não encontrada.');
  end if;

  -- O "where id = v_id" nao e enfeite: a extensao safeupdate esta carregada
  -- no papel authenticator e recusa UPDATE sem WHERE (erro 21000). Sem ele
  -- isto passa nos testes por SQL e quebra pelo site.
  update public.configuracoes
     set primeiro_acesso_parceiros = coalesce(p_ativo, false)
   where id = v_id;

  return jsonb_build_object('ok', true, 'ativo', coalesce(p_ativo, false));
end;
$fn$;

revoke all on function public.definir_primeiro_acesso_parceiros(boolean) from public;
revoke all on function public.definir_primeiro_acesso_parceiros(boolean) from anon;
grant execute on function public.definir_primeiro_acesso_parceiros(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Reabrir o primeiro acesso de uma igreja -- so o login de permissao maxima
--
-- Serve para duas coisas: testar o fluxo quantas vezes for preciso, e
-- consertar o caso real de alguem ter feito o primeiro acesso pela igreja
-- errada. Devolve a conta ao estado de fabrica: senha volta a ser a formula,
-- acesso volta a NAO liberado, registro apagado.
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
         senha_atualizada_em = now(),
         ultimo_acesso       = null
   where id = v_id;

  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.reabrir_primeiro_acesso(text) from public;
revoke all on function public.reabrir_primeiro_acesso(text) from anon;
grant execute on function public.reabrir_primeiro_acesso(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. A tela de senhas passa a mostrar quem se apresentou por cada igreja
-- ---------------------------------------------------------------------------
drop function if exists public.listar_contas_parceiros();

create or replace function public.listar_contas_parceiros()
returns table (
  codigo text,
  nome text,
  acesso_liberado boolean,
  senha_definida boolean,
  ultimo_acesso timestamptz,
  senha_atualizada_em timestamptz,
  pedido_aberto_em timestamptz,
  responsavel_nome text,
  primeiro_acesso_em timestamptz,
  mensagem_pronta text
)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select i.codigo,
         i.nome,
         i.acesso_liberado,
         i.senha_definida,
         i.ultimo_acesso,
         i.senha_atualizada_em,
         s.criado_em,
         p.responsavel_nome,
         p.criado_em,
         case when i.senha_definida then null else
           'Olá! Segue o acesso da ' || i.nome ||
           ' ao sistema do Metanoia Radical Serra.' || chr(10) || chr(10) ||
           'Site: https://metanoiaradicalserra.com.br/login' || chr(10) ||
           'Tipo de acesso: Parceiro' || chr(10) ||
           'Código: ' || i.codigo || chr(10) ||
           'Senha: ' || public._senha_primeiro_acesso(i.codigo) || chr(10) || chr(10) ||
           'No primeiro acesso o sistema vai pedir para você criar a SUA senha ' ||
           '(mínimo 8 caracteres, com letras e números). Guarde-a: ela passa a ser ' ||
           'a única que funciona.'
         end
    from public.igrejas_parceiras i
    left join public.solicitacoes_senha s
           on s.codigo = i.codigo and s.atendida_em is null
    left join public.primeiro_acesso_parceiros p
           on p.codigo = i.codigo
   where public.eh_organizador()
   order by lpad(i.codigo, 4, '0');
$fn$;

revoke all on function public.listar_contas_parceiros() from public;
revoke all on function public.listar_contas_parceiros() from anon;
grant execute on function public.listar_contas_parceiros() to authenticated;

commit;
