-- =============================================================================
-- Backup diario (02/10/2026)
--
-- Quem roda e o GitHub Actions do repositorio PRIVADO Patrick-rios/metanoia-backups,
-- todo dia as 03:00 (Brasilia). Ele chama a Edge Function "backup-diario", que:
--
--   1. le TODAS as tabelas do schema public (backup_dados) e a estrutura do
--      banco em SQL (backup_estrutura);
--   2. guarda uma copia comprimida no bucket PRIVADO "backups" deste projeto;
--   3. devolve o arquivo para o GitHub guardar a segunda copia, FORA do Supabase.
--
-- Cada execucao fica registrada em backup_execucoes. E dela que sai o aviso
-- vermelho que a conta "Desenvolvedores" ve no site quando o backup falha ou
-- atrasa (situacao_backup).
--
-- Rotacao, igual nos dois lugares: 7 diarios, 12 semanais (segunda-feira),
-- os de fim de edicao para sempre, e os "retidos" (a copia de ANTES de uma
-- queda brusca de registros) tambem para sempre.
-- =============================================================================

create table if not exists public.backup_execucoes (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null default 'diario' check (tipo in ('diario', 'edicao')),
  data_ref         date not null,
  iniciado_em      timestamptz not null default now(),
  concluido_em     timestamptz,
  status           text not null default 'rodando'
                   check (status in ('rodando', 'ok', 'alerta', 'erro')),
  arquivo          text,
  bytes_json       bigint,
  bytes_gzip       bigint,
  sha256           text,
  contagens        jsonb,
  quedas           jsonb,
  supabase_ok      boolean not null default false,
  github_ok        boolean not null default false,
  github_em        timestamptz,
  erro             text,
  alerta_visto_em  timestamptz,
  alerta_visto_por text
);

create index if not exists backup_execucoes_iniciado_idx
  on public.backup_execucoes (iniciado_em desc);

alter table public.backup_execucoes enable row level security;
revoke all on public.backup_execucoes from public, anon, authenticated;
grant all on public.backup_execucoes to service_role;

-- Bucket privado: sem nenhuma policy, so a service_role (a Edge Function)
-- le e escreve. A policy de envio dos menores esta presa ao bucket dela.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;


-- -----------------------------------------------------------------------------
-- Os dados: todas as tabelas de public, descobertas na hora. Tabela nova
-- entra no backup sozinha, sem ninguem lembrar de mexer aqui.
-- -----------------------------------------------------------------------------
create or replace function public.backup_dados()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_tab    record;
  v_linhas jsonb;
  v_tabs   jsonb := '{}'::jsonb;
begin
  for v_tab in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
     order by c.relname
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from public.%I t',
      v_tab.relname
    ) into v_linhas;
    v_tabs := v_tabs || jsonb_build_object(v_tab.relname, v_linhas);
  end loop;

  return jsonb_build_object(
    'tabelas', v_tabs,
    'storage_buckets', (
      select coalesce(jsonb_agg(to_jsonb(b) order by b.id), '[]'::jsonb)
        from storage.buckets b
    ),
    'storage_objetos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'bucket_id', o.bucket_id, 'name', o.name,
               'created_at', o.created_at, 'updated_at', o.updated_at,
               'metadata', o.metadata
             ) order by o.bucket_id, o.name), '[]'::jsonb)
        from storage.objects o
       where o.bucket_id <> 'backups'
    )
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- A estrutura, em SQL executavel: tabelas, funcoes, restricoes, indices,
-- gatilhos, RLS, policies (public e storage), permissoes e buckets.
--
-- search_path = pg_catalog de proposito: assim o Postgres escreve tudo com o
-- schema na frente (public.equipantes, extensions.crypt...), e o SQL gerado
-- funciona num banco novo sem depender do search_path de quem restaura.
-- -----------------------------------------------------------------------------
create or replace function public.backup_estrutura()
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v     text := '';
  r     record;
  g     record;
  v_txt text;
