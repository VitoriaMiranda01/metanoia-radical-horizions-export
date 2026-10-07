-- ---------------------------------------------------------------------------
-- Dados validos na inscricao (Patrick, 06/10/2026): "as pessoas precisam
-- colocar dados validos tambem: no nome so letras, CPF valido, WhatsApp
-- valido".
--
-- O WhatsApp ja era conferido. Faltava o NOME (so letras, nome e sobrenome) e
-- o CPF (digitos verificadores) no servidor -- ate aqui so a tela de
-- verificacao do CPF conferia, e o campo do formulario podia ser editado
-- depois sem nova conferencia.
--
--   _nome_pessoa_valido   so letras (e espaco, apostrofo, hifen, ponto), com
--                         nome e sobrenome
--   criar_inscricao       NOME_INVALIDO / CPF_INVALIDO
--   inscricao_manual_equipante   idem (CPF continua opcional)
--   _pendencias_equipante  nova pendencia 'nome' (fichas com numero, simbolo
--                         ou nome so com uma palavra)
--   completar_minha_inscricao   corrige o nome; o nome do familiar tambem so
--                         aceita letras
--
-- So vale para quem se inscreve ou e completado daqui para frente: nao ha
-- gatilho na tabela, para uma ficha antiga com nome estranho nao travar
-- nenhuma outra edicao.
-- ---------------------------------------------------------------------------

create or replace function public._nome_pessoa_valido(p text)
returns boolean
language sql
immutable
set search_path to 'public'
as $fn$
  select p is not null
     and btrim(p) !~ '[^[:alpha:][:space:]''’.-]'
     and cardinality(regexp_split_to_array(btrim(regexp_replace(p, '\s+', ' ', 'g')), ' ')) >= 2
     and length(regexp_replace(p, '[^[:alpha:]]', '', 'g')) >= 4;
$fn$;
revoke all on function public._nome_pessoa_valido(text) from public, anon, authenticated;


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


-- criar_inscricao: nome e CPF validos.
select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
$$  if length(v_nome) < 3 then
    raise exception 'NOME_OBRIGATORIO';
  end if;
$$,
$$  if length(v_nome) < 3 then
    raise exception 'NOME_OBRIGATORIO';
  end if;
  -- So letras, nome e sobrenome (20261006m).
  if not public._nome_pessoa_valido(v_nome) then
    raise exception 'NOME_INVALIDO';
  end if;
  -- CPF, quando informado, com os digitos verificadores certos (20261006m).
  if nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '') is not null
     and not public._cpf_valido(p_dados ->> 'cpf') then
    raise exception 'CPF_INVALIDO';
  end if;
$$);


-- Inscricao manual: nome e CPF validos.
select pg_temp._patch('public.inscricao_manual_equipante(jsonb)',
$$  if length(v_nome) < 3 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o nome da pessoa.');
  end if;
$$,
$$  if length(v_nome) < 3 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o nome da pessoa.');
  end if;
  if not public._nome_pessoa_valido(v_nome) then
    return jsonb_build_object('ok', false, 'erro',
      'O nome só pode ter letras e precisa de nome e sobrenome.');
  end if;
$$);

select pg_temp._patch('public.inscricao_manual_equipante(jsonb)',
$$  if v_cpf is not null and length(v_cpf) <> 11 then
    return jsonb_build_object('ok', false, 'erro', 'O CPF precisa ter 11 dígitos (ou deixe em branco).');
  end if;
$$,
$$  if v_cpf is not null and (length(v_cpf) <> 11 or not public._cpf_valido(v_cpf)) then
    return jsonb_build_object('ok', false, 'erro', 'CPF inválido: confira os números (ou deixe em branco).');
  end if;
$$);


-- Pendencia 'nome'.
select pg_temp._patch('public._pendencias_equipante(uuid)',
$$  if nullif(btrim(coalesce(e.igreja, '')), '') is null$$,
$$  if not public._nome_pessoa_valido(e.nome) then
    v := v || jsonb_build_array(jsonb_build_object('tipo', 'nome', 'valor', coalesce(e.nome, '')));
  end if;

  if nullif(btrim(coalesce(e.igreja, '')), '') is null$$);


-- completar_minha_inscricao: corrige o nome; familiar so com letras.
select pg_temp._patch('public.completar_minha_inscricao(uuid,text,text,date,jsonb)',
$$  s_igreja text; s_outra text;$$,
$$  s_nome text; s_igreja text; s_outra text;$$);

select pg_temp._patch('public.completar_minha_inscricao(uuid,text,text,date,jsonb)',
$$  if v_pend @> '[{"tipo":"igreja"}]' and btrim(coalesce(d ->> 'igreja', '')) <> '' then$$,
$$  if v_pend @> '[{"tipo":"nome"}]' and btrim(coalesce(d ->> 'nome', '')) <> '' then
    s_nome := regexp_replace(btrim(d ->> 'nome'), '\s+', ' ', 'g');
    if not public._nome_pessoa_valido(s_nome) or length(s_nome) > 150 then
      return jsonb_build_object('ok', false, 'erro',
        'Escreva o nome completo (nome e sobrenome), só com letras.');
    end if;
  end if;

  if v_pend @> '[{"tipo":"igreja"}]' and btrim(coalesce(d ->> 'igreja', '')) <> '' then$$);

select pg_temp._patch('public.completar_minha_inscricao(uuid,text,text,date,jsonb)',
$$      igreja         = case when s_igreja_set then s_igreja else q.igreja end,$$,
$$      nome           = coalesce(s_nome, q.nome),
      igreja         = case when s_igreja_set then s_igreja else q.igreja end,$$);

select pg_temp._patch('public.completar_minha_inscricao(uuid,text,text,date,jsonb)',
$$      if length(s_familiar) < 2 or length(s_familiar) > 150 then
        return jsonb_build_object('ok', false, 'erro', 'Escreva o nome do conhecido / familiar.');
      end if;$$,
$$      if s_familiar ~ '[^[:alpha:][:space:]''’.-]'
         or length(regexp_replace(s_familiar, '[^[:alpha:]]', '', 'g')) < 2
         or length(s_familiar) > 150 then
        return jsonb_build_object('ok', false, 'erro',
          'Escreva o nome do conhecido / familiar, só com letras.');
      end if;$$);

select pg_temp._patch('public.completar_minha_inscricao(uuid,text,text,date,jsonb)',
$$  if s_igreja_set then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'igreja'$$,
$$  if s_nome is not null then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'nome', 'antes', e.nome, 'depois', s_nome, 'em', v_agora));
  end if;
  if s_igreja_set then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'igreja'$$);

select pg_temp._patch('public.completar_minha_inscricao(uuid,text,text,date,jsonb)',
$$'salvo', jsonb_build_object('cpf', v_cpf_final, 'nascimento', s_nasc));$$,
$$'salvo', jsonb_build_object('cpf', v_cpf_final, 'nascimento', s_nasc, 'nome', s_nome));$$);

revoke all on function public._pendencias_equipante(uuid) from public, anon, authenticated;
