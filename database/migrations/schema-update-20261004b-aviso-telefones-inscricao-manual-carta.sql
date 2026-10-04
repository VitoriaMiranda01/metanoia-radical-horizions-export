-- =============================================================================
-- Tres pedidos da organizacao (04/10/2026)
--
-- 1. AVISO DE TELEFONES DOS ACAMPANTES: 6 acampantes tem o telefone de
--    emergencia fora do padrao (fichas antigas, de antes da protecao de
--    03/10). A Raquel liga e corrige; o aviso aparece para ela em Gerenciar
--    Inscricoes e para a conta Desenvolvedores (com o recado de que e a
--    Raquel quem esta cuidando). Os outros logins recebem null. A conta e
--    feita aqui, entao o aviso some sozinho quando a ultima ficha e corrigida.
--
-- 2. INSCRICAO MANUAL DE EQUIPANTE: Raquel, Eduardo (Dudu) e Desenvolvedores
--    cadastram quem nao se inscreveu pelo link (ex.: cartas de menores que
--    chegaram em maos). So o nome e obrigatorio. A ficha ja entra aprovada
--    (vai para a escala), com pagamento manual pendente (aparece em
--    Pagamentos) e registra quem fez.
--
-- 3. VINCULAR CARTA: no modulo "Autorizacoes dos menores", "Tenho a carta"
--    passa a valer tambem para quem nunca anexou nem declarou -- a carta em
--    maos da organizacao fica registrada na ficha (entregue + conferida).
--    "Desfazer" continua derrubando tudo quando nao ha arquivo.
-- =============================================================================

alter table public.equipantes
  add column if not exists inscricao_manual_por text,
  add column if not exists inscricao_manual_em timestamptz;

comment on column public.equipantes.inscricao_manual_por is
  'Organizador que cadastrou a ficha na mao (inscricao_manual_equipante).';


-- Nome do organizador logado, ou null.
create or replace function public._nome_organizador_logado()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select (select nome from public._organizador_do_cracha());
$$;

revoke all on function public._nome_organizador_logado() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 1. Aviso dos telefones dos acampantes
-- -----------------------------------------------------------------------------
create or replace function public.telefones_acampantes_pendentes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_nome text := lower(coalesce(public._nome_organizador_logado(), ''));
  v_itens jsonb;
