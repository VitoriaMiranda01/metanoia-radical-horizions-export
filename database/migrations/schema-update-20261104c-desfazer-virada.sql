-- Desfazer a virada de edicao (04/11/2026, Patrick)
--
-- "Resetar Inscricoes para Nova Edicao" passa a guardar uma copia de tudo o
-- que ela apaga ou altera. Enquanto nenhuma inscricao entrar na edicao nova
-- (nenhum equipante com inscrito = true, nenhum acampante), a conta
-- Desenvolvedores pode voltar tudo como estava antes da virada.
--
--  * A copia fica em virada_desfazer (uma linha so, tabela fechada: tem dados
--    pessoais e de saude). Some sozinha na primeira inscricao (gatilhos em
--    equipantes e acampantes), ao desfazer, ou e trocada na proxima virada.
--  * Tabelas SUBSTITUIDAS inteiras (apagar o que ha + reinserir a copia): as
--    que a virada apaga, as que caem em cascata por chave estrangeira
--    (calculadas pelo catalogo, entao tabela filha nova entra sozinha),
--    responsaveis_reuniao (apagada por gatilho de escalas) e as que a virada
--    preenche (debitos, acampantes que ja participaram, LGPD das edicoes).
--  * Tabelas ATUALIZADAS linha a linha pelo id: equipantes, cupons,
--    configuracoes, onibus_config, recepcao_chamada.
--  * Na restauracao os gatilhos do usuario ficam desligados (so dentro da
--    transacao): sem isso a regra do Guia duplicaria a Recepcao, as
--    validacoes recusariam fichas antigas e a auditoria registraria tudo de
--    novo. As chaves estrangeiras continuam valendo.
--  * Equipante que a LGPD apagou/limpou depois da virada nao volta.

create table if not exists public.virada_desfazer (
  id               boolean primary key default true check (id),
  edicao_anterior  int,
  nova_edicao      int not null,
  feita_em         timestamptz not null default now(),
  substituir       text[] not null,     -- ordem: pai antes de filho
  dados            jsonb not null,      -- {tabela: [linhas]}
  atualizar        jsonb not null       -- {tabela: [linhas]}
);
alter table public.virada_desfazer enable row level security;
revoke all on public.virada_desfazer from public, anon, authenticated;

-- Tabelas que a restauracao substitui inteiras, pai antes de filho.
create or replace function public._virada_tabelas_substituir()
returns text[] language plpgsql stable security definer
set search_path to 'public' as $$
declare
  v_resto  text[];
  v_ordem  text[] := '{}';
  v_prontas text[];
begin
  with recursive base(t) as (
    select ('public.' || x)::regclass from unnest(array[
      'cobrancas_equipantes', 'portaria_entradas', 'portaria_cartas', 'portaria_observacoes',
      'recepcao_presencas', 'onibus_pessoas', 'crachas_impressos',
      'lotes_alocacao_automatica', 'escalas', 'pix_sicoob', 'pagamentos',
      'acampantes_vinculos', 'acampantes', 'responsaveis_reuniao',
      'debitos_equipantes', 'acampantes_ja_participaram', 'lgpd_edicoes']) x
  ), alc(t) as (
    select t from base
    union
    select c.conrelid from pg_constraint c join alc on c.confrelid = alc.t
     where c.contype = 'f' and c.connamespace = 'public'::regnamespace
  )
  select array_agg(c.relname::text order by c.relname) into v_resto
    from alc join pg_class c on c.oid = alc.t;

  while coalesce(array_length(v_resto, 1), 0) > 0 loop
    select array_agg(r order by r) into v_prontas
      from unnest(v_resto) r
     where not exists (
       select 1 from pg_constraint c
        where c.contype = 'f'
          and c.conrelid = ('public.' || r)::regclass
          and c.confrelid <> c.conrelid
          and (select p.relname::text from pg_class p where p.oid = c.confrelid) = any(v_resto));
    if v_prontas is null then
      raise exception 'ciclo de chaves estrangeiras entre %', v_resto;
    end if;
    v_ordem := v_ordem || v_prontas;
    v_resto := array(select r from unnest(v_resto) r where r <> all(v_prontas));
  end loop;
  return v_ordem;
