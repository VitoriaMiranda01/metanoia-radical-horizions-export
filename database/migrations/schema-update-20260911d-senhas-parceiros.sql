-- ---------------------------------------------------------------------------
-- Senhas dos parceiros: primeiro acesso, troca obrigatoria e redefinicao
--
-- POR QUE ISSO EXISTE
-- -------------------
-- Ate aqui, a senha de toda igreja parceira era "<codigo>.123456" -- uma
-- FORMULA, igual para as 146 contas, e documentada em texto claro dentro de
-- um arquivo de migration num repositorio publico. Na pratica: quem
-- descobrisse uma senha, entrava em todas.
--
-- O desenho novo foi decidido com o Patrick em 11/09/2026:
--
--   1. A senha de PRIMEIRO ACESSO continua sendo uma formula
--      ("<codigo><sufixo>") -- decisao dele, para facilitar a
--      distribuicao para as 145 igrejas.
--   2. Como formula vaza (basta uma das 145 pessoas repassar a mensagem),
--      a conta so aceita esse primeiro acesso depois que um organizador
--      LIBERA a igreja (coluna acesso_liberado). A ideia e liberar conforme
--      as mensagens vao sendo enviadas, e nao as 145 de uma vez -- assim a
--      formula nunca vale para todas as contas ao mesmo tempo.
--   3. No primeiro acesso o parceiro e OBRIGADO a criar uma senha propria
--      (minimo 8, com letra e numero). A partir dai a formula morre para
--      aquela conta.
--   4. Se esquecer, ele clica em "solicitar nova senha" na tela de login.
--      Isso NAO envia senha nenhuma -- so cria um aviso para os
--      organizadores, que geram a senha nova e mandam para o contato
--      conhecido da igreja. O pedido nunca pode ser a autenticacao.
--
-- Custo do bcrypt: as senhas antigas estavam em custo 06 (muito baixo; o
-- recomendado hoje e 12). Tudo que este arquivo grava usa gen_salt('bf', 12).
--
-- pgcrypto vive no schema "extensions" neste projeto, por isso todo
-- search_path abaixo inclui os dois schemas.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Colunas de controle em igrejas_parceiras
-- ---------------------------------------------------------------------------
alter table public.igrejas_parceiras
  add column if not exists acesso_liberado      boolean not null default false,
  add column if not exists senha_definida       boolean not null default false,
  add column if not exists senha_atualizada_em  timestamptz,
  add column if not exists ultimo_acesso        timestamptz;

comment on column public.igrejas_parceiras.acesso_liberado is
  'Organizador liberou o primeiro acesso desta igreja. Enquanto false, o login e recusado mesmo com a senha correta.';
comment on column public.igrejas_parceiras.senha_definida is
  'false = ainda esta com a senha inicial de formula; o site obriga a trocar antes de usar o sistema.';

-- ---------------------------------------------------------------------------
-- 2. Fila de solicitacoes de redefinicao
--
-- Tabela fechada: nenhum papel tem GRANT direto. So as funcoes abaixo
-- (SECURITY DEFINER) escrevem e leem. O indice parcial garante UMA
-- solicitacao aberta por igreja -- sem isso, um clique repetido (ou de
-- ma fe) encheria a tela do organizador de linhas iguais.
-- ---------------------------------------------------------------------------
create table if not exists public.solicitacoes_senha (
  id            uuid primary key default gen_random_uuid(),
  codigo        text        not null,
  criado_em     timestamptz not null default now(),
  atendida_em   timestamptz,
  atendida_por  text
);

create unique index if not exists solicitacoes_senha_uma_aberta_por_igreja
  on public.solicitacoes_senha (codigo)
  where atendida_em is null;

alter table public.solicitacoes_senha enable row level security;
revoke all on public.solicitacoes_senha from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Gerador de senha legivel
--
-- Formato "krtm-38qp": sempre com letra e numero (atende a propria regra
-- que exigimos do parceiro) e sem os caracteres que se confundem quando
-- alguem le a senha em voz alta ou digita olhando o WhatsApp -- fora o
-- 0/O, 1/l/i. Vale para a senha que o organizador gera numa redefinicao;
-- a senha de primeiro acesso e a formula escolhida pelo Patrick.
-- ---------------------------------------------------------------------------
create or replace function public._gerar_senha_legivel()
returns text
language plpgsql
volatile
set search_path to 'public', 'extensions'
as $$
declare
  c_letras  constant text := 'abcdefghjkmnpqrstuvwxyz';  -- sem i, l, o
  c_numeros constant text := '23456789';                 -- sem 0 e 1
  v_out text := '';
  i int;
