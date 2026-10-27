-- ---------------------------------------------------------------------------
-- Fotografos no grupo de WhatsApp da trilha (27/10/2026, Patrick).
--
-- O fotografo escalado com cor fica "debaixo do guarda-chuva" da equipe de
-- trilha daquela cor. Ele passa a ter DOIS grupos:
--   1) o grupo da Fotografia (exclusivo dos fotografos) -- como ja era;
--   2) o grupo da trilha da sua cor -- o MESMO link que o responsavel/lider da
--      trilha salva para a cor (grupos_lider das equipes Guia/Invisivel/Marcador
--      daquela cor). Nada novo para salvar: o link vem de la.
--
-- Regras (Patrick):
--  - fotografo SEM cor: so o grupo da Fotografia;
--  - o responsavel/lider da trilha ve os fotografos da cor dele num bloco a
--    parte, identificados como fotografos, com convite e "ja esta no grupo"
--    (sem chamada: a presenca do fotografo e na reuniao da Fotografia);
--  - mudou a cor do fotografo, muda o link (e o estado do grupo da cor antiga
--    deixa de valer: a linha guarda a cor e so conta se for a cor atual).
--
-- O link da trilha so aparece para o fotografo quando o da Fotografia
-- apareceria (_grupo_liberado: presente na reuniao ou escala oficial).
-- ---------------------------------------------------------------------------

create table if not exists public.grupo_trilha_fotografo (
  escala_id          uuid primary key references public.escalas(id) on delete cascade,
  cor                text not null,
  aberto_em          timestamptz,
  nao_conseguiu_em   timestamptz,
  no_grupo_em        timestamptz,
  convite_enviado_em timestamptz
);
alter table public.grupo_trilha_fotografo enable row level security;
revoke all on public.grupo_trilha_fotografo from anon, authenticated;

-- Link do grupo da trilha de uma cor: o que foi salvo nas equipes por cor da
-- trilha (Guia, Invisivel, Marcador) daquela cor. Espirito Santo, Inimigo e
-- Pastor Invisivel sao uma equipe so para todas as cores: nao contam.
create or replace function public._grupo_trilha_link(p_cor text)
returns text language sql stable security definer set search_path = public as $$
  select g.link
    from public.grupos_lider g
    join public.escalas l on l.id = g.escala_id
   where p_cor is not null
     and public._area_trilha(l.area_alocada) and public._equipe_por_cor(l.area_alocada)
     and l.cor = p_cor
   order by g.atualizado_em desc nulls last
   limit 1;
$$;

-- O grupo da trilha de uma participacao na Fotografia (null se nao for
-- fotografo com cor). O estado so vale se foi gravado para a cor atual.
create or replace function public._grupo_trilha_fotografo(p_escala uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when s.area_alocada = 'Fotografia' and s.cor is not null then
           jsonb_build_object(
             'cor', s.cor,
             'link', case when public._grupo_liberado(s.id) then public._grupo_trilha_link(s.cor) end,
             'aberto_em', f.aberto_em,
             'pedido_em', f.nao_conseguiu_em,
             'no_grupo_em', f.no_grupo_em)
         end
    from public.escalas s
    left join public.grupo_trilha_fotografo f on f.escala_id = s.id and f.cor = s.cor
   where s.id = p_escala;
$$;

-- Fotografos de uma cor, para a lista do responsavel/lider da trilha.
create or replace function public._fotografos_da_trilha(p_cor text, p_quem uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'escala_id', s.id,
           'equipante_id', q.id,
           'nome', q.nome,
           'igreja', q.igreja,
           'igreja_outra', q.igreja_outra,
           'whatsapp', q.whatsapp,
           'estrangeiro', nullif(regexp_replace(coalesce(q.cpf,''), '\D', '', 'g'), '') is null,
           'area', s.area_alocada,
           'atuacao', s.atuacao,
           'cor', s.cor,
           'eh_lider', public._eh_lider(s.area_alocada, s.atuacao),
           'eu', q.id = p_quem,
           'convite_enviado_em', f.convite_enviado_em,
           'grupo_aberto_em', f.aberto_em,
           'grupo_pedido_em', f.nao_conseguiu_em,
           'no_grupo_em', f.no_grupo_em)
         order by q.nome), '[]'::jsonb)
    from public.escalas s
    join public.equipantes q on q.id = s.equipante_id
    left join public.grupo_trilha_fotografo f on f.escala_id = s.id and f.cor = s.cor
   where p_cor is not null and s.area_alocada = 'Fotografia' and s.cor = p_cor;
