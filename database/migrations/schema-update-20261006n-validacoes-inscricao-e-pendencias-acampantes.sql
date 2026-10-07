-- ---------------------------------------------------------------------------
-- Dados validos em TODOS os campos com formato (Patrick, 06/10/2026), de
-- acampantes e equipantes, para a pessoa sempre informar o dado correto na
-- hora da inscricao -- e, para as fichas que ja existem, uma lista do que
-- esta errado:
--   * acampante: aviso em Gerenciar Inscricoes (os organizadores ajustam);
--   * equipante: a propria pessoa completa ao entrar no acompanhamento
--     (nova pendencia 'pastor' e 'familiar').
--
-- _dados_inscricao_validos(p_dados, p_tipo): devolve o codigo do primeiro
--   problema (ou null). criar_inscricao levanta esse codigo:
--     EMAIL_INVALIDO, NASCIMENTO_INVALIDO, PROFISSAO_INVALIDA,
--     NOME_TEXTO_INVALIDO:<campo>, CEP_INVALIDO, ESTADO_INVALIDO,
--     CIDADE_INVALIDA
--   (nome, CPF e telefones ja eram conferidos: 20261006m e 20261003d.)
--
-- Reinscricao: a ficha antiga volta para o formulario e o servidor confere
-- tudo de novo -- quem fez o cadastro e nao vai nesta edicao corrige as
-- pendencias na hora de se inscrever na proxima.
--
-- Fichas manuais: a busca "inscrito pela organizacao" (ha_manuais e
-- reivindicar_cadastro_manual) so olha as da edicao atual (inscrito).
-- ---------------------------------------------------------------------------

create or replace function public._nome_simples_valido(p text)
returns boolean
language sql
immutable
set search_path to 'public'
as $fn$
  select p is not null
     and btrim(p) !~ '[^[:alpha:][:space:]''’.-]'
     and length(regexp_replace(p, '[^[:alpha:]]', '', 'g')) >= 2;
$fn$;

create or replace function public._email_valido(p text)
returns boolean
language sql
immutable
set search_path to 'public'
as $fn$
  select p is not null and btrim(p) ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$';
$fn$;

