-- ---------------------------------------------------------------------------
-- Data de nascimento obrigatoria no acampante (Patrick, 09/10/2026)
--
-- A tela da saude (login Apoio) mostrou "idade —" para 6 acampantes: fichas
-- de antes de 06/10 que entraram sem data de nascimento (o formulario aceitava
-- data incompleta ou impossivel -- o campo mostrava o que foi digitado, mas
-- gravava vazio). Desde 06/10 o formulario publico ja e barrado
-- (_dados_inscricao_validos); faltava o resto:
--
--  * _validar_ficha: acampante nao entra sem data de nascimento, e nenhuma
--    edicao apaga a data de quem tem (NASCIMENTO_OBRIGATORIO). Ficha antiga
--    sem data continua podendo ser salva por outro motivo (ex.: confirmar
--    pagamento) -- so nao pode PERDER a data. Equipante fica como estava
--    (a inscricao manual de equipante so exige o nome, de proposito).
--  * nascimentos_pendentes(): notificacao propria em Gerenciar Inscricoes
--    (Raquel e Desenvolvedores), com o campo para preencher ali mesmo.
--  * cadastro_acampantes_pendentes(): o aviso "dado fora do padrao" fica so
--    com data IMPOSSIVEL; data em branco passou para o aviso proprio acima.
-- ---------------------------------------------------------------------------

create or replace function public._validar_ficha()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o jsonb := '{}'::jsonb;
  n jsonb := to_jsonb(new);
  v_campo text;
  v_valor text;
  v_nasc date;
  v_idade int;
  v_tem_cpf boolean;
begin
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
  end if;

  v_tem_cpf := nullif(regexp_replace(coalesce(n ->> 'cpf', ''), '\D', '', 'g'), '') is not null;

  if (n ->> 'nome') is distinct from (o ->> 'nome') and not public._nome_pessoa_valido(n ->> 'nome') then
    raise exception 'NOME_INVALIDO';
  end if;

  if v_tem_cpf and (n ->> 'cpf') is distinct from (o ->> 'cpf') and not public._cpf_valido(n ->> 'cpf') then
    raise exception 'CPF_INVALIDO';
  end if;

  -- Acampante: data de nascimento obrigatoria (09/10/2026). Ficha nova sem
  -- data, ou edicao que apaga a data, nao passa.
  if tg_table_name = 'acampantes'
     and nullif(n ->> 'data_nascimento', '') is null
     and (tg_op = 'INSERT' or nullif(o ->> 'data_nascimento', '') is not null) then
    raise exception 'NASCIMENTO_OBRIGATORIO';
  end if;

  if nullif(n ->> 'data_nascimento', '') is not null
     and (n ->> 'data_nascimento') is distinct from (o ->> 'data_nascimento') then
    v_nasc := (n ->> 'data_nascimento')::date;
    v_idade := extract(year from age(current_date, v_nasc));
    if v_nasc > current_date or v_idade < 10 or v_idade > 100 then
      raise exception 'NASCIMENTO_INVALIDO';
    end if;
  end if;

  if nullif(btrim(coalesce(n ->> 'sexo', '')), '') is not null
     and (n ->> 'sexo') is distinct from (o ->> 'sexo')
     and (n ->> 'sexo') not in ('Masculino', 'Feminino') then
    raise exception 'SEXO_INVALIDO';
  end if;

  foreach v_campo in array array['pastor_nome', 'familiar_nome', 'quem_indicou_nome', 'nome_familiar_conhecido'] loop
    v_valor := n ->> v_campo;
    if nullif(btrim(coalesce(v_valor, '')), '') is not null
       and v_valor is distinct from (o ->> v_campo)
       and not public._nome_simples_valido(v_valor) then
      raise exception 'NOME_TEXTO_INVALIDO:%', v_campo;
    end if;
  end loop;

  v_valor := n ->> 'contato_emergencia_nome';
  if nullif(btrim(coalesce(v_valor, '')), '') is not null then
    if v_valor is distinct from (o ->> 'contato_emergencia_nome')
       and (v_valor ~ '[^[:alpha:][:space:]''’.-]'
            or length(regexp_replace(v_valor, '[^[:alpha:]]', '', 'g')) < 2) then
      raise exception 'CONTATO_NOME_INVALIDO';
    end if;
    if (v_valor is distinct from (o ->> 'contato_emergencia_nome') or (n ->> 'nome') is distinct from (o ->> 'nome'))
       and public.unaccent_simples(lower(btrim(regexp_replace(v_valor, '\s+', ' ', 'g'))))
         = public.unaccent_simples(lower(btrim(regexp_replace(coalesce(n ->> 'nome', ''), '\s+', ' ', 'g')))) then
      raise exception 'CONTATO_MESMO_NOME';
    end if;
  end if;

  v_valor := n ->> 'email';
  if nullif(btrim(coalesce(v_valor, '')), '') is not null
     and v_valor is distinct from (o ->> 'email')
     and not public._email_valido(v_valor) then
    raise exception 'EMAIL_INVALIDO';
  end if;

  v_valor := n ->> 'profissao';
  if v_valor ~ '[0-9]' and v_valor is distinct from (o ->> 'profissao') then
    raise exception 'PROFISSAO_INVALIDA';
  end if;

  v_valor := n ->> 'tamanho_camisa';
  if nullif(btrim(coalesce(v_valor, '')), '') is not null
     and v_valor is distinct from (o ->> 'tamanho_camisa')
     and upper(btrim(v_valor)) not in ('PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG') then
    raise exception 'CAMISA_INVALIDA';
  end if;

  if v_tem_cpf then
    v_valor := n ->> 'cep';
    if nullif(btrim(coalesce(v_valor, '')), '') is not null
       and v_valor is distinct from (o ->> 'cep')
       and regexp_replace(v_valor, '\D', '', 'g') !~ '^\d{8}$' then
      raise exception 'CEP_INVALIDO';
    end if;
    v_valor := n ->> 'estado';
    if nullif(btrim(coalesce(v_valor, '')), '') is not null
       and v_valor is distinct from (o ->> 'estado')
       and not public._uf_valida(upper(btrim(v_valor))) then
      raise exception 'ESTADO_INVALIDO';
    end if;
  end if;
  v_valor := n ->> 'cidade';
  if v_valor ~ '[0-9]' and v_valor is distinct from (o ->> 'cidade') then
    raise exception 'CIDADE_INVALIDA';
  end if;

  return new;
