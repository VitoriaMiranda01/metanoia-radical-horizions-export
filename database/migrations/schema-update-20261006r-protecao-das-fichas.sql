-- ---------------------------------------------------------------------------
-- Protecao das inscricoes futuras (Patrick, 06/10/2026): os erros que
-- apareceram hoje nao podem voltar -- nome com numero, CPF invalido, sexo ou
-- nascimento em branco, igreja ausente, contato de emergencia que e a propria
-- pessoa, CEP e estado errados...
--
-- Duas travas no BANCO (valem para qualquer caminho, nao so para o formulario):
--
-- 1. criar_inscricao (_dados_inscricao_validos) passa a exigir tambem os
--    campos OBRIGATORIOS, os mesmos do formulario:
--      ambos     CPF (ou nacionalidade), sexo e data de nascimento
--      equipante igreja (nao congrega vale; OUTRA pede o nome), conhecido ou
--                familiar acampante (e o nome dele), 3 areas de trabalho
--
-- 2. Gatilho _validar_ficha em acampantes e equipantes: ao gravar ou ALTERAR
--    um campo, confere o formato -- inclusive quando o organizador edita pela
--    ficha ou por qualquer chamada direta a API. So confere o que MUDOU: ficha
--    antiga com dado estranho nao impede salvar outras alteracoes (esses casos
--    aparecem nos avisos e na janela de cadastro).
--      nome, CPF, nascimento (10 a 100 anos), sexo, nomes (pastor, familiar,
--      quem indicou, conhecido, contato de emergencia -- que nao pode ser a
--      propria pessoa), e-mail, profissao, camisa, CEP, estado e cidade
--      (estrangeiro, sem CPF, mora fora: CEP e estado livres).
--    O telefone ja tem o gatilho dele (20261003d).
--
-- Os codigos de erro sao os mesmos de criar_inscricao; a tela traduz em
-- src/utils/errosDeDados.js.
-- ---------------------------------------------------------------------------

create or replace function public._validar_ficha()
returns trigger
language plpgsql
set search_path to 'public'
as $fn$
declare
  o jsonb := '{}'::jsonb;
  n jsonb := to_jsonb(new);
  v_campo text;
  v_valor text;
  v_nasc date;
  v_idade int;
  v_tem_cpf boolean;
  -- mudou? (insercao conta como mudanca)
  v_mudou boolean;
begin
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
  end if;

  v_tem_cpf := nullif(regexp_replace(coalesce(n ->> 'cpf', ''), '\D', '', 'g'), '') is not null;

  -- Nome da pessoa
  if (n ->> 'nome') is distinct from (o ->> 'nome') and not public._nome_pessoa_valido(n ->> 'nome') then
    raise exception 'NOME_INVALIDO';
  end if;

  -- CPF
  if v_tem_cpf and (n ->> 'cpf') is distinct from (o ->> 'cpf') and not public._cpf_valido(n ->> 'cpf') then
    raise exception 'CPF_INVALIDO';
  end if;

  -- Data de nascimento
  if nullif(n ->> 'data_nascimento', '') is not null
     and (n ->> 'data_nascimento') is distinct from (o ->> 'data_nascimento') then
    v_nasc := (n ->> 'data_nascimento')::date;
    v_idade := extract(year from age(current_date, v_nasc));
    if v_nasc > current_date or v_idade < 10 or v_idade > 100 then
      raise exception 'NASCIMENTO_INVALIDO';
    end if;
  end if;

  -- Sexo
  if nullif(btrim(coalesce(n ->> 'sexo', '')), '') is not null
     and (n ->> 'sexo') is distinct from (o ->> 'sexo')
     and (n ->> 'sexo') not in ('Masculino', 'Feminino') then
    raise exception 'SEXO_INVALIDO';
  end if;

  -- Nomes de outras pessoas: so letras
  foreach v_campo in array array['pastor_nome', 'familiar_nome', 'quem_indicou_nome', 'nome_familiar_conhecido'] loop
    v_valor := n ->> v_campo;
    if nullif(btrim(coalesce(v_valor, '')), '') is not null
       and v_valor is distinct from (o ->> v_campo)
       and not public._nome_simples_valido(v_valor) then
      raise exception 'NOME_TEXTO_INVALIDO:%', v_campo;
    end if;
  end loop;

  -- Contato de emergencia: so letras e outra pessoa
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

  -- E-mail
  v_valor := n ->> 'email';
  if nullif(btrim(coalesce(v_valor, '')), '') is not null
     and v_valor is distinct from (o ->> 'email')
     and not public._email_valido(v_valor) then
    raise exception 'EMAIL_INVALIDO';
  end if;

  -- Profissao
  v_valor := n ->> 'profissao';
  if v_valor ~ '[0-9]' and v_valor is distinct from (o ->> 'profissao') then
    raise exception 'PROFISSAO_INVALIDA';
  end if;

  -- Camisa
  v_valor := n ->> 'tamanho_camisa';
  if nullif(btrim(coalesce(v_valor, '')), '') is not null
     and v_valor is distinct from (o ->> 'tamanho_camisa')
     and upper(btrim(v_valor)) not in ('PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG') then
    raise exception 'CAMISA_INVALIDA';
  end if;

  -- Endereco (acampante). Estrangeiro mora fora: CEP e estado livres.
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
$fn$;
revoke all on function public._validar_ficha() from public, anon, authenticated;

