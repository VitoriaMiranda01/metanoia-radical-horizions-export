-- Menor: responsavel (e acompanhante do equipante) + grupo do WhatsApp dos
-- acampantes (04/11/2026, Patrick)
--
-- 1) Menor de 18 anos (idade de hoje, igual a public.idade):
--    * ACAMPANTE: nome + WhatsApp (celular) do responsavel, obrigatorios.
--      A carta de autorizacao continua como era.
--    * EQUIPANTE: nome + WhatsApp do responsavel E nome + WhatsApp de quem
--      vai acompanhar o menor trabalhando no projeto, obrigatorios.
--    Nomes: nome e sobrenome (_nome_pessoa_valido); nao pode ser o proprio
--    inscrito. WhatsApp: celular valido (o gatilho de telefones padroniza e
--    recusa), diferente do WhatsApp do proprio inscrito. Responsavel e
--    acompanhante PODEM ser a mesma pessoa.
--    Colunas novas SEM not null (criar_inscricao usa jsonb_populate_record).
--    Fichas antigas nao viram pendencia: a edicao 37 acabou e todo equipante
--    passa pelo formulario na reinscricao, que exige os campos.
--
-- 2) Link do grupo de WhatsApp dos acampantes: um link geral por edicao,
--    gravado pelo organizador (caixa "Gerenciar inscricoes") em Gerenciar
--    Inscricoes > Acampantes. O acampante so recebe o link depois de pago,
--    provando ser ele pelo CPF ou pelo txid do PIX pago.

-- 1. Colunas -------------------------------------------------------------
alter table public.acampantes
  add column if not exists responsavel_nome text,
  add column if not exists responsavel_whatsapp text;

alter table public.equipantes
  add column if not exists responsavel_nome text,
  add column if not exists responsavel_whatsapp text,
  add column if not exists acompanhante_nome text,
  add column if not exists acompanhante_whatsapp text;

-- 2. Regra do menor (usada por criar_inscricao) --------------------------
create or replace function public._menor_responsavel_erro(p_dados jsonb, p_tipo text)
returns text
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_nasc date;
  v_estrangeiro boolean :=
    nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '') is null;
  v_proprio_nome text := public.unaccent_simples(lower(btrim(regexp_replace(coalesce(p_dados ->> 'nome', ''), '\s+', ' ', 'g'))));
  v_proprio_tel text := public._telefone_normalizado(p_dados ->> 'whatsapp', false, v_estrangeiro);
  v_tel text;
  r record;
begin
  begin
    v_nasc := nullif(btrim(coalesce(p_dados ->> 'data_nascimento', '')), '')::date;
  exception when others then
    return null; -- data invalida ja e recusada antes (NASCIMENTO_INVALIDO)
  end;
  if v_nasc is null
     or extract(year from age((now() at time zone 'America/Sao_Paulo')::date, v_nasc)) >= 18 then
    return null;
  end if;

  for r in
    select * from (values
      ('responsavel_nome', 'responsavel_whatsapp', 'RESPONSAVEL', true),
      ('acompanhante_nome', 'acompanhante_whatsapp', 'ACOMPANHANTE', p_tipo = 'equipante')
    ) as t(campo_nome, campo_tel, prefixo, exige)
  loop
    continue when not r.exige;
    if nullif(btrim(coalesce(p_dados ->> r.campo_nome, '')), '') is null then
      return r.prefixo || '_NOME_OBRIGATORIO';
    end if;
    if not public._nome_pessoa_valido(p_dados ->> r.campo_nome) then
      return r.prefixo || '_NOME_INVALIDO';
    end if;
    if public.unaccent_simples(lower(btrim(regexp_replace(p_dados ->> r.campo_nome, '\s+', ' ', 'g')))) = v_proprio_nome then
      return r.prefixo || '_MESMO_NOME';
    end if;
    if nullif(btrim(coalesce(p_dados ->> r.campo_tel, '')), '') is null then
      return r.prefixo || '_WHATSAPP_OBRIGATORIO';
    end if;
    v_tel := public._telefone_normalizado(p_dados ->> r.campo_tel, false, v_estrangeiro);
    if v_tel is null then
      return 'TELEFONE_INVALIDO:' || r.campo_tel;
    end if;
    if v_tel = v_proprio_tel then
      return r.prefixo || '_MESMO_TELEFONE';
    end if;
  end loop;

  return null;
end;
$function$;
revoke all on function public._menor_responsavel_erro(jsonb, text) from public, anon, authenticated;

-- 2a. _dados_inscricao_validos chama a regra no fim.
do $do$
declare
  v_def text := pg_get_functiondef('public._dados_inscricao_validos'::regproc);
  v_novo text;
