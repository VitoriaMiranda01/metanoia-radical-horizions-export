-- Ficha completa a partir da proxima edicao (16/10/2026, Patrick)
--
-- Quem foi inscrito pela organizacao (inscricao manual) ficou com campos do
-- formulario em branco -- cargo, pastor, qual Radical fez como acampante --
-- e com respostas que nasceram "nao" sem a pessoa responder (saude,
-- restricao alimentar, ja trabalhou como equipe). Na proxima inscricao, isso
-- tem de ser preenchido pela propria pessoa; sem isso, nao inscreve.
--
--  * configuracoes.exige_ficha_completa: liga na virada de edicao (a 37 fica
--    como esta -- as inscricoes dela estao abertas).
--  * Ligada, o servidor exige: pastor e cargo (de quem congrega), qual Radical
--    + edicao como acampante, e a edicao em que trabalhou (se ja trabalhou).
--  * ficha_para_reinscricao: ficha manual que a pessoa nunca confirmou volta
--    SEM as respostas automaticas de saude / restricao / ja trabalhou (e
--    canta, toca, grupo de cuidado) -- o formulario obriga a responder.
--  * equipantes.ficha_confirmada_em: quando a pessoa enviou o formulario
--    (criar_inscricao). Coluna NULL de proposito (criar_inscricao usa
--    jsonb_populate_record: NOT NULL quebraria as inscricoes).

alter table public.configuracoes
  add column if not exists exige_ficha_completa boolean not null default false;

alter table public.equipantes
  add column if not exists ficha_confirmada_em timestamptz;

-- ------------------------------------------------------------------ regras
create or replace function public._dados_inscricao_validos(p_dados jsonb, p_tipo text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_nasc date;
  v_idade int;
  v_campo text;
begin
  if upper(btrim(coalesce(p_dados ->> 'igreja', ''))) = 'OUTRA'
     and not coalesce((select c.permite_igreja_outra from public.configuracoes c
                        order by c.edicao_numero desc limit 1), true) then
    return 'IGREJA_OUTRA_ENCERRADA';
  end if;
  if upper(btrim(coalesce(p_dados ->> 'admin_responsavel', ''))) = '84 - DIVERSOS'
     and not coalesce((select c.permite_igreja_diversos from public.configuracoes c
                        order by c.edicao_numero desc limit 1), true) then
    return 'IGREJA_DIVERSOS_ENCERRADA';
  end if;
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

  if p_tipo <> 'equipante'
     and nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '') is not null then
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

    -- Ficha completa (a partir da edicao 38, 16/10/2026).
    if coalesce((select c.exige_ficha_completa from public.configuracoes c
                  order by c.edicao_numero desc limit 1), false) then
      if lower(coalesce(p_dados ->> 'esta_afastado', '')) in ('true', 't', 'sim') then
        if nullif(btrim(coalesce(p_dados ->> 'pastor_nome', '')), '') is null then
          return 'PASTOR_OBRIGATORIO';
        end if;
        if nullif(btrim(coalesce(p_dados ->> 'cargo_igreja', '')), '') is null then
          return 'CARGO_OBRIGATORIO';
        end if;
        if upper(btrim(p_dados ->> 'cargo_igreja')) = 'OUTRO'
           and nullif(btrim(coalesce(p_dados ->> 'cargo_igreja_outro', '')), '') is null then
          return 'CARGO_OUTRO_OBRIGATORIO';
        end if;
      end if;
      if nullif(btrim(coalesce(p_dados ->> 'qual_radical_acampante', '')), '') is null then
        return 'RADICAL_OBRIGATORIO';
      end if;
      if nullif(btrim(coalesce(p_dados ->> 'numero_edicao_participou', '')), '') is null then
        return 'EDICAO_ACAMPANTE_OBRIGATORIA';
      end if;
      if lower(coalesce(p_dados ->> 'ja_trabalhou_equipe', '')) in ('true', 't', 'sim')
         and nullif(btrim(coalesce(p_dados ->> 'edicao_trabalhou', '')), '') is null then
        return 'EDICAO_EQUIPE_OBRIGATORIA';
      end if;
    end if;
  end if;

  return null;
end;
$function$;