begin
  for i in 1..4 loop
    v_out := v_out || substr(c_letras, 1 + floor(random() * length(c_letras))::int, 1);
  end loop;
  v_out := v_out || '-';
  for i in 1..2 loop
    v_out := v_out || substr(c_numeros, 1 + floor(random() * length(c_numeros))::int, 1);
  end loop;
  for i in 1..2 loop
    v_out := v_out || substr(c_letras, 1 + floor(random() * length(c_letras))::int, 1);
  end loop;
  return v_out;
end;
$$;

revoke all on function public._gerar_senha_legivel() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Regras da senha escolhida pelo parceiro
--
-- Minimo 8 com letra e numero (regra definida pelo Patrick). Alem disso,
-- recusa as escolhas obvias: regra de complexidade sem lista de bloqueio
-- costuma produzir "senha123" e "igreja2026" -- que sao tao adivinhaveis
-- quanto a formula que estamos justamente aposentando. Tambem recusa
-- qualquer senha que contenha o codigo da propria igreja ou a palavra
-- "metanoia", para a pessoa nao recriar a formula por conta propria.
--
-- Devolve NULL quando esta tudo certo, ou o texto do erro para a tela
-- mostrar.
-- ---------------------------------------------------------------------------
create or replace function public._criticar_senha(p_senha text, p_codigo text)
returns text
language plpgsql
immutable
set search_path to 'public'
as $$
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
  if v_baixa like '%metanoia%' then
    return 'A senha não pode conter a palavra "metanoia".';
  end if;
  if p_codigo is not null and v_baixa like '%' || lower(p_codigo) || '%' then
    return 'A senha não pode conter o código da sua igreja.';
  end if;
  if v_baixa in (
    'senha123', '12345678', '123456789', 'abcd1234', 'senha1234',
    'igreja123', 'parceiro1', 'password1', 'qwerty123', '1234abcd'
  ) then
    return 'Essa senha é muito comum. Escolha outra.';
  end if;
  return null;
end;
$$;