$$;

-- O lider/responsavel conduz alguma equipe da trilha da cor deste fotografo?
create or replace function public._fotografo_na_trilha_de(p_lider uuid, p_escala uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.escalas s
      join public._equipes_do(p_lider) e on public._area_trilha(e.area) and e.cor = s.cor
     where s.id = p_escala and s.area_alocada = 'Fotografia' and s.cor is not null);
$$;

-- Garante a linha do estado na cor atual; se a cor mudou, zera o estado antigo.
create or replace function public._grupo_trilha_fotografo_linha(p_escala uuid, p_cor text)
returns void language sql security definer set search_path = public as $$
  insert into public.grupo_trilha_fotografo (escala_id, cor) values (p_escala, p_cor)
  on conflict (escala_id) do update
    set cor = excluded.cor,
        aberto_em = case when public.grupo_trilha_fotografo.cor = excluded.cor then public.grupo_trilha_fotografo.aberto_em end,
        nao_conseguiu_em = case when public.grupo_trilha_fotografo.cor = excluded.cor then public.grupo_trilha_fotografo.nao_conseguiu_em end,
        no_grupo_em = case when public.grupo_trilha_fotografo.cor = excluded.cor then public.grupo_trilha_fotografo.no_grupo_em end,
        convite_enviado_em = case when public.grupo_trilha_fotografo.cor = excluded.cor then public.grupo_trilha_fotografo.convite_enviado_em end;
$$;

revoke all on function public._grupo_trilha_link(text) from public, anon, authenticated;
revoke all on function public._grupo_trilha_fotografo(uuid) from public, anon, authenticated;
revoke all on function public._fotografos_da_trilha(text, uuid) from public, anon, authenticated;
revoke all on function public._fotografo_na_trilha_de(uuid, uuid) from public, anon, authenticated;
revoke all on function public._grupo_trilha_fotografo_linha(uuid, text) from public, anon, authenticated;