create or replace function public._uf_valida(p text)
returns boolean
language sql
immutable
set search_path to 'public'
as $fn$
  select p = any (array['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
                        'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);
$fn$;

create or replace function public._dados_inscricao_validos(p_dados jsonb, p_tipo text)
returns text
language plpgsql
stable
set search_path to 'public'
as $fn$
declare
  v_nasc date;
  v_idade int;
  v_campo text;
begin
  if nullif(btrim(coalesce(p_dados ->> 'email', '')), '') is not null
     and not public._email_valido(p_dados ->> 'email') then
    return 'EMAIL_INVALIDO';
  end if;

  if nullif(btrim(coalesce(p_dados ->> 'data_nascimento', '')), '') is not null then
    begin
      v_nasc := (p_dados ->> 'data_nascimento')::date;
    exception when others then
      return 'NASCIMENTO_INVALIDO';
    end;
    v_idade := extract(year from age(current_date, v_nasc));
    if v_nasc > current_date or v_idade < 10 or v_idade > 100 then
      return 'NASCIMENTO_INVALIDO';
    end if;
  end if;

  if coalesce(p_dados ->> 'profissao', '') ~ '[0-9]' then
    return 'PROFISSAO_INVALIDA';
  end if;

  foreach v_campo in array array['pastor_nome', 'quem_indicou_nome', 'nome_familiar_conhecido', 'familiar_nome'] loop
    if nullif(btrim(coalesce(p_dados ->> v_campo, '')), '') is not null
       and not public._nome_simples_valido(p_dados ->> v_campo) then
      return 'NOME_TEXTO_INVALIDO:' || v_campo;
    end if;
  end loop;

  if p_tipo <> 'equipante' then
    if regexp_replace(coalesce(p_dados ->> 'cep', ''), '\D', '', 'g') !~ '^\d{8}$' then
      return 'CEP_INVALIDO';
    end if;
    if not public._uf_valida(upper(btrim(coalesce(p_dados ->> 'estado', '')))) then
      return 'ESTADO_INVALIDO';
    end if;
    if nullif(btrim(coalesce(p_dados ->> 'cidade', '')), '') is null
       or (p_dados ->> 'cidade') ~ '[0-9]' then
      return 'CIDADE_INVALIDA';
    end if;
  end if;

  return null;
end;
$fn$;

revoke all on function public._nome_simples_valido(text) from public, anon, authenticated;
revoke all on function public._email_valido(text) from public, anon, authenticated;
revoke all on function public._uf_valida(text) from public, anon, authenticated;
revoke all on function public._dados_inscricao_validos(jsonb, text) from public, anon, authenticated;


create or replace function pg_temp._patch(p_fn regprocedure, p_de text, p_para text, p_vezes int default 1)
returns void
language plpgsql
as $fn$
declare
  d text := pg_get_functiondef(p_fn);
  n int := (length(d) - length(replace(d, p_de, ''))) / length(p_de);
begin
  if n <> p_vezes then
    raise exception 'patch %: esperava % ocorrencia(s) de [%], achou %', p_fn, p_vezes, left(p_de, 80), n;
  end if;
  execute replace(d, p_de, p_para);
end;
$fn$;


-- criar_inscricao: confere os campos com formato.
select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
$$    raise exception 'CPF_INVALIDO';
  end if;
$$,
$$    raise exception 'CPF_INVALIDO';
  end if;
  -- Demais campos com formato (20261006n).
  if public._dados_inscricao_validos(p_dados, p_tipo) is not null then
    raise exception '%', public._dados_inscricao_validos(p_dados, p_tipo);
  end if;
$$);


-- Fichas manuais: so as da edicao atual.
select pg_temp._patch('public.verificar_inscricao(text,text,text)',
$$         where e.inscricao_manual_em is not null
           and nullif($$,
$$         where e.inscricao_manual_em is not null and coalesce(e.inscrito, false)
           and nullif($$);

select pg_temp._patch('public.reivindicar_cadastro_manual(text,text)',
$$   where e.inscricao_manual_em is not null
     and nullif($$,
$$   where e.inscricao_manual_em is not null and coalesce(e.inscrito, false)
     and nullif($$);


-- Equipante: pendencias 'pastor' e 'familiar' (nome fora do padrao).
select pg_temp._patch('public._pendencias_equipante(uuid)',
$$  if (nullif(btrim(coalesce(e.area_trabalho_opcao1, '')), '') is null$$,
$$  if nullif(btrim(coalesce(e.pastor_nome, '')), '') is not null
     and not public._nome_simples_valido(e.pastor_nome) then
    v := v || jsonb_build_array(jsonb_build_object('tipo', 'pastor', 'valor', e.pastor_nome));
  end if;

  if nullif(btrim(coalesce(e.parentesco, '')), '') is not null
     and e.parentesco <> 'NÃO TENHO'
     and (nullif(btrim(coalesce(e.familiar_nome, '')), '') is null
          or not public._nome_simples_valido(e.familiar_nome)) then
    v := v || jsonb_build_array(jsonb_build_object('tipo', 'familiar', 'valor', coalesce(e.familiar_nome, '')));
  end if;

  if (nullif(btrim(coalesce(e.area_trabalho_opcao1, '')), '') is null$$);

-- completar_minha_inscricao: grava pastor e familiar corrigidos.
select pg_temp._patch('public.completar_minha_inscricao(uuid,text,text,date,jsonb)',
$$  s_nome text; s_igreja text;$$,
$$  s_pastor text; s_fam2 text; s_nome text; s_igreja text;$$);

select pg_temp._patch('public.completar_minha_inscricao(uuid,text,text,date,jsonb)',
$$  if v_pend @> '[{"tipo":"nome"}]' and btrim(coalesce(d ->> 'nome', '')) <> '' then$$,
$$  if v_pend @> '[{"tipo":"pastor"}]' and btrim(coalesce(d ->> 'pastor', '')) <> '' then
    s_pastor := regexp_replace(btrim(d ->> 'pastor'), '\s+', ' ', 'g');
    if not public._nome_simples_valido(s_pastor) or length(s_pastor) > 150 then
      return jsonb_build_object('ok', false, 'erro', 'Escreva o nome do pastor, só com letras.');
    end if;
  end if;

  if v_pend @> '[{"tipo":"familiar"}]' and btrim(coalesce(d ->> 'familiar_nome', '')) <> '' then
    s_fam2 := regexp_replace(btrim(d ->> 'familiar_nome'), '\s+', ' ', 'g');
    if not public._nome_simples_valido(s_fam2) or length(s_fam2) > 150 then
      return jsonb_build_object('ok', false, 'erro', 'Escreva o nome do conhecido / familiar, só com letras.');
    end if;
  end if;

  if v_pend @> '[{"tipo":"nome"}]' and btrim(coalesce(d ->> 'nome', '')) <> '' then$$);

select pg_temp._patch('public.completar_minha_inscricao(uuid,text,text,date,jsonb)',
$$      nome           = coalesce(s_nome, q.nome),$$,
$$      nome           = coalesce(s_nome, q.nome),
      pastor_nome    = coalesce(s_pastor, q.pastor_nome),$$);

select pg_temp._patch('public.completar_minha_inscricao(uuid,text,text,date,jsonb)',
$$      familiar_nome  = case when s_parentesco is not null then s_familiar else q.familiar_nome end,$$,
$$      familiar_nome  = case when s_parentesco is not null then s_familiar
                            when s_fam2 is not null then s_fam2
                            else q.familiar_nome end,$$);

select pg_temp._patch('public.completar_minha_inscricao(uuid,text,text,date,jsonb)',
$$  if s_nome is not null then
    v_log := v_log$$,
$$  if s_pastor is not null then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'pastor_nome', 'antes', e.pastor_nome, 'depois', s_pastor, 'em', v_agora));
  end if;
  if s_fam2 is not null then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'familiar_nome', 'antes', e.familiar_nome, 'depois', s_fam2, 'em', v_agora));
  end if;
  if s_nome is not null then
    v_log := v_log$$);


-- Acampantes com dado fora do padrao: o aviso de Gerenciar Inscricoes. Os
-- telefones, o contato de emergencia e a camisa tem aviso proprio. So Raquel
-- e Desenvolvedores; os outros logins recebem null.
create or replace function public.cadastro_acampantes_pendentes()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_nome text := lower(coalesce(public._nome_organizador_logado(), ''));
  v_itens jsonb;
begin
  if v_nome not in ('raquel', 'desenvolvedores') then
    return null;
  end if;

  select coalesce(jsonb_agg(t order by t.nome), '[]'::jsonb) into v_itens
  from (
    select a.id, a.nome, a.whatsapp, a.admin_responsavel, a.igreja, p.problemas
      from public.acampantes a
      cross join lateral (
        select array_remove(array[
          case when not public._nome_pessoa_valido(a.nome) then 'nome' end,
          case when nullif(btrim(coalesce(a.sexo, '')), '') is null then 'sexo' end,
          case when a.data_nascimento is null
                 or extract(year from age(current_date, a.data_nascimento)) not between 10 and 100
               then 'nascimento' end,
          case when nullif(btrim(coalesce(a.email, '')), '') is not null
                 and not public._email_valido(a.email) then 'email' end,
          case when regexp_replace(coalesce(a.cep, ''), '\D', '', 'g') !~ '^\d{8}$' then 'cep' end,
          case when not public._uf_valida(upper(btrim(coalesce(a.estado, '')))) then 'estado' end,
          case when nullif(btrim(coalesce(a.cidade, '')), '') is null
                 or a.cidade ~ '[0-9]' then 'cidade' end,
          case when nullif(btrim(coalesce(a.pastor_nome, '')), '') is not null
                 and not public._nome_simples_valido(a.pastor_nome) then 'pastor' end,
          case when nullif(btrim(coalesce(a.quem_indicou_nome, '')), '') is not null
                 and not public._nome_simples_valido(a.quem_indicou_nome) then 'indicou' end,
          case when nullif(btrim(coalesce(a.nome_familiar_conhecido, '')), '') is not null
                 and not public._nome_simples_valido(a.nome_familiar_conhecido) then 'conhecido' end,
          case when coalesce(a.profissao, '') ~ '[0-9]' then 'profissao' end
        ], null) as problemas) p
     where cardinality(p.problemas) > 0
  ) t;

  return jsonb_build_object(
    'perfil', case when v_nome = 'raquel' then 'raquel' else 'desenvolvedores' end,
    'itens', v_itens);
end;
$fn$;
revoke all on function public.cadastro_acampantes_pendentes() from public, anon;
grant execute on function public.cadastro_acampantes_pendentes() to authenticated;

revoke all on function public._pendencias_equipante(uuid) from public, anon, authenticated;
