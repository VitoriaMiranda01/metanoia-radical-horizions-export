-- ---------------------------------------------------------------------------
-- Acesso "Apoio" -- lider da saude (Patrick, 09/10/2026)
--
-- Terceiro tipo de login, ao lado de Organizador e Parceiro. Primeira conta:
-- a Vera, lider da saude, que entra com o primeiro nome e ve UMA tela: os
-- acampantes com problemas de saude, medicamentos, restricao alimentar e
-- contato de emergencia (filtrar, agrupar e exportar para Excel).
--
--  * Contas em tabela propria (apoio_auth), separada de organizadores_auth:
--    o cracha sai com user_role = 'apoio' e a area ('saude'). Nenhuma
--    politica de acesso (RLS) aceita 'apoio', entao ela NAO le nenhuma tabela
--    direto -- so o que a funcao saude_acampantes() entrega.
--  * Senha igual aos outros logins: hash bcrypt, senha temporaria obriga a
--    criar a propria no primeiro acesso (senha_definida = false), 10 senhas
--    erradas bloqueiam por 10 minutos (login_tentativas, tipo 'apoio').
--  * So a conta Desenvolvedores lista as contas de apoio e gera senha nova.
--  * A senha inicial NAO esta neste arquivo: a conta nasce sem senha (nao
--    entra) e a senha temporaria e gravada a parte, direto no banco.
-- ---------------------------------------------------------------------------

create table if not exists public.apoio_auth (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  area                text not null default 'saude' check (area in ('saude')),
  senha               text,
  senha_definida      boolean not null default false,
  senha_atualizada_em timestamptz,
  ultimo_acesso       timestamptz,
  criado_em           timestamptz not null default now()
);

create unique index if not exists apoio_auth_nome_unico on public.apoio_auth (lower(nome));

alter table public.apoio_auth enable row level security;
revoke all on table public.apoio_auth from anon, authenticated;

-- Bloqueio por senha errada vale tambem para o login de apoio.
alter table public.login_tentativas drop constraint if exists login_tentativas_tipo_check;
alter table public.login_tentativas add constraint login_tentativas_tipo_check
  check (tipo in ('organizador', 'igreja', 'apoio'));

insert into public.apoio_auth (nome, area)
select 'Vera', 'saude'
 where not exists (select 1 from public.apoio_auth where lower(nome) = 'vera');

-- Quem esta logado como apoio de uma area ---------------------------------------
create or replace function public.eh_apoio(p_area text)
returns boolean
language sql
stable
set search_path to 'public'
as $fn$
  select public.jwt_papel() = 'apoio'
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'apoio_area', '') = p_area;
$fn$;

-- A tela da saude ------------------------------------------------------------------
-- Organizador tambem pode chamar (para conferir o que a lider ve).
create or replace function public.saude_acampantes()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not (public.eh_apoio('saude') or public.eh_organizador()) then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;

  return jsonb_build_object('ok', true, 'acampantes', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id,
             'nome', a.nome,
             'idade', public.idade(a),
             'data_nascimento', a.data_nascimento,
             'sexo', a.sexo,
             'igreja', a.admin_responsavel,
             'grupo_trailha', a.grupo_trailha,
             'pago', lower(coalesce(a.status_pagamento, '')) in ('confirmado', 'pago', 'completed'),
             'whatsapp', a.whatsapp,
             'tem_problema_saude', coalesce(a.tem_problema_saude, false),
             'condicoes_medicas', a.condicoes_medicas,
             'usa_medicamento', coalesce(a.usa_medicamento, false),
             'medicamentos', a.medicamentos,
             'tem_restricao_alimentar', coalesce(a.tem_restricao_alimentar, false),
             'restricoes_alimentares', a.restricoes_alimentares,
             'esta_gravida', coalesce(a.esta_gravida, false),
             'contato_emergencia_nome', a.contato_emergencia_nome,
             'contato_emergencia_telefone', a.contato_emergencia_telefone)
           order by a.nome)
      from public.acampantes a
     where coalesce(a.tipo, 'acampante') = 'acampante'), '[]'::jsonb));
