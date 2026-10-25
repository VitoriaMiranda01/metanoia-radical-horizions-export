-- 25/10/2026 (Patrick pediu varredura de seguranca; escolheu "corrigir direto
-- o que for seguro"). Nada aqui muda o uso normal do site.
--
-- 1) TROCAR SENHA driblava o limite de tentativas do login.
--    trocar_senha_organizador / trocar_senha_apoio / trocar_senha_igreja sao
--    chamaveis sem login (o proprio parceiro/organizador troca a senha) e
--    conferem a senha atual -- mas SEM o bloqueio de 10 erros / 10 minutos que
--    a Edge Function "login" aplica (login_tentativas). Dava para testar senhas
--    sem limite por aqui e, acertando, trocar a senha (tomar a conta).
--    Agora usam o MESMO contador do login (mesmo tipo + identificador): errou
--    10x, bloqueia os dois caminhos por 10 minutos.
--    Alem disso trocar_senha_organizador procurava o usuario com ILIKE: "%"
--    casava com o primeiro organizador sem saber o nome. Agora e nome exato
--    (sem diferenciar maiusculas), como o apoio.
--
-- 2) Bucket da autorizacao dos pais (publico por decisao do Patrick -- nao
--    muda): aceitava envio anonimo de QUALQUER tamanho e tipo. Agora o mesmo
--    limite que o formulario ja impoe: 10 MB, PNG/JPG/PDF.
--
-- 3) Higiene: search_path fixo nas 4 funcoes que o painel do Supabase aponta;
--    policy duplicada em limites_igrejas; dois indices duplicados.

-- ------------------------------------------------------------ 1) trocar senha
create or replace function public.trocar_senha_organizador(p_nome text, p_senha_atual text, p_senha_nova text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_linha   public.organizadores_auth%rowtype;
  v_critica text;
  v_ident   text := btrim(coalesce(p_nome, ''));
  v_ate     timestamptz;
begin
  v_ate := public.login_bloqueado_ate('organizador', v_ident);
  if v_ate is not null then
    return jsonb_build_object('ok', false, 'erro',
      'Muitas tentativas com senha errada. Tente de novo depois de '
      || to_char(v_ate at time zone 'America/Sao_Paulo', 'HH24:MI') || '.');
  end if;

  select * into v_linha
  from public.organizadores_auth
  where lower(nome) = lower(v_ident)
  limit 1;

  if v_linha.id is null
     or v_linha.senha is null
     or v_linha.senha <> extensions.crypt(coalesce(p_senha_atual, ''), v_linha.senha)
  then
    perform public.registrar_falha_login('organizador', v_ident);
    return jsonb_build_object('ok', false, 'erro', 'Usuário ou senha atual incorretos.');
  end if;
  perform public.limpar_falhas_login('organizador', v_ident);

  v_critica := public._criticar_senha(p_senha_nova, v_linha.nome, 'o seu nome de usuário');
  if v_critica is not null then
    return jsonb_build_object('ok', false, 'erro', v_critica);
  end if;

  if v_linha.senha = extensions.crypt(p_senha_nova, v_linha.senha) then
    return jsonb_build_object('ok', false, 'erro', 'A senha nova precisa ser diferente da atual.');
  end if;

  update public.organizadores_auth
     set senha               = extensions.crypt(p_senha_nova, extensions.gen_salt('bf', 12)),
         senha_definida      = true,
         senha_atualizada_em = now()
   where id = v_linha.id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.trocar_senha_apoio(p_nome text, p_senha_atual text, p_senha_nova text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_linha   public.apoio_auth%rowtype;
  v_critica text;
  v_ident   text := btrim(coalesce(p_nome, ''));
  v_ate     timestamptz;
begin
  v_ate := public.login_bloqueado_ate('apoio', v_ident);
  if v_ate is not null then
    return jsonb_build_object('ok', false, 'erro',
      'Muitas tentativas com senha errada. Tente de novo depois de '
      || to_char(v_ate at time zone 'America/Sao_Paulo', 'HH24:MI') || '.');
  end if;

  select * into v_linha from public.apoio_auth
   where lower(nome) = lower(v_ident)
   limit 1;

  if v_linha.id is null
     or v_linha.senha is null
     or v_linha.senha <> extensions.crypt(coalesce(p_senha_atual, ''), v_linha.senha)
  then
    perform public.registrar_falha_login('apoio', v_ident);
    return jsonb_build_object('ok', false, 'erro', 'Usuário ou senha atual incorretos.');
  end if;
  perform public.limpar_falhas_login('apoio', v_ident);

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
$$;

create or replace function public.trocar_senha_igreja(p_codigo text, p_senha_atual text, p_senha_nova text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_linha   public.igrejas_parceiras%rowtype;
  v_critica text;
  v_ident   text := btrim(coalesce(p_codigo, ''));
  v_ate     timestamptz;
begin
  v_ate := public.login_bloqueado_ate('igreja', v_ident);
  if v_ate is not null then
    return jsonb_build_object('ok', false, 'erro',
      'Muitas tentativas com senha errada. Tente de novo depois de '
      || to_char(v_ate at time zone 'America/Sao_Paulo', 'HH24:MI') || '.');
  end if;

  select * into v_linha
  from public.igrejas_parceiras
  where codigo = v_ident
  limit 1;

  if v_linha.id is null
     or v_linha.senha is null
     or v_linha.senha <> extensions.crypt(coalesce(p_senha_atual, ''), v_linha.senha)
  then
    perform public.registrar_falha_login('igreja', v_ident);
    return jsonb_build_object('ok', false, 'erro', 'Código ou senha atual incorretos.');
  end if;
  perform public.limpar_falhas_login('igreja', v_ident);

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

  update public.solicitacoes_senha
     set atendida_em = now(), atendida_por = 'o próprio parceiro'
   where codigo = v_linha.codigo and atendida_em is null;

  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------ 2) uploads
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
 where id = 'autorizacao-menor-idade-equipante';

-- ------------------------------------------------------------ 3) higiene
alter function public._fotos_trilha_sem_acento(text) set search_path = public, extensions;
alter function public._ip_da_requisicao() set search_path = public, extensions;
alter function public._lgpd_hoje() set search_path = public, extensions;
alter function public._limite_envios_convite() set search_path = public, extensions;

-- a "Public read access for limites_igrejas" (roles public) ja cobre anon e
-- authenticated: a outra era identica.
drop policy if exists "todos podem ler limites de igreja" on public.limites_igrejas;

-- identicos a idx_equipantes_edicao / idx_acampantes_edicao (so pesam nas gravacoes)
drop index if exists public.idx_equipantes_numero_edicao;
drop index if exists public.idx_acampantes_numero_edicao;