begin
  v_novo := replace(v_def,
$t$  return null;
end;
$function$$t$,
$t$  -- Menor (20261104d): responsavel (e acompanhante do equipante).
  if public._menor_responsavel_erro(p_dados, p_tipo) is not null then
    return public._menor_responsavel_erro(p_dados, p_tipo);
  end if;

  return null;
end;
$function$$t$);
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em _dados_inscricao_validos';
  end if;
  execute v_novo;
end $do$;

-- 2b. Reinscricao do equipante: o UPDATE de criar_inscricao lista as colunas.
do $$
declare
  v_def text := pg_get_functiondef('public.criar_inscricao'::regproc);
  v_novo text;
begin
  v_novo := replace(v_def,
$t$        contato_emergencia_telefone  = v_e.contato_emergencia_telefone,
$t$,
$t$        contato_emergencia_telefone  = v_e.contato_emergencia_telefone,
        responsavel_nome             = v_e.responsavel_nome,
        responsavel_whatsapp         = v_e.responsavel_whatsapp,
        acompanhante_nome            = v_e.acompanhante_nome,
        acompanhante_whatsapp        = v_e.acompanhante_whatsapp,
$t$);
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em criar_inscricao';
  end if;
  execute v_novo;
end $$;

-- 2c. Gatilho de telefones: os dois WhatsApp novos sao celular.
do $$
declare
  v_def text := pg_get_functiondef('public._padronizar_telefones'::regproc);
  v_novo text;
begin
  v_novo := replace(v_def,
$t$      ('telefone', true)
$t$,
$t$      ('telefone', true),
      ('responsavel_whatsapp', false),
      ('acompanhante_whatsapp', false)
$t$);
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em _padronizar_telefones';
  end if;
  execute v_novo;
end $$;

-- 2d. Gatilho validar_ficha: formato do nome e "nao e a propria pessoa"
-- quando o campo muda; menor nao pode ter o campo apagado.
do $$
declare
  v_def text := pg_get_functiondef('public._validar_ficha'::regproc);
  v_novo text;
begin
  v_novo := replace(v_def,
$t$  v_valor := n ->> 'email';
$t$,
$t$  -- Menor (20261104d): responsavel / acompanhante.
  foreach v_campo in array array['responsavel_nome', 'acompanhante_nome'] loop
    v_valor := n ->> v_campo;
    if nullif(btrim(coalesce(v_valor, '')), '') is not null
       and (v_valor is distinct from (o ->> v_campo) or (n ->> 'nome') is distinct from (o ->> 'nome')) then
      if v_valor is distinct from (o ->> v_campo) and not public._nome_pessoa_valido(v_valor) then
        raise exception '%', case v_campo when 'responsavel_nome' then 'RESPONSAVEL_NOME_INVALIDO' else 'ACOMPANHANTE_NOME_INVALIDO' end;
      end if;
      if public.unaccent_simples(lower(btrim(regexp_replace(v_valor, '\s+', ' ', 'g'))))
         = public.unaccent_simples(lower(btrim(regexp_replace(coalesce(n ->> 'nome', ''), '\s+', ' ', 'g')))) then
        raise exception '%', case v_campo when 'responsavel_nome' then 'RESPONSAVEL_MESMO_NOME' else 'ACOMPANHANTE_MESMO_NOME' end;
      end if;
    end if;
  end loop;
  if tg_op = 'UPDATE'
     and nullif(n ->> 'data_nascimento', '') is not null
     and extract(year from age((now() at time zone 'America/Sao_Paulo')::date, (n ->> 'data_nascimento')::date)) < 18 then
    foreach v_campo in array array['responsavel_nome', 'responsavel_whatsapp', 'acompanhante_nome', 'acompanhante_whatsapp'] loop
      if nullif(btrim(coalesce(o ->> v_campo, '')), '') is not null
         and nullif(btrim(coalesce(n ->> v_campo, '')), '') is null then
        raise exception '%', case when v_campo like 'responsavel%' then 'RESPONSAVEL_' else 'ACOMPANHANTE_' end
          || case when v_campo like '%nome' then 'NOME_OBRIGATORIO' else 'WHATSAPP_OBRIGATORIO' end;
      end if;
    end loop;
  end if;

  v_valor := n ->> 'email';
$t$);
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em _validar_ficha';
  end if;
  execute v_novo;
end $$;

-- 2e. Conferencia dos menores (pastor parceiro / organizador) mostra os contatos.
do $$
declare
  v_def text := pg_get_functiondef('public.menores_para_conferencia'::regproc);
  v_novo text;
begin
  v_novo := replace(v_def,
$t$           e.autorizacao_conferida_por
$t$,
$t$           e.autorizacao_conferida_por,
           e.responsavel_nome, e.responsavel_whatsapp,
           e.acompanhante_nome, e.acompanhante_whatsapp
$t$);
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em menores_para_conferencia';
  end if;
  execute v_novo;
end $$;

