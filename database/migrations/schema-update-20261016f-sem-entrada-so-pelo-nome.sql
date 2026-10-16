-- Ninguem entra numa ficha so pelo nome (16/10/2026, Patrick, revisao).
--
-- 1) _inscricao_e_sua(text, uuid, text, text) -- a versao antiga, de 4
--    parametros -- aceitava SO o nome completo para qualquer ficha. Nenhuma
--    funcao a usa mais (todas chamam a de 5, com nascimento); sai, para
--    ninguem voltar a usa-la por engano.
-- 2) Na versao de 5: ficha de inscricao manual sem CPF e sem nascimento
--    deixava entrar so com o nome. O caminho agora e o da organizacao:
--    confirma a identidade e salva o CPF (pedidos de acesso, 20261016d), e a
--    pessoa entra com ele. Sem CPF continua valendo nome + nascimento
--    (estrangeiros).
-- 3) A virada de edicao deixa permite_completar_cadastro_manual DESLIGADO
--    (antes ligava: era o "complete o seu cadastro pelo nome").

drop function if exists public._inscricao_e_sua(text, uuid, text, text);

create or replace function public._inscricao_e_sua(p_tipo text, p_id uuid, p_cpf text, p_nome text, p_nascimento date DEFAULT NULL::date)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_cpf_linha   text;
  v_nome_linha  text;
  v_nasc_linha  date;
  v_cpf_dado    text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_normal      text;
begin
  if p_id is null then return false; end if;

  if p_tipo = 'equipante' then
    select regexp_replace(coalesce(e.cpf,''), '\D', '', 'g'),
           coalesce(e.nome,''), e.data_nascimento
      into v_cpf_linha, v_nome_linha, v_nasc_linha
      from public.equipantes e where e.id = p_id;
  else
    select regexp_replace(coalesce(a.cpf,''), '\D', '', 'g'),
           coalesce(a.nome,''), a.data_nascimento
      into v_cpf_linha, v_nome_linha, v_nasc_linha
      from public.acampantes a where a.id = p_id;
  end if;

  if not found then return false; end if;

  -- CPF que confere.
  if v_cpf_dado <> '' and v_cpf_linha <> '' and v_cpf_dado = v_cpf_linha then
    return true;
  end if;

  -- Sem CPF: nome completo E data de nascimento, os dois conferindo.
  if p_nascimento is null or v_nasc_linha is null or v_nasc_linha <> p_nascimento then
    return false;
  end if;

  v_normal := public.unaccent_simples(
                lower(btrim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g'))));

  return v_normal <> ''
     and v_normal = public.unaccent_simples(
                      lower(btrim(regexp_replace(v_nome_linha, '\s+', ' ', 'g'))));
end;
$function$;

revoke all on function public._inscricao_e_sua(text, uuid, text, text, date) from public, anon, authenticated;

-- A virada nao liga mais o "complete o seu cadastro pelo nome": o mesmo
-- gatilho que liga a ficha completa (20261016e) desliga este.
create or replace function public._ligar_ficha_completa_na_virada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.edicao_numero is distinct from old.edicao_numero and new.edicao_numero > old.edicao_numero then
    new.exige_ficha_completa := true;
    new.permite_completar_cadastro_manual := false;
  end if;
  return new;
end;
$$;

update public.configuracoes set permite_completar_cadastro_manual = false
 where permite_completar_cadastro_manual;