revoke all on function public._criticar_senha(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Troca de senha pelo proprio parceiro
--
-- Chamada pela tela de primeiro acesso e por uma troca voluntaria. A prova
-- de identidade aqui e a SENHA ATUAL -- por isso a funcao pode ser chamada
-- por quem ainda nao tem cracha valido (o primeiro acesso acontece antes de
-- o parceiro entrar de fato no sistema).
--
-- Nao revela se o codigo existe: codigo inexistente e senha errada devolvem
-- a mesma resposta.
-- ---------------------------------------------------------------------------
create or replace function public.trocar_senha_igreja(
  p_codigo      text,
  p_senha_atual text,
  p_senha_nova  text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_linha  public.igrejas_parceiras%rowtype;
  v_critica text;
begin
  select * into v_linha
  from public.igrejas_parceiras
  where codigo = trim(p_codigo)
  limit 1;

  if v_linha.id is null
     or v_linha.senha is null
     or v_linha.senha <> extensions.crypt(coalesce(p_senha_atual, ''), v_linha.senha)
  then
    return jsonb_build_object('ok', false, 'erro', 'Código ou senha atual incorretos.');
  end if;

  if not v_linha.acesso_liberado then
    return jsonb_build_object('ok', false, 'erro',
      'O acesso desta igreja ainda não foi liberado. Fale com a organização.');
  end if;

  v_critica := public._criticar_senha(p_senha_nova, v_linha.codigo);
  if v_critica is not null then
    return jsonb_build_object('ok', false, 'erro', v_critica);
  end if;

  if v_linha.senha = extensions.crypt(p_senha_nova, v_linha.senha) then
    return jsonb_build_object('ok', false, 'erro', 'A senha nova precisa ser diferente da atual.');
  end if;

  update public.igrejas_parceiras
     set senha               = extensions.crypt(p_senha_nova, extensions.gen_salt('bf', 12)),
         senha_definida      = true,
         senha_atualizada_em = now()
   where id = v_linha.id;

  -- Trocou a senha sozinho: se havia pedido de ajuda aberto, ele ja morreu.
  update public.solicitacoes_senha
     set atendida_em = now(), atendida_por = 'o próprio parceiro'
   where codigo = v_linha.codigo and atendida_em is null;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.trocar_senha_igreja(text, text, text) from public;
grant execute on function public.trocar_senha_igreja(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Pedido de redefinicao (parceiro que esqueceu a senha)
--
-- NAO envia senha nem confirma nada: so cria um aviso na tela do
-- organizador. Devolve sempre a mesma resposta, exista o codigo ou nao --
-- senao isso viraria uma forma de descobrir quais codigos existem.
-- ---------------------------------------------------------------------------
create or replace function public.solicitar_redefinicao_senha(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_codigo text := trim(coalesce(p_codigo, ''));
begin
  if v_codigo <> '' and exists (select 1 from public.igrejas_parceiras where codigo = v_codigo) then
    insert into public.solicitacoes_senha (codigo)
    values (v_codigo)
    on conflict do nothing;  -- ja existe um pedido aberto: nao duplica
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.solicitar_redefinicao_senha(text) from public;
grant execute on function public.solicitar_redefinicao_senha(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Tela do organizador: listagem das contas
-- ---------------------------------------------------------------------------
create or replace function public.listar_contas_parceiros()
returns table (
  codigo              text,
  nome                text,
  acesso_liberado     boolean,
  senha_definida      boolean,
  ultimo_acesso       timestamptz,
  senha_atualizada_em timestamptz,
  pedido_aberto_em    timestamptz
)
language sql
security definer
stable
set search_path to 'public'
as $$
  select i.codigo,
         i.nome,
         i.acesso_liberado,
         i.senha_definida,
         i.ultimo_acesso,
         i.senha_atualizada_em,
         s.criado_em
    from public.igrejas_parceiras i
    left join public.solicitacoes_senha s
           on s.codigo = i.codigo and s.atendida_em is null
   where public.eh_organizador()
   order by lpad(i.codigo, 4, '0');
$$;

revoke all on function public.listar_contas_parceiros() from public;
grant execute on function public.listar_contas_parceiros() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Tela do organizador: liberar / bloquear o primeiro acesso
-- ---------------------------------------------------------------------------
create or replace function public.liberar_primeiro_acesso(p_codigo text, p_liberar boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem fazer isso.');
  end if;

  update public.igrejas_parceiras
     set acesso_liberado = coalesce(p_liberar, true)
   where codigo = trim(p_codigo);

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Igreja não encontrada.');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.liberar_primeiro_acesso(text, boolean) from public;
grant execute on function public.liberar_primeiro_acesso(text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Tela do organizador: gerar senha nova para uma igreja
--
-- Devolve a senha em texto claro UMA VEZ, para o organizador copiar e
-- mandar no WhatsApp. Ela nao fica guardada em lugar nenhum em texto claro
-- -- so o hash vai para o banco. Se o organizador perder a tela, gera outra.
--
-- Deixa senha_definida = false de proposito: a senha gerada aqui tambem e
-- temporaria, e o parceiro sera obrigado a criar a dele no proximo acesso.
-- ---------------------------------------------------------------------------
create or replace function public.redefinir_senha_parceiro(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_senha  text;
  v_nome   text;
  v_quem   text;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem fazer isso.');
  end if;

  v_senha := public._gerar_senha_legivel();
  v_quem  := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', 'organizador');

  update public.igrejas_parceiras
     set senha               = extensions.crypt(v_senha, extensions.gen_salt('bf', 12)),
         senha_definida      = false,   -- continua sendo temporaria
         acesso_liberado     = true,    -- sem isso a senha nova nao entraria
         senha_atualizada_em = now()
   where codigo = trim(p_codigo)
  returning nome into v_nome;

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Igreja não encontrada.');
  end if;

  update public.solicitacoes_senha
     set atendida_em = now(), atendida_por = v_quem
   where codigo = trim(p_codigo) and atendida_em is null;

  return jsonb_build_object('ok', true, 'senha', v_senha, 'nome', v_nome);
end;
$$;

revoke all on function public.redefinir_senha_parceiro(text) from public;
grant execute on function public.redefinir_senha_parceiro(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. Tela do organizador: descartar um pedido sem gerar senha
--     (ex.: descobriu que o pedido nao veio da igreja de verdade)
-- ---------------------------------------------------------------------------
create or replace function public.descartar_solicitacao_senha(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem fazer isso.');
  end if;

  update public.solicitacoes_senha
     set atendida_em  = now(),
         atendida_por = 'descartado'
   where codigo = trim(p_codigo) and atendida_em is null;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.descartar_solicitacao_senha(text) from public;
grant execute on function public.descartar_solicitacao_senha(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- NOTA (acrescentada no mesmo dia)
--
-- O sufixo da senha de primeiro acesso NAO fica escrito em lugar nenhum do
-- codigo. Ele mora na tabela fechada config_senhas, gravado fora do controle
-- de versao -- ver a migration "sufixo_senha_fora_do_codigo".
--
-- Motivo: este repositorio e publico e o JavaScript do site e baixavel por
-- qualquer visitante. A senha antiga ("<codigo>.123456") vazou exatamente
-- assim, documentada num arquivo de migration. Nao repetir.
-- ---------------------------------------------------------------------------