-- 2f. Reinscricao: o responsavel volta preenchido (o acompanhante e por edicao).
do $$
declare
  v_def text := pg_get_functiondef('public.ficha_para_reinscricao'::regproc);
  v_novo text;
begin
  v_novo := replace(v_def,
$t$    'contato_emergencia_telefone',  e.contato_emergencia_telefone
$t$,
$t$    'contato_emergencia_telefone',  e.contato_emergencia_telefone,
    'responsavel_nome',             e.responsavel_nome,
    'responsavel_whatsapp',         e.responsavel_whatsapp
$t$);
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em ficha_para_reinscricao';
  end if;
  execute v_novo;
end $$;

-- 3. Grupo do WhatsApp dos acampantes -------------------------------------
create table if not exists public.grupo_whatsapp_acampantes (
  edicao int primary key,
  link text not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
alter table public.grupo_whatsapp_acampantes enable row level security;
revoke all on public.grupo_whatsapp_acampantes from public, anon, authenticated;

create or replace function public._edicao_atual()
returns int
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.edicao_numero from public.configuracoes c order by c.edicao_numero desc limit 1;
$function$;
revoke all on function public._edicao_atual() from public, anon, authenticated;

-- Organizador: le o link da edicao atual.
create or replace function public.grupo_acampantes_ver()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  g public.grupo_whatsapp_acampantes;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  select * into g from public.grupo_whatsapp_acampantes where edicao = public._edicao_atual();
  return jsonb_build_object('ok', true, 'edicao', public._edicao_atual(),
    'link', g.link, 'atualizado_em', g.atualizado_em, 'atualizado_por', g.atualizado_por,
    'pode_editar', public.org_pode('gerenciar_inscricoes'));
end;
$function$;
revoke all on function public.grupo_acampantes_ver() from public, anon;
grant execute on function public.grupo_acampantes_ver() to authenticated;

-- Organizador com "Gerenciar inscricoes": grava (vazio apaga).
create or replace function public.grupo_acampantes_definir(p_link text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_link text := btrim(coalesce(p_link, ''));
  v_edicao int := public._edicao_atual();
  v_quem text;
begin
  if not public.org_pode('gerenciar_inscricoes') then
    return jsonb_build_object('ok', false, 'erro',
      'Você não tem permissão para isso. Peça aos Desenvolvedores.');
  end if;
  if v_edicao is null then
    return jsonb_build_object('ok', false, 'erro', 'Edição atual não encontrada.');
  end if;
  if v_link = '' then
    delete from public.grupo_whatsapp_acampantes where edicao = v_edicao;
    return jsonb_build_object('ok', true, 'link', null);
  end if;
  if v_link !~* '^https://chat\.whatsapp\.com/[A-Za-z0-9]{10,40}([/?#].*)?$' or length(v_link) > 200 then
    return jsonb_build_object('ok', false, 'erro',
      'Cole o link de convite do grupo, no formato https://chat.whatsapp.com/...');
  end if;
  select o.nome into v_quem from public._organizador_do_cracha() o;
  insert into public.grupo_whatsapp_acampantes (edicao, link, atualizado_em, atualizado_por)
  values (v_edicao, v_link, now(), coalesce(v_quem, 'Organizador'))
  on conflict (edicao) do update
    set link = excluded.link, atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por;
  return jsonb_build_object('ok', true, 'link', v_link);
end;
$function$;
revoke all on function public.grupo_acampantes_definir(text) from public, anon;
grant execute on function public.grupo_acampantes_definir(text) to authenticated;

-- Publico: o acampante PAGO recebe o link. Prova: CPF da inscricao, ou o
-- txid de um PIX pago dela. Nao revela nada alem do link.
create or replace function public.grupo_acampantes_link(p_cpf text default null, p_txid text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_pago boolean := false;
  v_link text;
begin
  if length(v_cpf) = 11 then
    select exists (
      select 1 from public.acampantes a
       where regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g') = v_cpf
         and lower(coalesce(a.status_pagamento, '')) in ('pago', 'confirmado', 'completed'))
      into v_pago;
  end if;
  if not v_pago and nullif(btrim(coalesce(p_txid, '')), '') is not null then
    select exists (
      select 1 from public.pix_sicoob p
        join public.acampantes a on a.id = p.inscricao_id
       where p.sicoob_id = p_txid
         and p.inscricao_tipo = 'acampante'
         and lower(coalesce(a.status_pagamento, '')) in ('pago', 'confirmado', 'completed'))
      into v_pago;
  end if;
  if not v_pago then
    return jsonb_build_object('pago', false);
  end if;
  select g.link into v_link from public.grupo_whatsapp_acampantes g where g.edicao = public._edicao_atual();
  return jsonb_build_object('pago', true, 'link', v_link);
end;
$function$;
revoke all on function public.grupo_acampantes_link(text, text) from public;
grant execute on function public.grupo_acampantes_link(text, text) to anon, authenticated;
