-- Liberacao do equipante menor pelo pastor parceiro (05/11/2026, Patrick)
--
-- Acaba a carta de autorizacao do EQUIPANTE menor (a do acampante continua
-- como era). No lugar:
--  * Menor = ainda nao tem 18 anos completos no PRIMEIRO dia do projeto
--    (configuracoes.data_evento_inicio; sem data, hoje) -- _recepcao_menor.
--  * Na inscricao: WhatsApp proprio + nome e WhatsApp do responsavel + so o
--    NOME COMPLETO do acompanhante (um equipante desta edicao). O telefone
--    do acompanhante deixa de ser pedido (a coluna fica, sem uso).
--  * Travas contra burla do responsavel: WhatsApp diferente do proprio (ja
--    havia), e nem o nome nem o WhatsApp do responsavel podem ser de outro
--    inscrito menor de idade.
--  * Aprovar um menor exige a declaracao do pastor (ou do organizador, nas
--    igrejas sem parceiro): fica gravado quem, quando e a versao do texto.
--    Em lote, o menor so entra se o organizador marcar ele (p_menores).
--  * Sem a liberacao o menor nao paga. Mudar de aprovado (rejeitar, voltar
--    para pendente, desfazer lote, virada) apaga a liberacao.
--  * Acompanhante: o sistema procura pelo nome entre os equipantes inscritos
--    da edicao; com varios parecidos o pastor escolhe; acompanhante menor de
--    idade aparece como alerta. Nunca bloqueia a inscricao.
--  * A carta: RPCs de envio/conferencia saem, a policy de envio sai, os
--    arquivos ja enviados vao para a fila de apagar (Edge Function
--    lgpd-arquivos) e os campos das fichas sao limpos.
--
-- Colunas novas SEM not null (criar_inscricao usa jsonb_populate_record).

-- 1. Colunas ---------------------------------------------------------------
alter table public.equipantes
  add column if not exists menor_liberado_em timestamptz,
  add column if not exists menor_liberado_por text,
  add column if not exists menor_liberado_por_tipo text,
  add column if not exists menor_declaracao_versao text,
  add column if not exists acompanhante_equipante_id uuid
    references public.equipantes(id) on delete set null;

-- 2. Liberacao e acompanhante escolhido valem por decisao/edicao -----------
create or replace function public._tg_menor_liberacao()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if (new.status is distinct from old.status and new.status is distinct from 'aprovado')
     or (coalesce(old.inscrito, false) and not coalesce(new.inscrito, false)) then
    new.menor_liberado_em       := null;
    new.menor_liberado_por      := null;
    new.menor_liberado_por_tipo := null;
    new.menor_declaracao_versao := null;
  end if;
  if (coalesce(old.inscrito, false) and not coalesce(new.inscrito, false))
     or new.acompanhante_nome is distinct from old.acompanhante_nome then
    new.acompanhante_equipante_id := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists menor_liberacao on public.equipantes;
create trigger menor_liberacao
  before update on public.equipantes
  for each row execute function public._tg_menor_liberacao();

-- 3. Regra do menor na inscricao -----------------------------------------
create or replace function public._menor_responsavel_erro(p_dados jsonb, p_tipo text)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_nasc date;
  v_menor boolean;
  v_estrangeiro boolean :=
    nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '') is null;
  v_proprio_nome text := public._nome_normalizado(p_dados ->> 'nome');
  v_proprio_cpf text := nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '');
  v_proprio_tel text := public._telefone_normalizado(p_dados ->> 'whatsapp', false, v_estrangeiro);
  v_tel text;
  v_nome_resp text;
  r record;