end;
$function$;

-- Notificacao: acampantes sem data de nascimento ------------------------------------
create or replace function public.nascimentos_pendentes()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_nome text := lower(coalesce(public._nome_organizador_logado(), ''));
  v_itens jsonb;
begin
  if v_nome not in ('raquel', 'desenvolvedores') then
    return null;
  end if;

  select coalesce(jsonb_agg(t order by t.nome), '[]'::jsonb) into v_itens
  from (
    select a.id, a.nome, a.whatsapp, a.admin_responsavel, a.igreja, a.sexo,
           lower(coalesce(a.status_pagamento, '')) in ('confirmado', 'pago', 'completed') as pago
      from public.acampantes a
     where a.data_nascimento is null
  ) t;

  return jsonb_build_object(
    'perfil', case when v_nome = 'raquel' then 'raquel' else 'desenvolvedores' end,
    'itens', v_itens);
end;
$function$;

revoke all on function public.nascimentos_pendentes() from public, anon;
grant execute on function public.nascimentos_pendentes() to authenticated;

-- "Dado fora do padrao": data em branco saiu (tem aviso proprio) ------------------
create or replace function public.cadastro_acampantes_pendentes()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_nome text := lower(coalesce(public._nome_organizador_logado(), ''));
  v_itens jsonb;
begin
  if v_nome not in ('raquel', 'desenvolvedores') then
    return null;
  end if;

  select coalesce(jsonb_agg(t order by t.nome), '[]'::jsonb) into v_itens
  from (
    select a.id, a.nome, a.whatsapp, a.admin_responsavel, a.igreja, p.problemas,
           a.sexo, a.data_nascimento, a.email, a.cep, a.estado, a.cidade,
           a.pastor_nome, a.quem_indicou_nome, a.nome_familiar_conhecido, a.profissao
      from public.acampantes a
      cross join lateral (
        select array_remove(array[
          case when not public._nome_pessoa_valido(a.nome) then 'nome' end,
          case when nullif(btrim(coalesce(a.sexo, '')), '') is null then 'sexo' end,
          case when a.data_nascimento is not null
                 and extract(year from age(current_date, a.data_nascimento)) not between 10 and 100
               then 'nascimento' end,
          case when nullif(btrim(coalesce(a.email, '')), '') is not null
                 and not public._email_valido(a.email) then 'email' end,
          case when nullif(regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g'), '') is not null
                 and regexp_replace(coalesce(a.cep, ''), '\D', '', 'g') !~ '^\d{8}$' then 'cep' end,
          case when nullif(regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g'), '') is not null
                 and not public._uf_valida(upper(btrim(coalesce(a.estado, '')))) then 'estado' end,
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
$function$;