begin
  v := v || '-- Estrutura do banco Metanoia Radical Serra, gerada em '
         || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
         || E' (Brasilia)\n'
         || E'set check_function_bodies = off;\nset client_min_messages = warning;\n\n';

  -- Extensoes
  v := v || E'-- Extensoes\n';
  for r in
    select e.extname, n.nspname
      from pg_extension e join pg_namespace n on n.oid = e.extnamespace
     where e.extname <> 'plpgsql'
     order by e.extname
  loop
    v := v || format(E'create extension if not exists %I with schema %I;\n', r.extname, r.nspname);
  end loop;

  -- Tabelas (colunas, defaults, not null). Restricoes vem depois das funcoes.
  v := v || E'\n-- Tabelas\n';
  for r in
    select c.oid, c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
     order by c.relname
  loop
    select string_agg(
             format('  %I %s', a.attname, format_type(a.atttypid, a.atttypmod))
             || case when d.adbin is not null then ' default ' || pg_get_expr(d.adbin, d.adrelid) else '' end
             || case when a.attnotnull then ' not null' else '' end,
             E',\n' order by a.attnum)
      into v_txt
      from pg_attribute a
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
     where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped;
    v := v || format(E'create table if not exists public.%I (\n%s\n);\n\n', r.relname, v_txt);
  end loop;

  -- Funcoes
  v := v || E'-- Funcoes\n';
  for r in
    select p.oid
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind in ('f', 'p')
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     order by p.proname, p.oid
  loop
    v := v || pg_get_functiondef(r.oid) || E';\n\n';
  end loop;

  -- Restricoes: chave primaria, unica, check... e por ultimo as estrangeiras
  v := v || E'-- Restricoes\n';
  for r in
    select c.relname, co.conname, pg_get_constraintdef(co.oid) as def
      from pg_constraint co
      join pg_class c on c.oid = co.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and co.contype in ('p', 'u', 'c', 'f', 'x')
     order by (co.contype = 'f'), c.relname, co.conname
  loop
    v := v || format(E'alter table public.%I add constraint %I %s;\n', r.relname, r.conname, r.def);
  end loop;

  -- Indices que nao nascem de uma restricao
  v := v || E'\n-- Indices\n';
  for r in
    select pg_get_indexdef(ix.indexrelid) as def
      from pg_index ix
      join pg_class c on c.oid = ix.indrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and not exists (select 1 from pg_constraint co where co.conindid = ix.indexrelid)
     order by c.relname, ix.indexrelid::regclass::text
  loop
    v := v || r.def || E';\n';
  end loop;

  -- Gatilhos
  v := v || E'\n-- Gatilhos\n';
  for r in
    select pg_get_triggerdef(t.oid, true) as def
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal
     order by c.relname, t.tgname
  loop
    v := v || r.def || E';\n';
  end loop;

  -- RLS
  v := v || E'\n-- Row level security\n';
  for r in
    select c.relname, c.relrowsecurity, c.relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and (c.relrowsecurity or c.relforcerowsecurity)
     order by c.relname
  loop
    if r.relrowsecurity then
      v := v || format(E'alter table public.%I enable row level security;\n', r.relname);
    end if;
    if r.relforcerowsecurity then
      v := v || format(E'alter table public.%I force row level security;\n', r.relname);
    end if;
  end loop;

  -- Policies (public e storage)
  v := v || E'\n-- Policies\n';
  for r in
    select * from pg_policies
     where schemaname in ('public', 'storage')
     order by schemaname, tablename, policyname
  loop
    v := v || format(E'drop policy if exists %I on %I.%I;\n', r.policyname, r.schemaname, r.tablename)
           || format('create policy %I on %I.%I as %s for %s to %s',
                r.policyname, r.schemaname, r.tablename, lower(r.permissive), lower(r.cmd),
                (select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ')
                   from unnest(r.roles) x))
           || case when r.qual is not null then ' using (' || r.qual || ')' else '' end
           || case when r.with_check is not null then ' with check (' || r.with_check || ')' else '' end
           || E';\n';
  end loop;

  -- Permissoes das tabelas: zera e reconcede exatamente o que existe hoje.
  -- (Num projeto Supabase novo, tabela criada ja nasce liberada para
  -- anon/authenticated -- o revoke e o que impede isso.)
  v := v || E'\n-- Permissoes das tabelas\n';
  for r in
    select c.relname, coalesce(c.relacl, acldefault('r', c.relowner)) as acl
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
     order by c.relname
  loop
    v := v || format(E'revoke all on public.%I from public, anon, authenticated, service_role;\n', r.relname);
    for g in
      select case when a.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(a.grantee)) end as quem,
             string_agg(lower(a.privilege_type), ', ' order by a.privilege_type) as privs
        from aclexplode(r.acl) a
       where a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon', 'authenticated', 'service_role')
       group by 1
       order by 1
    loop
      v := v || format(E'grant %s on public.%I to %s;\n', g.privs, r.relname, g.quem);
    end loop;
  end loop;

  -- Permissoes das funcoes
  v := v || E'\n-- Permissoes das funcoes\n';
  for r in
    select p.oid::regprocedure::text as assinatura,
           coalesce(p.proacl, acldefault('f', p.proowner)) as acl
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind in ('f', 'p')
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     order by 1
  loop
    v := v || format(E'revoke all on function %s from public, anon, authenticated, service_role;\n', r.assinatura);
    for g in
      select distinct case when a.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(a.grantee)) end as quem
        from aclexplode(r.acl) a
       where a.privilege_type = 'EXECUTE'
         and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon', 'authenticated', 'service_role'))
       order by 1
    loop
      v := v || format(E'grant execute on function %s to %s;\n', r.assinatura, g.quem);
    end loop;
  end loop;

  -- Buckets
  v := v || E'\n-- Buckets\n';
  for r in select * from storage.buckets order by id loop
    v := v || format(
      E'insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %s, %s, %L) on conflict (id) do nothing;\n',
      r.id, r.name, r.public, coalesce(r.file_size_limit::text, 'null'), r.allowed_mime_types);
  end loop;

  return v;