drop trigger if exists validar_ficha on public.acampantes;
create trigger validar_ficha
  before insert or update on public.acampantes
  for each row execute function public._validar_ficha();

drop trigger if exists validar_ficha on public.equipantes;
create trigger validar_ficha
  before insert or update on public.equipantes
  for each row execute function public._validar_ficha();


-- criar_inscricao: tambem os campos obrigatorios.
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

select pg_temp._patch('public._dados_inscricao_validos(jsonb,text)',
$$  if nullif(btrim(coalesce(p_dados ->> 'email', '')), '') is not null
     and not public._email_valido(p_dados ->> 'email') then$$,
$$  -- Obrigatorios, os mesmos do formulario (20261006r).
  if nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '') is null
     and nullif(btrim(coalesce(p_dados ->> 'nacionalidade', '')), '') is null then
    return 'CPF_OBRIGATORIO';
  end if;
  if coalesce(p_dados ->> 'sexo', '') not in ('Masculino', 'Feminino') then
    return 'SEXO_INVALIDO';
  end if;
  if nullif(btrim(coalesce(p_dados ->> 'data_nascimento', '')), '') is null then
    return 'NASCIMENTO_INVALIDO';
  end if;

  if nullif(btrim(coalesce(p_dados ->> 'email', '')), '') is not null
     and not public._email_valido(p_dados ->> 'email') then$$);

select pg_temp._patch('public._dados_inscricao_validos(jsonb,text)',
$$
  return null;
end;$$,
$$
  if p_tipo = 'equipante' then
    if nullif(btrim(coalesce(p_dados ->> 'igreja', '')), '') is null then
      return 'IGREJA_OBRIGATORIA';
    end if;
    if upper(btrim(p_dados ->> 'igreja')) = 'OUTRA'
       and length(btrim(coalesce(p_dados ->> 'igreja_outra', ''))) < 3 then
      return 'IGREJA_OUTRA_OBRIGATORIA';
    end if;
    if nullif(btrim(coalesce(p_dados ->> 'parentesco', '')), '') is null then
      return 'PARENTESCO_OBRIGATORIO';
    end if;
    if (p_dados ->> 'parentesco') <> 'NÃO TENHO'
       and nullif(btrim(coalesce(p_dados ->> 'familiar_nome', '')), '') is null then
      return 'FAMILIAR_OBRIGATORIO';
    end if;
    if nullif(btrim(coalesce(p_dados ->> 'area_trabalho_opcao1', '')), '') is null
       or nullif(btrim(coalesce(p_dados ->> 'area_trabalho_opcao2', '')), '') is null
       or nullif(btrim(coalesce(p_dados ->> 'area_trabalho_opcao3', '')), '') is null then
      return 'AREAS_OBRIGATORIAS';
    end if;
  end if;

  return null;
end;$$);