end;
$fn$;

revoke all on function public.saude_acampantes() from public, anon;
grant execute on function public.saude_acampantes() to authenticated;

-- Troca da senha pela propria pessoa (prova: a senha atual) ----------------------
create or replace function public.trocar_senha_apoio(p_nome text, p_senha_atual text, p_senha_nova text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_linha   public.apoio_auth%rowtype;
  v_critica text;
begin
  select * into v_linha from public.apoio_auth
   where lower(nome) = lower(btrim(coalesce(p_nome, '')))
   limit 1;

  if v_linha.id is null
     or v_linha.senha is null
     or v_linha.senha <> extensions.crypt(coalesce(p_senha_atual, ''), v_linha.senha)
  then
    return jsonb_build_object('ok', false, 'erro', 'Usuário ou senha atual incorretos.');
  end if;

  v_critica := public._criticar_senha(p_senha_nova, v_linha.nome, 'o seu nome');
  if v_critica is not null then
    return jsonb_build_object('ok', false, 'erro', v_critica);
  end if;

  if v_linha.senha = extensions.crypt(p_senha_nova, v_linha.senha) then
    return jsonb_build_object('ok', false, 'erro', 'A senha nova precisa ser diferente da atual.');
  end if;

  update public.apoio_auth
     set senha               = extensions.crypt(p_senha_nova, extensions.gen_salt('bf', 12)),
         senha_definida      = true,
         senha_atualizada_em = now()
   where id = v_linha.id;

  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.trocar_senha_apoio(text, text, text) from public;
grant execute on function public.trocar_senha_apoio(text, text, text) to anon, authenticated;

-- So Desenvolvedores: lista e senha nova ----------------------------------------
create or replace function public.listar_contas_apoio()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador_maximo() then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'nome', c.nome,
             'area', c.area,
             'tem_senha', c.senha is not null,
             'senha_definida', c.senha_definida,
             'senha_atualizada_em', c.senha_atualizada_em,
             'ultimo_acesso', c.ultimo_acesso)
           order by c.nome)
      from public.apoio_auth c), '[]'::jsonb);
end;
$fn$;

revoke all on function public.listar_contas_apoio() from public, anon;
grant execute on function public.listar_contas_apoio() to authenticated;

create or replace function public.redefinir_senha_apoio(p_nome text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_senha text;
  v_alvo  public.apoio_auth%rowtype;
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas o login de permissão máxima pode redefinir a senha de uma conta de apoio.');
  end if;

  select * into v_alvo from public.apoio_auth
   where lower(nome) = lower(btrim(coalesce(p_nome, '')))
   limit 1;
  if v_alvo.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Conta de apoio não encontrada.');
  end if;

  v_senha := public._gerar_senha_legivel();

  update public.apoio_auth
     set senha               = extensions.crypt(v_senha, extensions.gen_salt('bf', 12)),
         senha_definida      = false,   -- temporaria: sera trocada no proximo acesso
         senha_atualizada_em = now()
   where id = v_alvo.id;

  -- Senha nova tambem tira um bloqueio por senha errada.
  update public.login_tentativas set falhas = 0, bloqueado_ate = null
   where tipo = 'apoio' and identificador = lower(v_alvo.nome);

  return jsonb_build_object(
    'ok', true,
    'nome', v_alvo.nome,
    'senha', v_senha,
    'mensagem',
      'Acesso de apoio (saúde) do Metanoia Radical Serra.' || chr(10) || chr(10) ||
      'Site: https://metanoiaradicalserra.com.br/login' || chr(10) ||
      'Tipo de acesso: Apoio' || chr(10) ||
      'Usuário: ' || v_alvo.nome || chr(10) ||
      'Senha: ' || v_senha || chr(10) || chr(10) ||
      'Ao entrar, o sistema vai pedir para você criar a SUA senha ' ||
      '(mínimo 8 caracteres, com letras e números).'
  );
end;
$fn$;

revoke all on function public.redefinir_senha_apoio(text) from public, anon;
grant execute on function public.redefinir_senha_apoio(text) to authenticated;