end;
$$;


-- -----------------------------------------------------------------------------
-- O aviso do site. So a conta "Desenvolvedores" recebe alguma coisa; para
-- qualquer outro login a resposta e null e a tela nao mostra nada.
--
-- Os prazos:
--   - 28h sem um backup completo (Supabase + GitHub) = atrasado. 24h do ciclo
--     mais folga para o atraso normal do agendador do GitHub;
--   - "rodando" ha mais de 30 min = travou no meio;
--   - salvo no Supabase mas o GitHub nao confirmou em 1h = so meia copia.
-- -----------------------------------------------------------------------------
create or replace function public.situacao_backup()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ultima    public.backup_execucoes;
  v_completo  timestamptz;
  v_problemas jsonb := '[]'::jsonb;
begin
  if not public.eh_organizador_maximo() then
    return null;
  end if;

  select * into v_ultima from public.backup_execucoes order by iniciado_em desc limit 1;

  select max(concluido_em) into v_completo
    from public.backup_execucoes
   where status in ('ok', 'alerta') and supabase_ok and github_ok;

  if v_ultima.id is null then
    v_problemas := v_problemas || jsonb_build_array(
      'O backup automático ainda não rodou nenhuma vez.');
  else
    if v_ultima.status = 'erro' then
      v_problemas := v_problemas || jsonb_build_array(
        'A última tentativa de backup falhou: ' || coalesce(v_ultima.erro, 'motivo desconhecido') || '.');
    elsif v_ultima.status = 'rodando' and v_ultima.iniciado_em < now() - interval '30 minutes' then
      v_problemas := v_problemas || jsonb_build_array(
        'O último backup começou e não terminou.');
    elsif v_ultima.status in ('ok', 'alerta') and not v_ultima.github_ok
          and v_ultima.concluido_em < now() - interval '1 hour' then
      v_problemas := v_problemas || jsonb_build_array(
        'O último backup foi salvo no Supabase, mas a cópia do GitHub não confirmou.');
    end if;

    if v_completo is null or v_completo < now() - interval '28 hours' then
      v_problemas := v_problemas || jsonb_build_array(
        case when v_completo is null
             then 'Nenhum backup completo (Supabase + GitHub) até agora.'
             else 'Sem backup completo desde ' ||
                  to_char(v_completo at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI') || '.'
        end);
    end if;
  end if;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_problemas) = 0,
    'problemas', v_problemas,
    'ultimo_completo_em', v_completo,
    'alertas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', e.id, 'data_ref', e.data_ref, 'quedas', e.quedas
             ) order by e.iniciado_em desc), '[]'::jsonb)
        from public.backup_execucoes e
       where e.status = 'alerta' and e.alerta_visto_em is null
    ),
    'recentes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'data_ref', e.data_ref, 'tipo', e.tipo, 'status', e.status,
               'iniciado_em', e.iniciado_em, 'bytes_gzip', e.bytes_gzip,
               'supabase_ok', e.supabase_ok, 'github_ok', e.github_ok, 'erro', e.erro
             ) order by e.iniciado_em desc), '[]'::jsonb)
        from (select * from public.backup_execucoes order by iniciado_em desc limit 10) e
    )
  );
end;
$$;

-- "Estou ciente" de uma queda brusca. Tira o alerta da tela, nao apaga nada:
-- a copia retida continua guardada.
create or replace function public.reconhecer_alerta_backup(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_organizador_maximo() then
    raise exception 'Só a conta Desenvolvedores pode fazer isso.';
  end if;

  update public.backup_execucoes
     set alerta_visto_em = now(),
         alerta_visto_por = (select nome from public._organizador_do_cracha())
   where id = p_id and status = 'alerta';
end;
$$;

revoke all on function public.backup_dados() from public, anon, authenticated;
revoke all on function public.backup_estrutura() from public, anon, authenticated;
grant execute on function public.backup_dados() to service_role;
grant execute on function public.backup_estrutura() to service_role;

revoke all on function public.situacao_backup() from public, anon, authenticated;
revoke all on function public.reconhecer_alerta_backup(uuid) from public, anon, authenticated;
grant execute on function public.situacao_backup() to authenticated;
grant execute on function public.reconhecer_alerta_backup(uuid) to authenticated;
