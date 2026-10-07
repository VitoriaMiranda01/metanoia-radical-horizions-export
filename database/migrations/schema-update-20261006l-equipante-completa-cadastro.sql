-- ---------------------------------------------------------------------------
-- O proprio equipante completa o cadastro (Patrick, 06/10/2026).
--
-- Ate hoje o acompanhamento so cobrava dois problemas (igreja de quem diz que
-- congrega, e WhatsApp fora do padrao). Sobraram fichas incompletas: 43 sem
-- igreja (de antes de 03/10) e as 71 inscricoes MANUAIS, que entram sem CPF,
-- nascimento, sexo, WhatsApp, familiar e areas de preferencia.
--
-- Agora a ficha tem uma lista de pendencias (_pendencias_equipante) com tudo
-- que o formulario de inscricao exige:
--   igreja      igreja em branco (ou "OUTRA" sem o nome); "nao congrega" vale
--   cpf         sem CPF e sem nacionalidade (estrangeiro informa o pais)
--   nascimento  data de nascimento em branco
--   sexo        em branco
--   telefone    WhatsApp vazio ou fora do padrao
--   parentesco  "conhecido/familiar que vai como acampante" em branco
--   areas       alguma das 3 opcoes de area em branco -- so de quem ainda NAO
--               esta na escala (quem ja foi alocado nao precisa escolher)
-- Ao entrar no acompanhamento, a pessoa completa so o que falta.
--
-- Cadastro manual: o organizador nao tinha CPF nem nascimento para gravar, e
-- por isso a pessoa nao tinha como provar quem e. Passa a valer o NOME COMPLETO
-- enquanto a ficha manual estiver sem CPF e sem nascimento; depois de
-- completada, vale o CPF (ou nome + nascimento), como sempre.
--
-- completar_minha_inscricao: grava SO o que esta pendente (nada do que ja esta
-- certo e trocado), valida tudo antes de gravar qualquer coisa, e registra o
-- que mudou em equipantes.autocorrecoes.
-- reivindicar_cadastro_manual: quem entra com o CPF e nao acha ficha, mas foi
-- inscrito pela organizacao, acha a ficha manual pelo nome.
-- ---------------------------------------------------------------------------

-- CPF valido (digitos verificadores) -- a mesma regra da tela.
create or replace function public._cpf_valido(p text)
returns boolean
language plpgsql
immutable
set search_path to 'public'
as $fn$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  s int;
  r int;
  i int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then
    return false;
  end if;
  for k in 10..11 loop
    s := 0;
    for i in 1 .. k - 1 loop
      s := s + substr(d, i, 1)::int * (k + 1 - i);
    end loop;
    r := (s * 10) % 11;
    if r = 10 then r := 0; end if;
    if r <> substr(d, k, 1)::int then
      return false;
    end if;
  end loop;
  return true;
end;
$fn$;
revoke all on function public._cpf_valido(text) from public, anon, authenticated;