begin
  begin
    v_nasc := nullif(btrim(coalesce(p_dados ->> 'data_nascimento', '')), '')::date;
  exception when others then
    return null; -- data invalida ja e recusada antes (NASCIMENTO_INVALIDO)
  end;
  if v_nasc is null then
    return null;
  end if;

  -- Equipante: idade no primeiro dia do projeto (20261105a). Acampante: hoje.
  if p_tipo = 'equipante' then
    v_menor := public._recepcao_menor(v_nasc);
  else
    v_menor := extract(year from age((now() at time zone 'America/Sao_Paulo')::date, v_nasc)) < 18;
  end if;
  if not v_menor then
    return null;
  end if;

  for r in
    select * from (values
      ('responsavel_nome', 'responsavel_whatsapp', 'RESPONSAVEL', true),
      ('acompanhante_nome', null, 'ACOMPANHANTE', p_tipo = 'equipante')
    ) as t(campo_nome, campo_tel, prefixo, exige)
  loop
    continue when not r.exige;
    if nullif(btrim(coalesce(p_dados ->> r.campo_nome, '')), '') is null then
      return r.prefixo || '_NOME_OBRIGATORIO';
    end if;
    if not public._nome_pessoa_valido(p_dados ->> r.campo_nome) then
      return r.prefixo || '_NOME_INVALIDO';
    end if;
    if public._nome_normalizado(p_dados ->> r.campo_nome) = v_proprio_nome then
      return r.prefixo || '_MESMO_NOME';
    end if;
    continue when r.campo_tel is null;
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

  -- Travas do equipante menor (20261105a): o responsavel nao pode ser outro
  -- menor inscrito (um amigo se passando por responsavel).
  if p_tipo = 'equipante' then
    v_tel := public._telefone_normalizado(p_dados ->> 'responsavel_whatsapp', false, v_estrangeiro);
    v_nome_resp := public._nome_normalizado(p_dados ->> 'responsavel_nome');
    if exists (
         select 1 from public.equipantes e
          where e.tipo = 'equipante' and coalesce(e.inscrito, false)
            and public._recepcao_menor(e.data_nascimento)
            and (v_proprio_cpf is null or regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g') <> v_proprio_cpf)
            and regexp_replace(coalesce(e.whatsapp, ''), '\D', '', 'g') <> ''
            and right(regexp_replace(e.whatsapp, '\D', '', 'g'), 11) = right(v_tel, 11))
       or exists (
         select 1 from public.acampantes a
          where public._recepcao_menor(a.data_nascimento)
            and (v_proprio_cpf is null or regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g') <> v_proprio_cpf)
            and regexp_replace(coalesce(a.whatsapp, ''), '\D', '', 'g') <> ''
            and right(regexp_replace(a.whatsapp, '\D', '', 'g'), 11) = right(v_tel, 11)) then
      return 'RESPONSAVEL_TELEFONE_DE_MENOR';
    end if;
    if exists (
         select 1 from public.equipantes e
          where e.tipo = 'equipante' and coalesce(e.inscrito, false)
            and public._recepcao_menor(e.data_nascimento)
            and public._nome_normalizado(e.nome) = v_nome_resp)
       or exists (
         select 1 from public.acampantes a
          where public._recepcao_menor(a.data_nascimento)
            and public._nome_normalizado(a.nome) = v_nome_resp) then
      return 'RESPONSAVEL_NOME_DE_MENOR';
    end if;
  end if;

  return null;
end;
$function$;
revoke all on function public._menor_responsavel_erro(jsonb, text) from public, anon, authenticated;

-- 3a. Gatilho validar_ficha: no equipante, "menor" e a idade no 1o dia do
-- projeto, e o WhatsApp do acompanhante deixou de ser obrigatorio.
do $$
declare
  v_def text := pg_get_functiondef('public._validar_ficha'::regproc);
  v_novo text;
begin
  v_novo := replace(v_def,
$t$     and extract(year from age((now() at time zone 'America/Sao_Paulo')::date, (n ->> 'data_nascimento')::date)) < 18 then
    foreach v_campo in array array['responsavel_nome', 'responsavel_whatsapp', 'acompanhante_nome', 'acompanhante_whatsapp'] loop$t$,
$t$     and (case when tg_table_name = 'equipantes'
               then public._recepcao_menor((n ->> 'data_nascimento')::date)
               else extract(year from age((now() at time zone 'America/Sao_Paulo')::date, (n ->> 'data_nascimento')::date)) < 18 end) then
    foreach v_campo in array array['responsavel_nome', 'responsavel_whatsapp', 'acompanhante_nome'] loop$t$);
  if v_novo = v_def then
    raise exception 'trecho nao encontrado em _validar_ficha';
  end if;
  execute v_novo;
end $$;

-- 4. Quem esta decidindo (organizador ou pastor parceiro da igreja) -------
create or replace function public._quem_decide_equipante(p_igreja text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_org    record;
  v_igreja public.igrejas_parceiras%rowtype;
  v_nome   text;
  v_ig     text;
begin
  if public.org_pode('aprovacao_equipe') then
    select * into v_org from public._organizador_do_cracha();
    return jsonb_build_object('ok', true, 'tipo', 'organizador',
      'nome', coalesce(v_org.nome, 'organizador'), 'igreja', null);
  end if;

  if public.eh_parceiro() then
    if p_igreja is null
       or not (split_part(p_igreja, ' - ', 1) = any (public.igrejas_do_parceiro())) then
      return jsonb_build_object('ok', false, 'erro', 'Esta inscrição não é da sua igreja.');
    end if;
    select * into v_igreja from public.igrejas_parceiras i where i.codigo = public.jwt_igreja() limit 1;
    v_nome := coalesce(nullif(btrim(coalesce(v_igreja.responsavel_nome, '')), ''),
                       (select nullif(btrim(pa.responsavel_nome), '')
                          from public.primeiro_acesso_parceiros pa
                         where pa.codigo = v_igreja.codigo),
                       'responsável não identificado');
    v_ig := coalesce((select i2.codigo || ' - ' || i2.nome from public.igrejas_parceiras i2
                       where i2.codigo = split_part(p_igreja, ' - ', 1) limit 1),
                     v_igreja.codigo || ' - ' || v_igreja.nome);
    return jsonb_build_object('ok', true, 'tipo', 'parceiro', 'nome', v_nome, 'igreja', v_ig);
  end if;

  return jsonb_build_object('ok', false, 'erro',
    'Só organizadores e pastores parceiros podem fazer isso.');
end;
$function$;
revoke all on function public._quem_decide_equipante(text) from public, anon, authenticated;

-- 5. Aprovar (um a um) com a declaracao do menor ---------------------------
drop function if exists public.decidir_inscricao(uuid, text);
create or replace function public.decidir_inscricao(p_id uuid, p_status text, p_declaracao_menor boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_status  text := lower(btrim(coalesce(p_status, '')));
  v_alvo    public.equipantes%rowtype;
  v_quem    jsonb;
  v_nome    text;
  v_tipo    text;
  v_ig      text;
  v_quando  timestamptz;
  v_libera  boolean;
begin
  if v_status not in ('aprovado', 'rejeitado', 'pendente') then
    return jsonb_build_object('ok', false, 'erro', 'Situação inválida.');
  end if;

  select * into v_alvo
    from public.equipantes e
   where e.id = p_id and e.tipo = 'equipante';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  -- 20261103c: ficha de edicao anterior (inscrito = false) nao e inscricao.
  if v_alvo.inscrito is not true and v_status <> 'pendente' then
    return jsonb_build_object('ok', false, 'erro',
      'Esta pessoa ainda não se inscreveu nesta edição.');
  end if;

  v_quem := public._quem_decide_equipante(v_alvo.igreja);
  if not (v_quem ->> 'ok')::boolean then
    return jsonb_build_object('ok', false, 'erro',
      case when (v_quem ->> 'erro') like 'Só %' then 'Só organizadores e parceiros podem aprovar ou rejeitar.'
           else v_quem ->> 'erro' end);
  end if;
  v_tipo := v_quem ->> 'tipo';
  v_nome := v_quem ->> 'nome';
  v_ig   := v_quem ->> 'igreja';

  -- Voltar para "pendente" desfaz a decisao: o carimbo sai junto (e a
  -- liberacao do menor, pelo gatilho menor_liberacao).
  if v_status = 'pendente' then
    update public.equipantes set
      status = 'pendente',
      decidido_por = null, decidido_por_tipo = null,
      decidido_por_igreja = null, decidido_em = null
    where id = p_id;

    return jsonb_build_object('ok', true, 'status', 'pendente');
  end if;

  -- Menor (20261105a): aprovar exige a declaracao de quem aprova.
  v_libera := v_status = 'aprovado'
              and public._recepcao_menor(v_alvo.data_nascimento)
              and v_alvo.menor_liberado_em is null;
  if v_libera and p_declaracao_menor is not true then
    return jsonb_build_object('ok', false, 'precisa_declaracao_menor', true, 'erro',
      'Esta pessoa é menor de idade. Para aprovar, confirme a declaração sobre a autorização do responsável.');
  end if;

  v_quando := now();

  update public.equipantes set
    status              = v_status,
    decidido_por        = v_nome,
    decidido_por_tipo   = v_tipo,
    decidido_por_igreja = v_ig,
    decidido_em         = v_quando,
    menor_liberado_em       = case when v_libera then v_quando else menor_liberado_em end,
    menor_liberado_por      = case when v_libera then v_nome else menor_liberado_por end,
    menor_liberado_por_tipo = case when v_libera then v_tipo else menor_liberado_por_tipo end,
    menor_declaracao_versao = case when v_libera then '20261105a' else menor_declaracao_versao end
  where id = p_id;

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'decidido_por', v_nome,
    'decidido_por_tipo', v_tipo,
    'decidido_por_igreja', v_ig,
    'decidido_em', v_quando,
    'menor_liberado', v_libera);
end;
$function$;
revoke all on function public.decidir_inscricao(uuid, text, boolean) from public, anon;
grant execute on function public.decidir_inscricao(uuid, text, boolean) to authenticated;

-- 5a. Liberar (ou tirar a liberacao) sem mudar a aprovacao: menor aprovado
-- por outro caminho (inscricao manual, Só Domingo) ou que perdeu a liberacao.
create or replace function public.liberar_menor(p_id uuid, p_liberar boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_alvo public.equipantes%rowtype;
  v_quem jsonb;
begin
  select * into v_alvo from public.equipantes e where e.id = p_id and e.tipo = 'equipante';
  if not found or v_alvo.inscrito is not true then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada nesta edição.');
  end if;
  if not public._recepcao_menor(v_alvo.data_nascimento) then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição não é de menor de idade.');
  end if;
  v_quem := public._quem_decide_equipante(v_alvo.igreja);
  if not (v_quem ->> 'ok')::boolean then
    return jsonb_build_object('ok', false, 'erro', v_quem ->> 'erro');
  end if;

  if p_liberar is true then
    if v_alvo.status = 'rejeitado' then
      return jsonb_build_object('ok', false, 'erro', 'A inscrição está rejeitada.');
    end if;
    update public.equipantes set
      menor_liberado_em       = now(),
      menor_liberado_por      = v_quem ->> 'nome',
      menor_liberado_por_tipo = v_quem ->> 'tipo',
      menor_declaracao_versao = '20261105a'
    where id = p_id;
    return jsonb_build_object('ok', true, 'liberado', true, 'por', v_quem ->> 'nome');
  end if;

  if lower(coalesce(v_alvo.status_pagamento, '')) in ('pago', 'confirmado', 'completed') then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa já pagou: a liberação não pode ser retirada.');
  end if;
  update public.equipantes set
    menor_liberado_em = null, menor_liberado_por = null,
    menor_liberado_por_tipo = null, menor_declaracao_versao = null
  where id = p_id;
  return jsonb_build_object('ok', true, 'liberado', false);
end;
$function$;
revoke all on function public.liberar_menor(uuid, boolean) from public, anon;
grant execute on function public.liberar_menor(uuid, boolean) to authenticated;

-- 6. Aprovacao em lote: menor so entra se o organizador marcou ------------
drop function if exists public.aprovar_em_lote(uuid[], text, text);
create or replace function public.aprovar_em_lote(p_ids uuid[], p_senha text, p_descricao text, p_menores uuid[] default '{}'::uuid[])
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_org     public.organizadores_auth%rowtype;
  v_ate     timestamptz;
  v_quando  timestamptz := now();
  v_lote    uuid := gen_random_uuid();
  v_ids     uuid[];
  v_menores uuid[];
  v_pedidos int;
  v_aprov   int;
  v_fora    int;
begin
  if not public.org_pode('aprovacao_equipe') then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores podem aprovar em lote.');
  end if;

  select * into v_org from public._organizador_do_cracha();
  if v_org.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Não foi possível identificar o organizador logado.');
  end if;

  v_ids := array(select distinct x from unnest(coalesce(p_ids, '{}'::uuid[])) x);
  v_menores := array(select distinct x from unnest(coalesce(p_menores, '{}'::uuid[])) x where x = any(v_ids));
  v_pedidos := coalesce(cardinality(v_ids), 0);
  if v_pedidos = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Nenhuma inscrição escolhida.');
  end if;
  if v_pedidos > 1000 then
    return jsonb_build_object('ok', false, 'erro', 'Lote grande demais (máximo de 1000 inscrições por vez).');
  end if;

  v_ate := public.login_bloqueado_ate('organizador', v_org.nome);
  if v_ate is not null then
    return jsonb_build_object('ok', false, 'erro',
      'Muitas tentativas de senha. Tente de novo depois das '
      || to_char(v_ate at time zone 'America/Sao_Paulo', 'HH24:MI') || '.');
  end if;

  if v_org.senha is null
     or v_org.senha <> extensions.crypt(coalesce(p_senha, ''), v_org.senha) then
    perform public.registrar_falha_login('organizador', v_org.nome);
    return jsonb_build_object('ok', false, 'erro', 'Senha incorreta.');
  end if;
  perform public.limpar_falhas_login('organizador', v_org.nome);

  -- Menores sem liberacao que o organizador NAO marcou ficam pendentes.
  select count(*) into v_fora
    from public.equipantes e
   where e.id = any(v_ids) and e.tipo = 'equipante' and e.status = 'pendente' and e.inscrito is true
     and public._recepcao_menor(e.data_nascimento) and e.menor_liberado_em is null
     and not (e.id = any(v_menores));

  insert into public.lotes_aprovacao (id, criado_em, criado_por, descricao, total)
  values (v_lote, v_quando, v_org.nome,
          left(coalesce(nullif(btrim(p_descricao), ''), 'Aprovação em lote'), 500), 0);

  with aprovados as (
    update public.equipantes e set
      status              = 'aprovado',
      decidido_por        = v_org.nome,
      decidido_por_tipo   = 'organizador',
      decidido_por_igreja = null,
      decidido_em         = v_quando,
      menor_liberado_em       = case when e.id = any(v_menores) and e.menor_liberado_em is null then v_quando else e.menor_liberado_em end,
      menor_liberado_por      = case when e.id = any(v_menores) and e.menor_liberado_em is null then v_org.nome else e.menor_liberado_por end,
      menor_liberado_por_tipo = case when e.id = any(v_menores) and e.menor_liberado_em is null then 'organizador' else e.menor_liberado_por_tipo end,
      menor_declaracao_versao = case when e.id = any(v_menores) and e.menor_liberado_em is null then '20261105a' else e.menor_declaracao_versao end
    where e.id = any(v_ids) and e.tipo = 'equipante' and e.status = 'pendente' and e.inscrito is true
      and (e.id = any(v_menores) or e.menor_liberado_em is not null
           or not public._recepcao_menor(e.data_nascimento))
    returning e.id, e.nome, e.igreja
  ), guardados as (
    insert into public.lotes_aprovacao_itens (lote_id, equipante_id, nome, igreja)
    select v_lote, a.id, a.nome, a.igreja from aprovados a
    returning 1
  )
  select count(*) into v_aprov from guardados;

  if v_aprov = 0 then
    delete from public.lotes_aprovacao where id = v_lote;
    return jsonb_build_object('ok', true, 'aprovados', 0, 'ignorados', v_pedidos, 'lote', null,
                              'menores_fora', v_fora);
  end if;

  update public.lotes_aprovacao set total = v_aprov where id = v_lote;

  return jsonb_build_object('ok', true, 'lote', v_lote, 'aprovados', v_aprov,
                            'ignorados', v_pedidos - v_aprov, 'menores_fora', v_fora,
                            'por', v_org.nome);
end;
$function$;
revoke all on function public.aprovar_em_lote(uuid[], text, text, uuid[]) from public, anon;
grant execute on function public.aprovar_em_lote(uuid[], text, text, uuid[]) to authenticated;

-- 7. Acompanhante: procura pelo nome entre os equipantes inscritos ---------
-- Nivel 3 = nome igual; 2 = todas as palavras de um estao no outro; 1 =
-- primeiro e ultimo nome iguais. So os do melhor nivel encontrado.
create or replace function public._acompanhante_candidatos(p_menor uuid)
returns table(id uuid, nome text, igreja text, status text, menor boolean, nivel int)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with alvo as (
    select m.id as menor_id, public._nome_normalizado(m.acompanhante_nome) as n
      from public.equipantes m
     where m.id = p_menor and nullif(btrim(coalesce(m.acompanhante_nome, '')), '') is not null
  ), pal as (
    select a.menor_id, a.n,
           array(select w from unnest(string_to_array(a.n, ' ')) w
                  where w <> '' and w not in ('de', 'da', 'do', 'dos', 'das', 'e')) as ws
      from alvo a
  ), cand as (
    select c.id, c.nome, c.igreja, c.status,
           public._recepcao_menor(c.data_nascimento) as menor,
           public._nome_normalizado(c.nome) as cn,
           array(select w from unnest(string_to_array(public._nome_normalizado(c.nome), ' ')) w
                  where w <> '' and w not in ('de', 'da', 'do', 'dos', 'das', 'e')) as cws,
           p.n, p.ws
      from public.equipantes c, pal p
     where c.tipo = 'equipante' and coalesce(c.inscrito, false) and c.id <> p.menor_id
  ), nivelado as (
    select c.*, case
      when c.cn = c.n then 3
      when cardinality(c.ws) >= 2 and cardinality(c.cws) >= 2 and (c.ws <@ c.cws or c.cws <@ c.ws) then 2
      when cardinality(c.ws) >= 2 and cardinality(c.cws) >= 2
           and c.cws[1] = c.ws[1] and c.cws[cardinality(c.cws)] = c.ws[cardinality(c.ws)] then 1
    end as nivel
      from cand c
  )
  select x.id, x.nome, x.igreja, x.status, x.menor, x.nivel
    from nivelado x
   where x.nivel is not null
     and x.nivel = (select max(y.nivel) from nivelado y)
   order by x.nome
   limit 10;
$function$;
revoke all on function public._acompanhante_candidatos(uuid) from public, anon, authenticated;

create or replace function public._acompanhante_do_menor(p_menor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  m public.equipantes%rowtype;
  v_cands jsonb;
  v_n int;
  v_pessoa jsonb;
  v_escolhido boolean := false;
begin
  select * into m from public.equipantes where id = p_menor;
  if m.id is null then
    return null;
  end if;

  if m.acompanhante_equipante_id is not null then
    select jsonb_build_object('id', c.id, 'nome', c.nome, 'igreja', c.igreja, 'status', c.status,
                              'menor', public._recepcao_menor(c.data_nascimento))
      into v_pessoa
      from public.equipantes c
     where c.id = m.acompanhante_equipante_id and c.tipo = 'equipante' and coalesce(c.inscrito, false);
    v_escolhido := v_pessoa is not null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'igreja', x.igreja,
                                               'status', x.status, 'menor', x.menor) order by x.nome), '[]'::jsonb),
         count(*)
    into v_cands, v_n
    from public._acompanhante_candidatos(p_menor) x;

  if v_pessoa is null and v_n = 1 then
    v_pessoa := v_cands -> 0;
  end if;

  return jsonb_build_object(
    'situacao', case
      when v_pessoa is not null and (v_pessoa ->> 'menor')::boolean then 'menor'
      when v_pessoa is not null then 'encontrado'
      when nullif(btrim(coalesce(m.acompanhante_nome, '')), '') is null then 'sem_nome'
      when v_n > 1 then 'varios'
      else 'nao_encontrado' end,
    'escolhido', v_escolhido,
    'pessoa', v_pessoa,
    'candidatos', v_cands);
end;
$function$;
revoke all on function public._acompanhante_do_menor(uuid) from public, anon, authenticated;

-- 7a. Lista dos menores para a tela de aprovacao (tag, declaracao, WhatsApp).
create or replace function public.menores_da_aprovacao()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_org  boolean := public.eh_organizador();
  v_parc boolean := public.eh_parceiro();
  v_cfg  public.configuracoes%rowtype;
  v_quem jsonb;
  v_itens jsonb;
  v_o    record;
  v_ig   public.igrejas_parceiras%rowtype;
begin
  if not (v_org or v_parc) then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores e pastores parceiros.');
  end if;

  select * into v_cfg from public.configuracoes limit 1;

  if v_org then
    select * into v_o from public._organizador_do_cracha();
    v_quem := jsonb_build_object('papel', 'organizador', 'nome', v_o.nome, 'igreja', null);
  else
    select * into v_ig from public.igrejas_parceiras i where i.codigo = public.jwt_igreja() limit 1;
    v_quem := jsonb_build_object('papel', 'parceiro',
      'nome', coalesce(nullif(btrim(coalesce(v_ig.responsavel_nome, '')), ''),
                       (select nullif(btrim(pa.responsavel_nome), '')
                          from public.primeiro_acesso_parceiros pa where pa.codigo = v_ig.codigo)),
      'igreja', v_ig.nome);
  end if;

  select coalesce(jsonb_agg(t order by t.nome), '[]'::jsonb) into v_itens
  from (
    select e.id, e.nome, e.sexo, e.status, e.igreja, e.whatsapp, public.idade(e) as idade,
           e.responsavel_nome, e.responsavel_whatsapp, e.acompanhante_nome,
           e.menor_liberado_em, e.menor_liberado_por, e.menor_liberado_por_tipo,
           public._acompanhante_do_menor(e.id) as acompanhante
      from public.equipantes e
     where e.tipo = 'equipante'
       and coalesce(e.inscrito, false)
       and public._recepcao_menor(e.data_nascimento)
       and (v_org or (e.igreja is not null and split_part(e.igreja, ' - ', 1) = any (public.igrejas_do_parceiro())))
  ) t;

  return jsonb_build_object('ok', true, 'itens', v_itens, 'quem', v_quem,
    'edicao', v_cfg.edicao_numero,
    'evento_inicio', v_cfg.data_evento_inicio, 'evento_fim', v_cfg.data_evento_fim);
end;
$function$;
revoke all on function public.menores_da_aprovacao() from public, anon;
grant execute on function public.menores_da_aprovacao() to authenticated;

-- 7b. Escolher o acompanhante (varios parecidos, ou nome digitado errado).
create or replace function public.definir_acompanhante_menor(p_menor uuid, p_acompanhante uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m public.equipantes%rowtype;
  c public.equipantes%rowtype;
  v_quem jsonb;
begin
  select * into m from public.equipantes e where e.id = p_menor and e.tipo = 'equipante';
  if not found or m.inscrito is not true or not public._recepcao_menor(m.data_nascimento) then
    return jsonb_build_object('ok', false, 'erro', 'Menor de idade não encontrado nesta edição.');
  end if;
  v_quem := public._quem_decide_equipante(m.igreja);
  if not (v_quem ->> 'ok')::boolean then
    return jsonb_build_object('ok', false, 'erro', v_quem ->> 'erro');
  end if;

  if p_acompanhante is null then
    update public.equipantes set acompanhante_equipante_id = null where id = p_menor;
    return jsonb_build_object('ok', true);
  end if;

  select * into c from public.equipantes e where e.id = p_acompanhante and e.tipo = 'equipante';
  if not found or c.inscrito is not true then
    return jsonb_build_object('ok', false, 'erro', 'Escolha um equipante inscrito nesta edição.');
  end if;
  if c.id = m.id then
    return jsonb_build_object('ok', false, 'erro', 'O menor não pode ser o próprio acompanhante.');
  end if;
  if public._recepcao_menor(c.data_nascimento) then
    return jsonb_build_object('ok', false, 'erro', 'O acompanhante precisa ser maior de idade.');
  end if;

  update public.equipantes set acompanhante_equipante_id = c.id where id = p_menor;
  return jsonb_build_object('ok', true, 'nome', c.nome);
end;
$function$;
revoke all on function public.definir_acompanhante_menor(uuid, uuid) from public, anon;
grant execute on function public.definir_acompanhante_menor(uuid, uuid) to authenticated;

-- 7c. Procurar o acompanhante pelo nome (todas as palavras, sem acento).
create or replace function public.buscar_acompanhante(p_menor uuid, p_termo text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  m public.equipantes%rowtype;
  v_quem jsonb;
  v_ws text[];
  v_itens jsonb;
begin
  select * into m from public.equipantes e where e.id = p_menor and e.tipo = 'equipante';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  v_quem := public._quem_decide_equipante(m.igreja);
  if not (v_quem ->> 'ok')::boolean then
    return jsonb_build_object('ok', false, 'erro', v_quem ->> 'erro');
  end if;

  v_ws := array(select w from unnest(string_to_array(public._nome_normalizado(p_termo), ' ')) w
                 where length(w) >= 2 and w not in ('de', 'da', 'do', 'dos', 'das', 'e'));
  if coalesce(cardinality(v_ws), 0) = 0 or length(btrim(coalesce(p_termo, ''))) < 3 then
    return jsonb_build_object('ok', true, 'itens', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(t order by t.nome), '[]'::jsonb) into v_itens
    from (
      select c.id, c.nome, c.igreja, c.status, public._recepcao_menor(c.data_nascimento) as menor
        from public.equipantes c
       where c.tipo = 'equipante' and coalesce(c.inscrito, false) and c.id <> p_menor
         and not exists (select 1 from unnest(v_ws) w
                          where position(w in public._nome_normalizado(c.nome)) = 0)
       order by c.nome
       limit 10
    ) t;
  return jsonb_build_object('ok', true, 'itens', v_itens);
end;
$function$;
revoke all on function public.buscar_acompanhante(uuid, text) from public, anon;
grant execute on function public.buscar_acompanhante(uuid, text) to authenticated;

-- 8. Pagamento, pendencias e acompanhamento: liberacao no lugar da carta ---
create or replace function public._equipante_pode_pagar(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  e public.equipantes;
begin
  select * into e from public.equipantes where id = p_id and tipo = 'equipante';
  if e.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if coalesce(e.status, '') <> 'aprovado' then
    return jsonb_build_object('ok', false, 'erro',
      'Sua inscrição ainda não foi aprovada pela sua igreja. O pagamento abre depois da aprovação e da escala.');
  end if;
  if not coalesce(e.so_domingo, false)
     and ((select escala_lancada_em from public.configuracoes limit 1) is null
          or not exists (select 1 from public.escalas s
                          where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado')) then
    return jsonb_build_object('ok', false, 'erro',
      'O pagamento abre quando a escala sair e você estiver nela. Acompanhe pelo site.');
  end if;
  if public._recepcao_menor(e.data_nascimento) and e.menor_liberado_em is null then
    return jsonb_build_object('ok', false, 'erro',
      'Como você é menor de idade, falta a liberação da sua igreja: o pastor confirma que o seu responsável autorizou a sua participação. Fale com o pastor da sua igreja.');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public._pendencias_relacao(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  e public.equipantes;
  v jsonb := public._pendencias_equipante(p_id);
begin
  select * into e from public.equipantes where id = p_id;
  if e.id is not null
     and public._recepcao_menor(e.data_nascimento)
     and e.menor_liberado_em is null then
    v := v || jsonb_build_array(jsonb_build_object('tipo', 'autorizacao'));
  end if;
  return v;
end;
$function$;

do $$
declare
  v_def text := pg_get_functiondef('public.situacao_inscricao'::regproc);
  v_novo text := v_def;
  v_trechos text[][] := array[
    array[$a$         e.parental_auth_file_url,$a$,
          $b$         e.parental_auth_file_url, e.data_nascimento, e.menor_liberado_em, e.menor_liberado_por,$b$],
    array[$a$  v_menor := coalesce(q.idade, 18) < 18;$a$,
          $b$  v_menor := public._recepcao_menor(q.data_nascimento);$b$],
    array[$a$  v_autorizado := q.parental_auth_file_url is not null
               or q.autorizacao_entregue_em is not null;$a$,
          $b$  v_autorizado := q.menor_liberado_em is not null;$b$],
    array[$a$    'autorizacao_conferida_por',  q.autorizacao_conferida_por,$a$,
          $b$    'autorizacao_conferida_por',  q.autorizacao_conferida_por,
    'menor_liberado',             q.menor_liberado_em is not null,
    'menor_liberado_por',         q.menor_liberado_por,$b$]
  ];
  i int;
begin
  for i in 1 .. array_length(v_trechos, 1) loop
    if position(v_trechos[i][1] in v_novo) = 0 then
      raise exception 'trecho % nao encontrado em situacao_inscricao', i;
    end if;
    v_novo := replace(v_novo, v_trechos[i][1], v_trechos[i][2]);
  end loop;
  execute v_novo;
end $$;

-- 9. Fim da carta do equipante -------------------------------------------
drop function if exists public.registrar_autorizacao_pais(uuid, text, text, text, date);
drop function if exists public.declarar_autorizacao_entregue(uuid, boolean, text, text, date);
drop function if exists public.conferir_autorizacao_menor(uuid, boolean);
drop function if exists public.menores_para_conferencia();
drop policy if exists "Envio da autorizacao dos pais" on storage.objects;

-- Arquivos ja enviados: fila da Edge Function lgpd-arquivos (o modelo em
-- branco fica fora da pasta envios/ e nao sai).
insert into public.lgpd_arquivos_a_apagar (bucket, nome, objeto_id)
select o.bucket_id, o.name, o.id
  from storage.objects o
 where o.bucket_id = 'autorizacao-menor-idade-equipante'
   and o.name like 'envios/%'
on conflict (bucket, nome) do nothing;

update public.equipantes set
  parental_auth_file_url         = null,
  autorizacao_entregue_em        = null,
  autorizacao_conferida_em       = null,
  autorizacao_conferida_por      = null,
  autorizacao_conferida_por_tipo = null
where parental_auth_file_url is not null
   or autorizacao_entregue_em is not null
   or autorizacao_conferida_em is not null
   or autorizacao_conferida_por is not null
   or autorizacao_conferida_por_tipo is not null;

do $$
declare v_url text;
begin
  select url_funcao into v_url from public.lgpd_config limit 1;
  if v_url is not null and exists (select 1 from public.lgpd_arquivos_a_apagar) then
    perform net.http_post(url := v_url, body := '{}'::jsonb,
                          headers := '{"Content-Type": "application/json"}'::jsonb);
  end if;
end $$;