-- Fotografo: abriu o link do grupo da trilha ('abriu'), "Nao consegui entrar"
-- ('nao_consegui') ou desfaz ('consegui').
create or replace function public.equipante_grupo_trilha(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_escala_id uuid, p_acao text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cor text;
begin
  if not public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('ok', false, 'erro', 'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;
  select s.cor into v_cor from public.escalas s
   where s.id = p_escala_id and s.equipante_id = p_id and s.area_alocada = 'Fotografia';
  if v_cor is null then
    return jsonb_build_object('ok', false, 'erro', 'Participação não encontrada.');
  end if;
  if p_acao not in ('abriu', 'nao_consegui', 'consegui') then
    return jsonb_build_object('ok', false, 'erro', 'Ação inválida.');
  end if;

  perform public._grupo_trilha_fotografo_linha(p_escala_id, v_cor);
  update public.grupo_trilha_fotografo
     set aberto_em = case when p_acao = 'abriu' then coalesce(aberto_em, now()) else aberto_em end,
         nao_conseguiu_em = case p_acao when 'nao_consegui' then now() when 'consegui' then null else nao_conseguiu_em end,
         no_grupo_em = case when p_acao = 'nao_consegui' then null else no_grupo_em end
   where escala_id = p_escala_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Lider/responsavel da trilha: convite enviado ('convite'), "ja esta no
-- grupo" ('no_grupo') ou desmarca ('fora_do_grupo'). O convite conta no mesmo
-- limite de envios em 24 h do convite da equipe.
create or replace function public.lider_grupo_trilha_fotografo(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_escala_id uuid, p_acao text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  v_cor text;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if not public._fotografo_na_trilha_de(p_id, p_escala_id) then
    return jsonb_build_object('ok', false, 'erro', 'Este fotógrafo não está na cor do seu grupo.');
  end if;
  if p_acao not in ('convite', 'no_grupo', 'fora_do_grupo') then
    return jsonb_build_object('ok', false, 'erro', 'Ação inválida.');
  end if;
  select s.cor into v_cor from public.escalas s where s.id = p_escala_id;

  if p_acao = 'convite' then
    if (select (public._envios_do_lider(p_id)->>'usados')::int) >= public._limite_envios_convite() then
      return jsonb_build_object('ok', false, 'limite', true,
        'erro', 'Limite de ' || public._limite_envios_convite() || ' envios em 24 horas atingido.',
        'envios', public._envios_do_lider(p_id));
    end if;
    perform public._grupo_trilha_fotografo_linha(p_escala_id, v_cor);
    update public.grupo_trilha_fotografo set convite_enviado_em = now() where escala_id = p_escala_id;
    insert into public.grupo_envios_lider (lider_id, escala_id) values (p_id, p_escala_id);
    return jsonb_build_object('ok', true, 'envios', public._envios_do_lider(p_id));
  end if;

  perform public._grupo_trilha_fotografo_linha(p_escala_id, v_cor);
  update public.grupo_trilha_fotografo
     set no_grupo_em = case when p_acao = 'no_grupo' then now() end,
         nao_conseguiu_em = case when p_acao = 'no_grupo' then null else nao_conseguiu_em end
   where escala_id = p_escala_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.equipante_grupo_trilha(uuid, text, text, date, uuid, text) from public;
revoke all on function public.lider_grupo_trilha_fotografo(uuid, text, text, date, uuid, text) from public;
grant execute on function public.equipante_grupo_trilha(uuid, text, text, date, uuid, text) to anon, authenticated;
grant execute on function public.lider_grupo_trilha_fotografo(uuid, text, text, date, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Patches em funcoes existentes (pg_get_functiondef + replace; erro se o
-- trecho nao for encontrado exatamente uma vez).
-- ---------------------------------------------------------------------------
create or replace function pg_temp._patch(p_fn regprocedure, p_de text, p_para text)
returns void language plpgsql as $fn$
declare
  d text := pg_get_functiondef(p_fn);
  n int := (length(d) - length(replace(d, p_de, ''))) / length(p_de);
begin
  if n <> 1 then
    raise exception 'patch %: esperava 1 ocorrencia de [%], achou %', p_fn, left(p_de, 80), n;
  end if;
  execute replace(d, p_de, p_para);
end;
$fn$;

-- Tela do equipante: cada participacao na Fotografia com cor leva o grupo da trilha.
select pg_temp._patch('public.revelar_area(uuid,text,text,date)'::regprocedure,
$a$'no_grupo_em', (select w.no_grupo_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id))$a$,
$b$'no_grupo_em', (select w.no_grupo_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id),
             'grupo_trilha', public._grupo_trilha_fotografo(s.id))$b$);
select pg_temp._patch('public.equipante_grupos(uuid,text,text,date)'::regprocedure,
$a$'no_grupo_em', (select w.no_grupo_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id))$a$,
$b$'no_grupo_em', (select w.no_grupo_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id),
             'grupo_trilha', public._grupo_trilha_fotografo(s.id))$b$);

-- Relacao do lider: as equipes da trilha com cor levam os fotografos da cor.
select pg_temp._patch('public.relacao_lider(uuid,text,text,date)'::regprocedure,
$a$'pode_trocar_cor', e.area = 'Fotografia' or public._area_trilha(e.area),$a$,
$b$'pode_trocar_cor', e.area = 'Fotografia' or public._area_trilha(e.area),
           'fotografos', case when public._area_trilha(e.area) and e.cor is not null
                              then public._fotografos_da_trilha(e.cor, p_id) end,$b$);

-- Assinatura: muda quando um fotografo da cor entra, sai, troca de cor ou
-- mexe no grupo (a lista do responsavel da trilha atualiza sozinha).
select pg_temp._patch('public._assinatura_relacao(uuid)'::regprocedure,
$a$|| '@' || coalesce(($a$,
$b$|| '$' || coalesce((
      select string_agg(s.id::text || ',' || coalesce(s.cor, '') || ',' || coalesce(s.atuacao, '') || ','
                        || coalesce(f.aberto_em::text, '-') || coalesce(f.nao_conseguiu_em::text, '-')
                        || coalesce(f.no_grupo_em::text, '-') || coalesce(f.convite_enviado_em::text, '-'), '/' order by s.id)
        from public.escalas s
        left join public.grupo_trilha_fotografo f on f.escala_id = s.id and f.cor = s.cor
       where s.area_alocada = 'Fotografia'
         and s.cor in (select e.cor from public._equipes_do(p_id) e where public._area_trilha(e.area) and e.cor is not null)), '')
    || '@' || coalesce(($b$);