begin
  if v_nome not in ('raquel', 'desenvolvedores') then
    return null;
  end if;

  select coalesce(jsonb_agg(t order by t.nome), '[]'::jsonb) into v_itens
  from (
    select a.id, a.nome, a.whatsapp, a.contato_emergencia_nome,
           a.contato_emergencia_telefone, a.admin_responsavel, a.igreja,
           nullif(regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g'), '') is null as estrangeiro,
           array_remove(array[
             case when public._telefone_normalizado(a.contato_emergencia_telefone, true,
                         nullif(regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g'), '') is null) is null
                  then 'contato_emergencia_telefone' end,
             case when public._telefone_normalizado(a.whatsapp, false,
                         nullif(regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g'), '') is null) is null
                  then 'whatsapp' end
           ], null) as campos
      from public.acampantes a
  ) t
  where cardinality(t.campos) > 0;

  return jsonb_build_object(
    'perfil', case when v_nome = 'raquel' then 'raquel' else 'desenvolvedores' end,
    'itens', v_itens);
end;
$$;

revoke all on function public.telefones_acampantes_pendentes() from public, anon;
grant execute on function public.telefones_acampantes_pendentes() to authenticated;


-- -----------------------------------------------------------------------------
-- 2. Inscricao manual de equipante
-- -----------------------------------------------------------------------------
create or replace function public.pode_inscrever_manual()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(public._nome_organizador_logado(), ''))
         in ('raquel', 'eduardo', 'desenvolvedores');
$$;

revoke all on function public.pode_inscrever_manual() from public, anon;
grant execute on function public.pode_inscrever_manual() to authenticated;


create or replace function public.inscricao_manual_equipante(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quem   text := public._nome_organizador_logado();
  v_nome   text := regexp_replace(btrim(coalesce(p_dados ->> 'nome', '')), '\s+', ' ', 'g');
  v_whats  text := nullif(btrim(coalesce(p_dados ->> 'whatsapp', '')), '');
  v_cpf    text := nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '');
  v_nasc   date;
  v_sexo   text := nullif(p_dados ->> 'sexo', '');
  v_igreja text := nullif(btrim(coalesce(p_dados ->> 'igreja', '')), '');
  v_outra  text := nullif(upper(regexp_replace(btrim(coalesce(p_dados ->> 'igreja_outra', '')), '\s+', ' ', 'g')), '');
  v_carta  boolean := coalesce((p_dados ->> 'carta_recebida')::boolean, false);
  v_edicao int;
  v_atual  public.equipantes%rowtype;
  v_id     uuid;
  v_areas  text[];
begin
  if not public.pode_inscrever_manual() then
    return jsonb_build_object('ok', false, 'erro',
      'Só Raquel, Eduardo e Desenvolvedores fazem inscrição manual.');
  end if;

  if length(v_nome) < 3 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o nome da pessoa.');
  end if;

  begin
    v_nasc := nullif(p_dados ->> 'data_nascimento', '')::date;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Data de nascimento inválida.');
  end;

  if v_sexo is not null and v_sexo not in ('Masculino', 'Feminino') then
    v_sexo := null;
  end if;
  if v_cpf is not null and length(v_cpf) <> 11 then
    return jsonb_build_object('ok', false, 'erro', 'O CPF precisa ter 11 dígitos (ou deixe em branco).');
  end if;
  -- O formulario usa a mascara brasileira; confere aqui antes de gravar
  -- qualquer coisa (o gatilho de telefone e mais frouxo para ficha sem CPF).
  if v_whats is not null then
    v_whats := public._telefone_normalizado(v_whats, false, false);
    if v_whats is null then
      return jsonb_build_object('ok', false, 'erro',
        'O WhatsApp está incompleto ou com dígitos a mais. Ex.: (21) 99999-9999 — ou deixe em branco.');
    end if;
  end if;

  if v_igreja is not null and upper(v_igreja) <> 'OUTRA' then
    v_outra := null;
  end if;

  select array_agg(a) into v_areas
    from (select nullif(btrim(coalesce(p_dados ->> k, '')), '') a
            from unnest(array['area_trabalho_opcao1', 'area_trabalho_opcao2', 'area_trabalho_opcao3']) k) s;

  select c.edicao_numero into v_edicao from public.configuracoes c limit 1;

  -- Mesmo CPF: ja inscrito nesta edicao -> avisa; de edicao anterior -> reaproveita a ficha.
  if v_cpf is not null then
    select * into v_atual from public.equipantes q
     where regexp_replace(coalesce(q.cpf, ''), '\D', '', 'g') = v_cpf
     limit 1;
    if v_atual.id is not null and coalesce(v_atual.inscrito, false) then
      return jsonb_build_object('ok', false, 'erro',
        format('Esse CPF já está inscrito (%s).', v_atual.nome), 'id', v_atual.id);
    end if;
  end if;

  v_id := coalesce(v_atual.id, gen_random_uuid());

  if v_atual.id is null then
    insert into public.equipantes (id, tipo) values (v_id, 'equipante');
  end if;

  -- Ficha de edicao anterior: o que nao foi preenchido agora fica como estava.
  update public.equipantes set
    nome                 = v_nome,
    cpf                  = v_cpf,
    data_nascimento      = coalesce(v_nasc, data_nascimento),
    sexo                 = coalesce(v_sexo, sexo),
    whatsapp             = coalesce(v_whats, whatsapp),
    igreja               = coalesce(v_igreja, igreja),
    igreja_outra         = case when v_igreja is null then igreja_outra else v_outra end,
    esta_afastado        = case when v_igreja is null then esta_afastado
                                when v_igreja like 'NÃO SE APLICA%' then false
                                else true end,
    area_trabalho_opcao1 = coalesce(v_areas[1], area_trabalho_opcao1),
    area_trabalho_opcao2 = coalesce(v_areas[2], area_trabalho_opcao2),
    area_trabalho_opcao3 = coalesce(v_areas[3], area_trabalho_opcao3),
    tipo                 = 'equipante',
    inscrito             = true,
    numero_edicao        = v_edicao,
    status               = 'aprovado',
    scale_status         = 'pendente',
    decidido_por         = v_quem,
    decidido_por_tipo    = 'organizador',
    decidido_por_igreja  = null,
    decidido_em          = now(),
    metodo_pagamento     = 'manual',
    status_pagamento     = 'pendente',
    data_pagamento       = null,
    txid_pix             = null,
    id_transacao_sicoob  = null,
    parental_auth_file_url        = null,
    autorizacao_entregue_em       = case when v_carta then now() end,
    autorizacao_conferida_em      = case when v_carta then now() end,
    autorizacao_conferida_por     = case when v_carta then v_quem end,
    autorizacao_conferida_por_tipo = case when v_carta then 'organizador' end,
    area_vista_em        = null,
    inscricao_manual_por = v_quem,
    inscricao_manual_em  = now()
  where id = v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'reaproveitou', v_atual.id is not null);
end;
$$;

revoke all on function public.inscricao_manual_equipante(jsonb) from public, anon;
grant execute on function public.inscricao_manual_equipante(jsonb) to authenticated;


-- -----------------------------------------------------------------------------
-- 3. "Tenho a carta" tambem para quem nunca anexou nem declarou
-- -----------------------------------------------------------------------------
do $m$
declare
  d text;
  ancora constant text :=
'    if v_alvo.parental_auth_file_url is null and v_alvo.autorizacao_entregue_em is null then
      return jsonb_build_object(''ok'', false, ''erro'',
        ''Este menor ainda não anexou nem declarou a entrega da autorização.'');
    end if;

    update public.equipantes set
      autorizacao_conferida_em       = now(),';
begin
  d := pg_get_functiondef('public.conferir_autorizacao_menor(uuid,boolean)'::regprocedure);
  if (length(d) - length(replace(d, ancora, ''))) / length(ancora) <> 1 then
    raise exception 'trecho nao encontrado (ou repetido) em conferir_autorizacao_menor';
  end if;
  execute replace(d, ancora,
'    -- Carta em maos de quem confere, sem o menor ter anexado nem declarado
    -- (20261004b): a carta fica vinculada a ficha como entregue.
    update public.equipantes set
      autorizacao_entregue_em        = coalesce(autorizacao_entregue_em,
                                         case when parental_auth_file_url is null then now() end),
      autorizacao_conferida_em       = now(),');
end;
$m$;