end;
$$;
revoke all on function public._virada_tabelas_substituir() from public, anon, authenticated;

-- Tira a copia (chamada pela virada, antes de qualquer mudanca).
create or replace function public._virada_tirar_foto(p_edicao_ant int, p_nova int)
returns void language plpgsql security definer
set search_path to 'public' as $$
declare
  v_tabs  text[] := public._virada_tabelas_substituir();
  v_t     text;
  v_rows  jsonb;
  v_dados jsonb := '{}'::jsonb;
  v_atual jsonb := '{}'::jsonb;
begin
  foreach v_t in array v_tabs loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', v_t)
       into v_rows;
    v_dados := v_dados || jsonb_build_object(v_t, v_rows);
  end loop;
  foreach v_t in array array['equipantes', 'cupons', 'configuracoes', 'onibus_config', 'recepcao_chamada'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', v_t)
       into v_rows;
    v_atual := v_atual || jsonb_build_object(v_t, v_rows);
  end loop;

  insert into public.virada_desfazer (id, edicao_anterior, nova_edicao, feita_em, substituir, dados, atualizar)
  values (true, p_edicao_ant, p_nova, now(), v_tabs, v_dados, v_atual)
  on conflict (id) do update set
    edicao_anterior = excluded.edicao_anterior, nova_edicao = excluded.nova_edicao,
    feita_em = excluded.feita_em, substituir = excluded.substituir,
    dados = excluded.dados, atualizar = excluded.atualizar;
end;
$$;
revoke all on function public._virada_tirar_foto(int, int) from public, anon, authenticated;

-- Primeira inscricao da edicao nova: a copia some.
create or replace function public._virada_desfazer_expira()
returns trigger language plpgsql security definer
set search_path to 'public' as $$
begin
  delete from public.virada_desfazer where id;
  return null;
end;
$$;
revoke all on function public._virada_desfazer_expira() from public, anon, authenticated;

drop trigger if exists virada_desfazer_expira on public.equipantes;
create trigger virada_desfazer_expira
  after insert or update of inscrito on public.equipantes
  for each row when (new.inscrito is true)
  execute function public._virada_desfazer_expira();

drop trigger if exists virada_desfazer_expira on public.acampantes;
create trigger virada_desfazer_expira
  after insert on public.acampantes
  for each row execute function public._virada_desfazer_expira();

-- Tela: da para desfazer?
create or replace function public.virada_desfazer_status()
returns jsonb language plpgsql stable security definer
set search_path to 'public' as $$
declare v_f record;
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('disponivel', false);
  end if;
  select edicao_anterior, nova_edicao, feita_em into v_f from public.virada_desfazer where id;
  if not found
     or (select c.edicao_numero from public.configuracoes c limit 1) is distinct from v_f.nova_edicao
     or exists (select 1 from public.equipantes where inscrito is true)
     or exists (select 1 from public.acampantes) then
    return jsonb_build_object('disponivel', false);
  end if;
  return jsonb_build_object('disponivel', true, 'edicao_anterior', v_f.edicao_anterior,
                            'nova_edicao', v_f.nova_edicao, 'feita_em', v_f.feita_em);
end;
$$;
revoke all on function public.virada_desfazer_status() from public, anon;
grant execute on function public.virada_desfazer_status() to authenticated;

-- Desfazer.
create or replace function public.desfazer_virada()
returns jsonb language plpgsql security definer
set search_path to 'public', 'extensions' as $$
declare
  v_f     record;
  v_t     text;
  v_i     int;
  v_cols  text;
  v_set   text;
  v_todas text[];
  v_n     int;
  v_cont  jsonb := '{}'::jsonb;
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro', 'Só a conta Desenvolvedores desfaz a virada.');
  end if;

  select * into v_f from public.virada_desfazer where id for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro',
      'Não há virada para desfazer (ela só fica disponível até a primeira inscrição da edição nova).');
  end if;
  if (select c.edicao_numero from public.configuracoes c limit 1) is distinct from v_f.nova_edicao then
    return jsonb_build_object('ok', false, 'erro', 'A edição atual não é a da última virada.');
  end if;
  if exists (select 1 from public.equipantes where inscrito is true)
     or exists (select 1 from public.acampantes) then
    delete from public.virada_desfazer where id;
    return jsonb_build_object('ok', false, 'erro',
      'Já houve inscrição na edição nova: a virada não pode mais ser desfeita.');
  end if;

  v_todas := v_f.substituir || array['equipantes', 'cupons', 'configuracoes', 'onibus_config', 'recepcao_chamada'];
  foreach v_t in array v_todas loop
    execute format('alter table public.%I disable trigger user', v_t);
  end loop;

  -- 1. Esvazia as tabelas substituidas (filho antes de pai).
  for v_i in reverse array_upper(v_f.substituir, 1) .. 1 loop
    execute format('delete from public.%I where true', v_f.substituir[v_i]);
  end loop;

  -- 2. Equipantes, cupons, configuracoes... voltam linha a linha (antes das
  --    filhas: escalas e pagamentos dependem dos equipantes que ja existem).
  foreach v_t in array array['equipantes', 'cupons', 'configuracoes', 'onibus_config', 'recepcao_chamada'] loop
    select string_agg(format('%1$I = s.%1$I', a.attname), ', ' order by a.attnum) into v_set
      from pg_attribute a
     where a.attrelid = ('public.' || v_t)::regclass and a.attnum > 0
       and not a.attisdropped and a.attgenerated = '' and a.attidentity = ''
       and a.attname <> 'id';
    execute format(
      'update public.%I t set %s from jsonb_populate_recordset(null::public.%I, $1) s
        where t.id = s.id
          and not exists (select 1 from public.lgpd_apagamentos l
                           where l.codigo::text = s.id::text and l.em >= $2)',
      v_t, v_set, v_t)
      using v_f.atualizar -> v_t, v_f.feita_em;
    get diagnostics v_n = row_count;
    v_cont := v_cont || jsonb_build_object(v_t, v_n);
  end loop;

  -- 3. Reinsere a copia (pai antes de filho).
  foreach v_t in array v_f.substituir loop
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
      from pg_attribute a
     where a.attrelid = ('public.' || v_t)::regclass and a.attnum > 0
       and not a.attisdropped and a.attgenerated = '';
    execute format(
      'insert into public.%I (%s) overriding system value
       select %s from jsonb_populate_recordset(null::public.%I, $1)',
      v_t, v_cols, v_cols, v_t)
      using coalesce(v_f.dados -> v_t, '[]'::jsonb);
    get diagnostics v_n = row_count;
    v_cont := v_cont || jsonb_build_object(v_t, v_n);
  end loop;

  foreach v_t in array v_todas loop
    execute format('alter table public.%I enable trigger user', v_t);
  end loop;

  delete from public.virada_desfazer where id;

  return jsonb_build_object('ok', true,
    'edicao', v_f.edicao_anterior,
    'equipantes', coalesce((v_cont ->> 'equipantes')::int, 0),
    'acampantes', coalesce((v_cont ->> 'acampantes')::int, 0),
    'escalas',    coalesce((v_cont ->> 'escalas')::int, 0),
    'pagamentos', coalesce((v_cont ->> 'pagamentos')::int, 0),
    'tabelas', v_cont);
end;
$$;
revoke all on function public.desfazer_virada() from public, anon;
grant execute on function public.desfazer_virada() to authenticated;

-- Virada: tira a copia antes de mexer em qualquer coisa.
do $$
declare
  v_def  text := pg_get_functiondef(
    'public.resetar_para_nova_edicao(integer,date,date,date,date,date)'::regprocedure);
  v_alvo text := '  -- Pagamento agendado e nao pago: vira debito (20261025e).';
  v_novo text;
begin
  if v_def like '%_virada_tirar_foto%' then return; end if;
  if (length(v_def) - length(replace(v_def, v_alvo, ''))) / length(v_alvo) <> 1 then
    raise exception 'trecho não encontrado (ou repetido) em resetar_para_nova_edicao';
  end if;
  v_novo := replace(v_def, v_alvo,
    E'  -- Copia para desfazer a virada (20261104c).\n'
    || E'  perform public._virada_tirar_foto(v_edicao_ant, p_nova_edicao);\n\n'
    || v_alvo);
  execute v_novo;
end;
$$;