-- ------------------------------------------------------------------ reinscricao
-- Ficha manual que a pessoa nunca confirmou: as respostas "nao" automaticas
-- voltam em branco, para o formulario obrigar a responder.
create or replace function public.ficha_para_reinscricao(p_cpf text, p_nome text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  e        public.equipantes%rowtype;
  v_cpf    text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_nome   text := public.unaccent_simples(
                     lower(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'))));
  v_conf   boolean;
begin
  if length(v_cpf) <> 11 or v_nome = '' then
    return jsonb_build_object('ok', false, 'erro',
      'Informe o CPF e o nome completo usados na inscrição anterior.');
  end if;

  select * into e
    from public.equipantes q
   where regexp_replace(coalesce(q.cpf,''), '\D', '', 'g') = v_cpf
     and q.tipo = 'equipante'
   limit 1;

  if not found
     or public.unaccent_simples(
          lower(btrim(regexp_replace(coalesce(e.nome,''), '\s+', ' ', 'g')))) <> v_nome
  then
    return jsonb_build_object('ok', false, 'erro',
      'Não encontramos uma inscrição anterior com esse CPF e esse nome. '
      || 'Confira o nome completo, ou preencha o formulário do zero.');
  end if;

  if coalesce(e.inscrito, false) then
    return jsonb_build_object('ok', false, 'ja_inscrito', true, 'erro',
      'Você já está inscrito nesta edição.');
  end if;

  v_conf := e.inscricao_manual_em is null or e.ficha_confirmada_em is not null;

  return jsonb_build_object('ok', true, 'ficha', jsonb_build_object(
    'nome',                         e.nome,
    'cpf',                          e.cpf,
    'sexo',                         e.sexo,
    'data_nascimento',              e.data_nascimento,
    'whatsapp',                     e.whatsapp,
    'telefone_residencial',         e.telefone_residencial,
    'telefone',                     e.telefone,
    'tem_problema_saude',           case when v_conf then e.tem_problema_saude end,
    'condicoes_medicas',            e.condicoes_medicas,
    'tem_restricao_alimentar',      case when v_conf then e.tem_restricao_alimentar end,
    'restricoes_alimentares',       e.restricoes_alimentares,
    'igreja',                       e.igreja,
    'igreja_outra',                 e.igreja_outra,
    'e_pastor',                     e.e_pastor,
    'e_pastor_outro',               e.e_pastor_outro,
    'pastor_nome',                  e.pastor_nome,
    'esta_afastado',                e.esta_afastado,
    'cargo_igreja',                 e.cargo_igreja,
    'cargo_igreja_outro',           e.cargo_igreja_outro,
    'frequenta_ebd',                e.frequenta_ebd,
    'frequenta_grupo_cuidado',      case when v_conf then e.frequenta_grupo_cuidado end,
    'voce_canta',                   case when v_conf then e.voce_canta end,
    'toca_instrumento',             case when v_conf then e.toca_instrumento end,
    'familiar_trabalhando',         e.familiar_trabalhando,
    'familiar_trabalhando_outro',   e.familiar_trabalhando_outro,
    'parentesco',                   e.parentesco,
    'familiar_nome',                e.familiar_nome,
    'qual_radical_acampante',       e.qual_radical_acampante,
    'qual_radical_acampante_outro', e.qual_radical_acampante_outro,
    'numero_edicao_participou',     e.numero_edicao_participou,
    -- "true" vem da escala (a virada marca quem trabalhou); "false" de ficha
    -- manual nao confirmada nao e resposta.
    'ja_trabalhou_equipe',          case when v_conf or e.ja_trabalhou_equipe then e.ja_trabalhou_equipe end,
    'edicao_trabalhou',             e.edicao_trabalhou,
    'autorizacao_imagem',           e.autorizacao_imagem,
    'contato_emergencia_nome',      e.contato_emergencia_nome,
    'contato_emergencia_telefone',  e.contato_emergencia_telefone
  ));
end;
$function$;

-- ------------------------------------------------------------------ criar_inscricao
-- Igual a anterior; so grava ficha_confirmada_em (a pessoa enviou o formulario).
create or replace function public.criar_inscricao(p_tipo text, p_dados jsonb, p_chave text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_id      uuid := gen_random_uuid();
  v_a       public.acampantes;
  v_e       public.equipantes;
  v_atual   public.equipantes%rowtype;
  v_aberto  boolean;
  v_nome    text;
  v_metodo  text;
  v_cpf     text;
  v_edicao  int;
begin
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'DADOS_INVALIDOS';
  end if;

  select case when p_tipo = 'equipante' then c.inscricoes_equipantes
              else c.inscricoes_acampantes end,
         c.edicao_numero
    into v_aberto, v_edicao
  from public.configuracoes c
  limit 1;

  if coalesce(v_aberto, false) is not true
     and not public.liberacao_valida(p_chave, p_tipo) then
    raise exception 'INSCRICOES_FECHADAS';
  end if;

  v_nome := btrim(coalesce(p_dados ->> 'nome', ''));
  if length(v_nome) < 3 then
    raise exception 'NOME_OBRIGATORIO';
  end if;
  if not public._nome_pessoa_valido(v_nome) then
    raise exception 'NOME_INVALIDO';
  end if;
  if nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '') is not null
     and not public._cpf_valido(p_dados ->> 'cpf') then
    raise exception 'CPF_INVALIDO';
  end if;
  if public._dados_inscricao_validos(p_dados, p_tipo) is not null then
    raise exception '%', public._dados_inscricao_validos(p_dados, p_tipo);
  end if;

  if public._telefone_normalizado(p_dados ->> 'whatsapp', false,
       nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '') is null) is null then
    raise exception 'TELEFONE_INVALIDO:whatsapp';
  end if;
  if p_tipo <> 'equipante'
     and public._telefone_normalizado(p_dados ->> 'contato_emergencia_telefone', true,
       nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '') is null) is null then
    raise exception 'TELEFONE_INVALIDO:contato_emergencia_telefone';
  end if;

  v_metodo := p_dados ->> 'metodo_pagamento';
  if v_metodo is not null and v_metodo not in ('pix', 'manual') then
    v_metodo := null;
  end if;

  if p_tipo = 'equipante' then
    if lower(coalesce(p_dados ->> 'esta_afastado', '')) in ('true', 't', 'sim')
       and nullif(btrim(coalesce(p_dados ->> 'igreja', '')), '') is null then
      raise exception 'IGREJA_OBRIGATORIA';
    end if;

    v_cpf := nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '');

    if v_cpf is not null then
      select * into v_atual
        from public.equipantes q
       where regexp_replace(coalesce(q.cpf,''), '\D', '', 'g') = v_cpf
       limit 1;
    end if;

    if v_atual.id is not null then
      if coalesce(v_atual.inscrito, false) then
        raise exception 'JA_INSCRITO';
      end if;

      v_e := jsonb_populate_record(v_atual, p_dados);

      update public.equipantes set
        nome                         = v_nome,
        sexo                         = v_e.sexo,
        data_nascimento              = v_e.data_nascimento,
        whatsapp                     = v_e.whatsapp,
        telefone_residencial         = v_e.telefone_residencial,
        telefone                     = v_e.telefone,
        tem_problema_saude           = v_e.tem_problema_saude,
        condicoes_medicas            = v_e.condicoes_medicas,
        tem_restricao_alimentar      = v_e.tem_restricao_alimentar,
        restricoes_alimentares       = v_e.restricoes_alimentares,
        igreja                       = v_e.igreja,
        igreja_outra                 = v_e.igreja_outra,
        e_pastor                     = v_e.e_pastor,
        e_pastor_outro               = v_e.e_pastor_outro,
        pastor_nome                  = v_e.pastor_nome,
        esta_afastado                = v_e.esta_afastado,
        cargo_igreja                 = v_e.cargo_igreja,
        cargo_igreja_outro           = v_e.cargo_igreja_outro,
        frequenta_ebd                = v_e.frequenta_ebd,
        frequenta_grupo_cuidado      = v_e.frequenta_grupo_cuidado,
        voce_canta                   = v_e.voce_canta,
        toca_instrumento             = v_e.toca_instrumento,
        familiar_trabalhando         = v_e.familiar_trabalhando,
        familiar_trabalhando_outro   = v_e.familiar_trabalhando_outro,
        parentesco                   = v_e.parentesco,
        familiar_nome                = v_e.familiar_nome,
        qual_radical_acampante       = v_e.qual_radical_acampante,
        qual_radical_acampante_outro = v_e.qual_radical_acampante_outro,
        numero_edicao_participou     = v_e.numero_edicao_participou,
        ja_trabalhou_equipe          = v_e.ja_trabalhou_equipe,
        edicao_trabalhou             = v_e.edicao_trabalhou,
        autorizacao_imagem           = v_e.autorizacao_imagem,
        contato_emergencia_nome      = v_e.contato_emergencia_nome,
        contato_emergencia_telefone  = v_e.contato_emergencia_telefone,
        area_trabalho_opcao1         = v_e.area_trabalho_opcao1,
        area_trabalho_opcao2         = v_e.area_trabalho_opcao2,
        area_trabalho_opcao3         = v_e.area_trabalho_opcao3,
        area_trabalho_extra          = v_e.area_trabalho_extra,
        tipo                         = 'equipante',
        status                       = 'pendente',
        scale_status                 = 'pendente',
        inscrito                     = true,
        numero_edicao                = v_edicao,
        metodo_pagamento             = v_metodo,
        status_pagamento             = 'pendente',
        data_pagamento               = null,
        id_transacao_sicoob          = null,
        txid_pix                     = null,
        parental_auth_file_url       = null,
        decidido_por                 = null,
        decidido_por_tipo            = null,
        decidido_por_igreja          = null,
        decidido_em                  = null,
        inscrito_em                  = now(),
        ficha_confirmada_em          = now()
      where id = v_atual.id;

      return jsonb_build_object('id', v_atual.id, 'reinscricao', true);
    end if;

    v_e := jsonb_populate_record(null::public.equipantes, p_dados);
    v_e.id := v_id;
    v_e.nome := v_nome;
    v_e.tipo := 'equipante';
    v_e.metodo_pagamento := v_metodo;
    v_e.status_pagamento := 'pendente';
    v_e.data_pagamento := null;
    v_e.id_transacao_sicoob := null;
    v_e.txid_pix := null;
    v_e.parental_auth_file_url := null;
    v_e.status := 'pendente';
    v_e.scale_status := 'pendente';
    v_e.numero_edicao := v_edicao;
    v_e.inscrito := true;
    v_e.decidido_por := null;
    v_e.decidido_por_tipo := null;
    v_e.decidido_por_igreja := null;
    v_e.decidido_em := null;
    v_e.created_at := now();
    v_e.inscrito_em := now();
    v_e.ficha_confirmada_em := now();
    insert into public.equipantes select (v_e).*;
    return jsonb_build_object('id', v_id, 'reinscricao', false);
  end if;

  if coalesce(p_dados ->> 'contato_emergencia_nome', '') ~ '[0-9]'
     or length(regexp_replace(coalesce(p_dados ->> 'contato_emergencia_nome', ''), '[[:space:]''.-]', '', 'g')) < 2 then
    raise exception 'CONTATO_NOME_INVALIDO';
  end if;
  if public.unaccent_simples(lower(btrim(regexp_replace(coalesce(p_dados ->> 'contato_emergencia_nome', ''), '\s+', ' ', 'g'))))
     = public.unaccent_simples(lower(btrim(regexp_replace(coalesce(p_dados ->> 'nome', ''), '\s+', ' ', 'g')))) then
    raise exception 'CONTATO_MESMO_NOME';
  end if;
  if public._telefone_normalizado(p_dados ->> 'contato_emergencia_telefone', true,
       nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '') is null)
     = public._telefone_normalizado(p_dados ->> 'whatsapp', false,
       nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '') is null) then
    raise exception 'CONTATO_MESMO_TELEFONE';
  end if;

  if upper(btrim(coalesce(p_dados ->> 'tamanho_camisa', ''))) not in ('PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG') then
    raise exception 'CAMISA_OBRIGATORIA';
  end if;

  v_a := jsonb_populate_record(null::public.acampantes, p_dados);
  v_a.id := v_id;
  v_a.nome := v_nome;
  v_a.metodo_pagamento := v_metodo;
  v_a.status_pagamento := 'pendente';
  v_a.data_pagamento := null;
  v_a.id_transacao_sicoob := null;
  v_a.txid_pix := null;
  v_a.observacoes_organizador := null;
  v_a.grupo_trailha := public._escolher_grupo_trailha(v_a.sexo, v_a.cargo_igreja, v_a.nome,
    case when v_a.conhecido_no_projeto is distinct from 'NÃO TENHO' then v_a.nome_familiar_conhecido end);
  insert into public.acampantes select (v_a).*;

  return jsonb_build_object('id', v_id, 'reinscricao', false);