-- Pendencias da ficha do equipante.
create or replace function public._pendencias_equipante(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  e public.equipantes;
  v jsonb := '[]'::jsonb;
  v_cpf text;
  v_estrangeiro boolean;
begin
  select * into e from public.equipantes where id = p_id and tipo = 'equipante';
  if e.id is null then
    return v;
  end if;

  v_cpf := nullif(regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g'), '');
  -- So e estrangeiro quem ja informou a nacionalidade. Quem ainda nao tem CPF
  -- nem nacionalidade e tratado como brasileiro (formato de telefone mais
  -- exigente) ate dizer o contrario.
  v_estrangeiro := v_cpf is null and nullif(btrim(coalesce(e.nacionalidade, '')), '') is not null;

  if nullif(btrim(coalesce(e.igreja, '')), '') is null
     or (upper(btrim(e.igreja)) = 'OUTRA' and length(btrim(coalesce(e.igreja_outra, ''))) < 3)
     or e.esta_afastado is null then
    v := v || jsonb_build_array(jsonb_build_object('tipo', 'igreja'));
  end if;

  if v_cpf is null and nullif(btrim(coalesce(e.nacionalidade, '')), '') is null then
    v := v || jsonb_build_array(jsonb_build_object('tipo', 'cpf'));
  end if;

  if e.data_nascimento is null then
    v := v || jsonb_build_array(jsonb_build_object('tipo', 'nascimento'));
  end if;

  if nullif(btrim(coalesce(e.sexo, '')), '') is null then
    v := v || jsonb_build_array(jsonb_build_object('tipo', 'sexo'));
  end if;

  if public._telefone_normalizado(e.whatsapp, false, v_estrangeiro) is null then
    v := v || jsonb_build_array(jsonb_build_object(
      'tipo', 'telefone', 'valor', coalesce(e.whatsapp, ''), 'estrangeiro', v_estrangeiro));
  end if;

  if nullif(btrim(coalesce(e.parentesco, '')), '') is null then
    v := v || jsonb_build_array(jsonb_build_object('tipo', 'parentesco'));
  end if;

  if (nullif(btrim(coalesce(e.area_trabalho_opcao1, '')), '') is null
      or nullif(btrim(coalesce(e.area_trabalho_opcao2, '')), '') is null
      or nullif(btrim(coalesce(e.area_trabalho_opcao3, '')), '') is null)
     and not exists (select 1 from public.escalas s where s.equipante_id = p_id) then
    v := v || jsonb_build_array(jsonb_build_object('tipo', 'areas'));
  end if;

  return v;
end;
$fn$;
revoke all on function public._pendencias_equipante(uuid) from public, anon, authenticated;


-- Prova de dono (equipante ou acampante). Regra nova (3): ficha MANUAL ainda
-- sem CPF e sem nascimento -- vale o nome completo.
create or replace function public._inscricao_e_sua(
  p_tipo text, p_id uuid, p_cpf text, p_nome text, p_nascimento date default null)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_cpf_linha   text;
  v_nome_linha  text;
  v_nasc_linha  date;
  v_manual      boolean := false;
  v_cpf_dado    text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_normal      text;
begin
  if p_id is null then return false; end if;

  if p_tipo = 'equipante' then
    select regexp_replace(coalesce(e.cpf,''), '\D', '', 'g'),
           coalesce(e.nome,''), e.data_nascimento, e.inscricao_manual_em is not null
      into v_cpf_linha, v_nome_linha, v_nasc_linha, v_manual
      from public.equipantes e where e.id = p_id;
  else
    select regexp_replace(coalesce(a.cpf,''), '\D', '', 'g'),
           coalesce(a.nome,''), a.data_nascimento
      into v_cpf_linha, v_nome_linha, v_nasc_linha
      from public.acampantes a where a.id = p_id;
  end if;

  if not found then return false; end if;

  -- 1. CPF: prova mais forte, e sozinha basta.
  if v_cpf_dado <> '' and v_cpf_linha <> '' and v_cpf_dado = v_cpf_linha then
    return true;
  end if;

  v_normal := public.unaccent_simples(
                lower(btrim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g'))));

  -- 3. Ficha manual que ainda nao foi completada (sem CPF e sem nascimento
  --    gravados): a organizacao nao tinha esses dados, entao so o nome
  --    completo prova. Some assim que a pessoa completa o cadastro.
  if v_manual and v_cpf_linha = '' and v_nasc_linha is null then
    return v_normal <> ''
       and v_normal = public.unaccent_simples(
                        lower(btrim(regexp_replace(v_nome_linha, '\s+', ' ', 'g'))));
  end if;

  -- 2. Sem CPF, a prova e nome completo E data de nascimento -- as duas.
  if p_nascimento is null or v_nasc_linha is null then
    return false;
  end if;

  if v_nasc_linha <> p_nascimento then
    return false;
  end if;

  return v_normal <> ''
     and v_normal = public.unaccent_simples(
                      lower(btrim(regexp_replace(v_nome_linha, '\s+', ' ', 'g'))));
end;
$fn$;


-- Entrada pela verificacao: alem do que ja devolvia, diz se ha fichas manuais
-- a completar (ha_manuais, quando o CPF nao achou ninguem) e se a ficha achada
-- pelo nome e uma manual ainda nao completada (completar_manual: nao tem
-- nascimento para confirmar).
create or replace function public.verificar_inscricao(
  p_tipo text, p_cpf text default null, p_nome text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_id uuid; v_nome text; v_status text; v_inscrito boolean; v_pago boolean;
  v_completar boolean := false;
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_normal text := public.unaccent_simples(
                     lower(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'))));
begin
  if v_cpf = '' and v_normal = '' then
    return jsonb_build_object('existe', false, 'pago', false);
  end if;

  if p_tipo = 'equipante' then
    select e.id, e.nome, e.status_pagamento, coalesce(e.inscrito, false),
           (e.inscricao_manual_em is not null
            and nullif(regexp_replace(coalesce(e.cpf,''), '\D', '', 'g'), '') is null
            and e.data_nascimento is null)
      into v_id, v_nome, v_status, v_inscrito, v_completar
    from public.equipantes e
    where (v_cpf <> '' and regexp_replace(coalesce(e.cpf,''), '\D', '', 'g') = v_cpf)
       or (v_cpf =  '' and public.unaccent_simples(
             lower(btrim(regexp_replace(coalesce(e.nome,''), '\s+', ' ', 'g')))) = v_normal)
    limit 1;
  else
    select a.id, a.nome, a.status_pagamento, null::boolean
      into v_id, v_nome, v_status, v_inscrito
    from public.acampantes a
    where (v_cpf <> '' and regexp_replace(coalesce(a.cpf,''), '\D', '', 'g') = v_cpf)
       or (v_cpf =  '' and public.unaccent_simples(
             lower(btrim(regexp_replace(coalesce(a.nome,''), '\s+', ' ', 'g')))) = v_normal)
    limit 1;
  end if;

  if v_id is null then
    return jsonb_build_object(
      'existe', false, 'pago', false,
      'ha_manuais', p_tipo = 'equipante' and v_cpf <> '' and exists (
        select 1 from public.equipantes e
         where e.inscricao_manual_em is not null
           and nullif(regexp_replace(coalesce(e.cpf,''), '\D', '', 'g'), '') is null));
  end if;

  v_pago := lower(coalesce(v_status, '')) in ('pago', 'confirmado', 'completed');

  if v_pago then
    return jsonb_build_object('existe', true, 'pago', true, 'inscrito', v_inscrito);
  end if;

  return jsonb_build_object(
    'existe', true, 'pago', false,
    'id', v_id, 'nome', v_nome, 'inscrito', v_inscrito,
    'completar_manual', coalesce(v_completar, false)
  );
end;
$fn$;


-- Quem entrou com um CPF que nao existe, mas foi inscrito pela organizacao:
-- acha a ficha manual (sem CPF) pelo nome completo. So devolve o id e o nome;
-- o CPF so e gravado depois, por completar_minha_inscricao.
create or replace function public.reivindicar_cadastro_manual(p_cpf text, p_nome text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_cpf    text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_normal text := public.unaccent_simples(
                     lower(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'))));
  v_ids    uuid[];
  v_nome   text;
begin
  if not public._cpf_valido(v_cpf) then
    return jsonb_build_object('ok', false, 'erro', 'CPF inválido.');
  end if;
  if length(v_normal) < 5 or position(' ' in v_normal) = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o seu nome completo (nome e sobrenome).');
  end if;
  if exists (select 1 from public.equipantes e
              where regexp_replace(coalesce(e.cpf,''), '\D', '', 'g') = v_cpf) then
    return jsonb_build_object('ok', false, 'erro',
      'Já existe uma inscrição com este CPF. Volte e use a verificação de inscrição.');
  end if;

  select array_agg(e.id), min(e.nome) into v_ids, v_nome
    from public.equipantes e
   where e.inscricao_manual_em is not null
     and nullif(regexp_replace(coalesce(e.cpf,''), '\D', '', 'g'), '') is null
     and public.unaccent_simples(lower(btrim(regexp_replace(coalesce(e.nome,''), '\s+', ' ', 'g')))) = v_normal;

  if v_ids is null then
    return jsonb_build_object('ok', false, 'erro',
      'Não achamos uma inscrição feita pela organização com esse nome. Confira como o nome foi escrito ou procure a organização.');
  end if;
  if array_length(v_ids, 1) > 1 then
    return jsonb_build_object('ok', false, 'erro',
      'Há mais de uma inscrição com esse nome. Procure a organização para completar a sua.');
  end if;

  return jsonb_build_object('ok', true, 'id', v_ids[1], 'nome', v_nome);
end;
$fn$;


-- A pessoa completa SO o que esta pendente. Valida tudo antes de gravar.
-- p_dados (chaves opcionais): igreja, igreja_outra, cpf, sem_cpf,
-- nacionalidade, data_nascimento, sexo, whatsapp, parentesco, familiar_nome,
-- area1, area2, area3.
create or replace function public.completar_minha_inscricao(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  e public.equipantes;
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  v_pend jsonb;
  v_log jsonb;
  v_cpf_dono text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_agora timestamptz := now();

  -- o que sera gravado (nulo = nao mexe)
  s_igreja text; s_outra text; s_afastado boolean; s_igreja_set boolean := false;
  s_cpf text; s_nac text; s_nasc date; s_sexo text; s_tel text;
  s_parentesco text; s_familiar text; s_a1 text; s_a2 text; s_a3 text;

  v_cpf_final text;
  v_nac_final text;
  v_estrangeiro boolean;
  v_tmp text;
  v_idade int;
  v_lista text[] := array['NÃO TENHO', 'CÔNJUGE', 'PAI', 'MÃE', 'FILHO', 'TIO / TIA',
                          'CUNHADO / CUNHADA', 'IRMÃO / IRMÃ', 'OUTRO FAMILIAR (DESCREVA)'];
begin
  if not public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;

  select * into e from public.equipantes where id = p_id and tipo = 'equipante' for update;
  if e.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  v_log := coalesce(e.autocorrecoes, '[]'::jsonb);
  v_pend := public._pendencias_equipante(p_id);
  v_cpf_final := nullif(regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g'), '');
  v_nac_final := nullif(btrim(coalesce(e.nacionalidade, '')), '');

  -- Igreja -----------------------------------------------------------------
  if v_pend @> '[{"tipo":"igreja"}]' and btrim(coalesce(d ->> 'igreja', '')) <> '' then
    s_igreja := btrim(d ->> 'igreja');
    if length(s_igreja) > 150 then
      return jsonb_build_object('ok', false, 'erro', 'Nome da igreja muito longo.');
    end if;
    if upper(s_igreja) = 'OUTRA' then
      s_outra := upper(regexp_replace(btrim(coalesce(d ->> 'igreja_outra', '')), '\s+', ' ', 'g'));
      if length(s_outra) < 3 then
        return jsonb_build_object('ok', false, 'erro', 'Escreva o nome da sua igreja.');
      end if;
    end if;
    s_afastado := s_igreja <> 'NÃO SE APLICA (NÃO CONGREGA)';
    s_igreja_set := true;
  end if;

  -- CPF ou nacionalidade ----------------------------------------------------
  if v_pend @> '[{"tipo":"cpf"}]' and (d ? 'cpf' or d ? 'sem_cpf') then
    if coalesce((d ->> 'sem_cpf')::boolean, false) then
      if v_cpf_dono is not null then
        return jsonb_build_object('ok', false, 'erro',
          'Você entrou com o CPF. Informe o mesmo CPF.');
      end if;
      s_nac := upper(btrim(coalesce(d ->> 'nacionalidade', '')));
      if s_nac !~ '^[A-Z]{2}$' or s_nac = 'BR' then
        return jsonb_build_object('ok', false, 'erro', 'Escolha a sua nacionalidade.');
      end if;
      v_nac_final := s_nac;
    else
      v_tmp := regexp_replace(coalesce(d ->> 'cpf', ''), '\D', '', 'g');
      if not public._cpf_valido(v_tmp) then
        return jsonb_build_object('ok', false, 'erro', 'CPF inválido. Confira os números.');
      end if;
      if v_cpf_dono is not null and v_tmp <> v_cpf_dono then
        return jsonb_build_object('ok', false, 'erro',
          'O CPF precisa ser o mesmo com que você entrou.');
      end if;
      if exists (select 1 from public.equipantes q
                  where q.id <> p_id and regexp_replace(coalesce(q.cpf, ''), '\D', '', 'g') = v_tmp) then
        return jsonb_build_object('ok', false, 'erro',
          'Este CPF já está em outra inscrição. Procure a organização.');
      end if;
      s_cpf := substr(v_tmp, 1, 3) || '.' || substr(v_tmp, 4, 3) || '.' || substr(v_tmp, 7, 3) || '-' || substr(v_tmp, 10, 2);
      v_cpf_final := v_tmp;
    end if;
  end if;

  -- Nascimento --------------------------------------------------------------
  if v_pend @> '[{"tipo":"nascimento"}]' and btrim(coalesce(d ->> 'data_nascimento', '')) <> '' then
    begin
      s_nasc := (d ->> 'data_nascimento')::date;
    exception when others then
      return jsonb_build_object('ok', false, 'erro', 'Confira a data de nascimento.');
    end;
    v_idade := extract(year from age(current_date, s_nasc));
    if s_nasc > current_date or v_idade < 10 or v_idade > 100 then
      return jsonb_build_object('ok', false, 'erro',
        'Confira a data de nascimento: a idade que ela dá não parece certa.');
    end if;
  end if;

  -- Sexo --------------------------------------------------------------------
  if v_pend @> '[{"tipo":"sexo"}]' and btrim(coalesce(d ->> 'sexo', '')) <> '' then
    s_sexo := btrim(d ->> 'sexo');
    if s_sexo not in ('Masculino', 'Feminino') then
      return jsonb_build_object('ok', false, 'erro', 'Escolha o sexo na lista.');
    end if;
  end if;

  -- WhatsApp (valida depois do CPF/nacionalidade: o formato depende deles) ---
  if v_pend @> '[{"tipo":"telefone"}]' and btrim(coalesce(d ->> 'whatsapp', '')) <> '' then
    v_estrangeiro := v_cpf_final is null and v_nac_final is not null;
    s_tel := public._telefone_normalizado(d ->> 'whatsapp', false, v_estrangeiro);
    if s_tel is null then
      return jsonb_build_object('ok', false, 'erro',
        'Confira o WhatsApp: precisa ter DDD e o número completo, ex.: (21) 99999-9999.');
    end if;
  end if;

  -- Familiar / conhecido acampante -----------------------------------------
  if v_pend @> '[{"tipo":"parentesco"}]' and btrim(coalesce(d ->> 'parentesco', '')) <> '' then
    s_parentesco := btrim(d ->> 'parentesco');
    if not (s_parentesco = any (v_lista)) then
      return jsonb_build_object('ok', false, 'erro', 'Escolha uma opção da lista.');
    end if;
    if s_parentesco = 'NÃO TENHO' then
      s_familiar := '';
    else
      s_familiar := btrim(coalesce(d ->> 'familiar_nome', ''));
      if length(s_familiar) < 2 or length(s_familiar) > 150 then
        return jsonb_build_object('ok', false, 'erro', 'Escreva o nome do conhecido / familiar.');
      end if;
    end if;
  end if;

  -- Areas de trabalho (3 opcoes) --------------------------------------------
  if v_pend @> '[{"tipo":"areas"}]' and (d ? 'area1' or d ? 'area2' or d ? 'area3') then
    s_a1 := btrim(coalesce(d ->> 'area1', ''));
    s_a2 := btrim(coalesce(d ->> 'area2', ''));
    s_a3 := btrim(coalesce(d ->> 'area3', ''));
    if s_a1 = '' or s_a2 = '' or s_a3 = '' then
      return jsonb_build_object('ok', false, 'erro', 'Escolha as 3 opções de área de trabalho.');
    end if;
    if greatest(length(s_a1), length(s_a2), length(s_a3)) > 100 then
      return jsonb_build_object('ok', false, 'erro', 'Área inválida.');
    end if;
    -- Nenhuma area se repete, exceto "Disponível para qualquer área".
    if (s_a1 = s_a2 and s_a1 <> 'Disponível para qualquer área')
       or (s_a1 = s_a3 and s_a1 <> 'Disponível para qualquer área')
       or (s_a2 = s_a3 and s_a2 <> 'Disponível para qualquer área') then
      return jsonb_build_object('ok', false, 'erro',
        'Não repita a mesma área em duas opções (só "Disponível para qualquer área" pode repetir).');
    end if;
  end if;

  -- Tudo certo: grava de uma vez ------------------------------------------------
  begin
    update public.equipantes q set
      igreja         = case when s_igreja_set then s_igreja else q.igreja end,
      igreja_outra   = case when s_igreja_set then s_outra  else q.igreja_outra end,
      esta_afastado  = case when s_igreja_set then s_afastado else q.esta_afastado end,
      cpf            = coalesce(s_cpf, q.cpf),
      nacionalidade  = coalesce(s_nac, q.nacionalidade),
      data_nascimento = coalesce(s_nasc, q.data_nascimento),
      sexo           = coalesce(s_sexo, q.sexo),
      whatsapp       = coalesce(s_tel, q.whatsapp),
      parentesco     = coalesce(s_parentesco, q.parentesco),
      familiar_nome  = case when s_parentesco is not null then s_familiar else q.familiar_nome end,
      area_trabalho_opcao1 = coalesce(s_a1, q.area_trabalho_opcao1),
      area_trabalho_opcao2 = coalesce(s_a2, q.area_trabalho_opcao2),
      area_trabalho_opcao3 = coalesce(s_a3, q.area_trabalho_opcao3)
    where q.id = p_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'erro',
      'Este CPF já está em outra inscrição. Procure a organização.');
  end;

  -- Registro do que a propria pessoa mudou.
  if s_igreja_set then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'igreja', 'antes', e.igreja,
      'depois', s_igreja || case when s_outra is not null then ' — ' || s_outra else '' end, 'em', v_agora));
  end if;
  if s_cpf is not null then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'cpf', 'antes', e.cpf, 'depois', s_cpf, 'em', v_agora));
  end if;
  if s_nac is not null then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'nacionalidade', 'antes', e.nacionalidade, 'depois', s_nac, 'em', v_agora));
  end if;
  if s_nasc is not null then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'data_nascimento', 'antes', e.data_nascimento, 'depois', s_nasc, 'em', v_agora));
  end if;
  if s_sexo is not null then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'sexo', 'antes', e.sexo, 'depois', s_sexo, 'em', v_agora));
  end if;
  if s_tel is not null then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'whatsapp', 'antes', e.whatsapp, 'depois', s_tel, 'em', v_agora));
  end if;
  if s_parentesco is not null then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'parentesco', 'antes', e.parentesco,
      'depois', s_parentesco || case when s_familiar <> '' then ' — ' || s_familiar else '' end, 'em', v_agora));
  end if;
  if s_a1 is not null then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'areas', 'antes', null,
      'depois', s_a1 || ' / ' || s_a2 || ' / ' || s_a3, 'em', v_agora));
  end if;
  if jsonb_array_length(v_log) > coalesce(jsonb_array_length(e.autocorrecoes), 0) then
    update public.equipantes set autocorrecoes = v_log where id = p_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'pendencias', public._pendencias_equipante(p_id),
    'salvo', jsonb_build_object('cpf', v_cpf_final, 'nascimento', s_nasc));
end;
$fn$;


revoke all on function public.reivindicar_cadastro_manual(text, text) from public;
revoke all on function public.completar_minha_inscricao(uuid, text, text, date, jsonb) from public;
grant execute on function public.reivindicar_cadastro_manual(text, text) to anon, authenticated;
grant execute on function public.completar_minha_inscricao(uuid, text, text, date, jsonb) to anon, authenticated;