end;
$function$;

-- ------------------------------------------------------------------ formulario
create or replace function public.opcoes_de_igreja()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'lista', coalesce((select jsonb_agg(i.codigo || ' - ' || i.nome order by i.codigo::int)
                         from public.igrejas_parceiras i
                        where i.na_lista and i.codigo ~ '^\d+$'), '[]'::jsonb),
    'novas', coalesce((select jsonb_agg(i.codigo || ' - ' || i.nome order by lpad(i.codigo, 4, '0'))
                         from public.igrejas_parceiras i where i.criada_pela_tela), '[]'::jsonb),
    'extras', coalesce((select jsonb_agg(x.nome order by x.nome) from public.igrejas_extras x), '[]'::jsonb),
    'permite_outra', coalesce((select c.permite_igreja_outra from public.configuracoes c
                                order by c.edicao_numero desc limit 1), true),
    'permite_diversos', coalesce((select c.permite_igreja_diversos from public.configuracoes c
                                   order by c.edicao_numero desc limit 1), true),
    'exige_ficha_completa', coalesce((select c.exige_ficha_completa from public.configuracoes c
                                       order by c.edicao_numero desc limit 1), false));
$function$;

-- ------------------------------------------------------------------ virada
-- A virada liga a ficha completa (vale da edicao 38 em diante).
create or replace function public._ligar_ficha_completa_na_virada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.edicao_numero is distinct from old.edicao_numero and new.edicao_numero > old.edicao_numero then
    new.exige_ficha_completa := true;
  end if;
  return new;
end;
$$;

drop trigger if exists ligar_ficha_completa_na_virada on public.configuracoes;
create trigger ligar_ficha_completa_na_virada
  before update of edicao_numero on public.configuracoes
  for each row execute function public._ligar_ficha_completa_na_virada();
