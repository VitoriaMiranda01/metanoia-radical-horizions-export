-- ---------------------------------------------------------------------------
-- Auditoria leve do que os organizadores mudam (Patrick, 06/10/2026). So a
-- conta Desenvolvedores le.
--
-- Como funciona:
--   * gatilhos POR COMANDO (nao por linha) nas tabelas que os organizadores
--     mexem. So registram quando quem esta logado e um organizador -- a
--     inscricao feita pela propria pessoa, o lider, o webhook do PIX e o
--     backup nao entram;
--   * alteracao guarda so os campos que mudaram: {campo: [antes, depois]};
--     inclusao/exclusao guarda os campos preenchidos (sem id e datas de
--     controle), para dar para recuperar uma ficha apagada;
--   * textos longos sao cortados em 150 caracteres e senha vira "•••";
--   * um comando que mexe em mais de 50 linhas (lancar escala, resetar
--     edicao...) vira UMA linha so, com a quantidade;
--   * de vez em quando (2% das gravacoes) apaga o que tem mais de 180 dias.
--
-- "origem" e o caminho do pedido no site: "rpc/trocar_area_escala" quando
-- veio de uma funcao, ou o nome da tabela quando o site gravou direto.
-- ---------------------------------------------------------------------------

create table if not exists public.auditoria (
  id           bigint generated always as identity primary key,
  em           timestamptz not null default now(),
  organizador  text not null,
  origem       text,
  tabela       text not null,
  operacao     text not null check (operacao in ('incluiu', 'alterou', 'apagou')),
  registro_id  text,
  registro     text,
  mudancas     jsonb,
  qtd          int not null default 1
);
create index if not exists auditoria_em_idx on public.auditoria (em desc);
alter table public.auditoria enable row level security;
revoke all on public.auditoria from anon, authenticated;

-- Valor encurtado, para a auditoria nao crescer com textos enormes.
create or replace function public._aud_valor(p jsonb)
returns jsonb
language sql immutable
set search_path to 'public'
as $fn$
  select case
    when p is null or p = 'null'::jsonb then null
    when jsonb_typeof(p) = 'string' and length(p #>> '{}') > 150
      then to_jsonb(left(p #>> '{}', 150) || '…')
    when jsonb_typeof(p) in ('object', 'array') and length(p::text) > 150
      then to_jsonb(left(p::text, 150) || '…')
    else p
  end;
$fn$;

-- Nome legivel do registro (a pessoa, a area, a igreja...).
create or replace function public._aud_rotulo(p_tabela text, j jsonb)
returns text
language sql stable security definer
set search_path to 'public'
as $fn$
  select case p_tabela
    when 'escalas' then
      (select e.nome from public.equipantes e where e.id::text = j ->> 'equipante_id')
    when 'disponibilidade_extra' then
      (select e.nome from public.equipantes e where e.id::text = j ->> 'equipante_id')
    when 'chamada_escala' then
      (select e.nome from public.escalas s join public.equipantes e on e.id = s.equipante_id
        where s.id::text = j ->> 'escala_id')
    when 'pagamentos' then coalesce(
      (select e.nome from public.equipantes e where e.id::text = j ->> 'equipante_id'),
      (select a.nome from public.acampantes a where a.id::text = j ->> 'acampante_id'))
    when 'configuracoes' then 'Configurações'
    when 'atuacoes_areas' then concat_ws(' · ', j ->> 'area_nome', j ->> 'atuacao')
    else coalesce(j ->> 'nome', j ->> 'area_nome', j ->> 'igreja', j ->> 'codigo')
  end;
$fn$;

-- Inclusao/exclusao: guarda os campos preenchidos da linha.
create or replace function public._aud_gravar(
  p_org text, p_origem text, p_tabela text, p_op text, p_chave text[],
  j jsonb, p_ignorar text[], p_mascara text[])
returns void
language sql
security definer
set search_path to 'public'
as $fn$
  insert into public.auditoria (organizador, origem, tabela, operacao, registro_id, registro, mudancas)
  values (p_org, p_origem, p_tabela, p_op,
          (select string_agg(j ->> k, ',') from unnest(p_chave) k),
          public._aud_rotulo(p_tabela, j),
          (select jsonb_object_agg(k, case when k = any(p_mascara) then '"•••"'::jsonb
                                           else public._aud_valor(v) end)
             from jsonb_each(j) e(k, v)
            where k <> all(p_ignorar) and v <> 'null'::jsonb));
$fn$;

create or replace function public._auditar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_org     text;
  v_origem  text;
  v_chave   text[] := string_to_array(tg_argv[0], ',');
  v_n       int;
  v_op      text := case tg_op when 'INSERT' then 'incluiu' when 'UPDATE' then 'alterou' else 'apagou' end;
  -- Datas de controle e campos que o proprio sistema mexe: so fariam volume.
  v_ignorar text[] := array['id', 'created_at', 'updated_at', 'criado_em', 'criada_em',
                            'atualizado_em', 'ultimo_acesso', 'senha_atualizada_em',
                            'autocorrecoes', 'area_vista_em'];
  v_mascara text[] := array['senha'];
  r         record;
  v_dif     jsonb;
begin
  v_org := public._nome_organizador_logado();
  if v_org is null then
    return null;
  end if;

  v_origem := nullif(ltrim(coalesce(current_setting('request.path', true), ''), '/'), '');

  if tg_op = 'INSERT' then
    select count(*) into v_n from novos;
  else
    select count(*) into v_n from velhos;
  end if;
  if v_n = 0 then
    return null;
  end if;

  if v_n > 50 then
    -- Em massa: conta so as linhas que mudaram de verdade (fora as datas de
    -- controle); se nenhuma mudou, nao registra.
    if tg_op = 'UPDATE' then
      select count(*) into v_n
        from (select to_jsonb(n) - v_ignorar from novos n
              except all
              select to_jsonb(o) - v_ignorar from velhos o) m;
      if v_n = 0 then
        return null;
      end if;
    end if;
    insert into public.auditoria (organizador, origem, tabela, operacao, registro, qtd)
    values (v_org, v_origem, tg_table_name, v_op, v_n || ' registros', v_n);

  elsif tg_op = 'UPDATE' then
    for r in
      select x.a, y.d
        from (select to_jsonb(o) as a from velhos o) x
        join (select to_jsonb(n) as d from novos n) y
          on (select bool_and(x.a -> k = y.d -> k) from unnest(v_chave) k)
    loop
      select jsonb_object_agg(k,
               case when k = any(v_mascara) then '["•••", "•••"]'::jsonb
                    else jsonb_build_array(public._aud_valor(r.a -> k), public._aud_valor(r.d -> k)) end)
        into v_dif
        from jsonb_object_keys(r.d) k
       where k <> all(v_ignorar)
         and (r.a -> k) is distinct from (r.d -> k);
      if v_dif is not null then
        insert into public.auditoria (organizador, origem, tabela, operacao, registro_id, registro, mudancas)
        values (v_org, v_origem, tg_table_name, v_op,
                (select string_agg(r.d ->> k, ',') from unnest(v_chave) k),
                public._aud_rotulo(tg_table_name, r.d), v_dif);
      end if;
    end loop;

  else
    -- novos so existe na inclusao e velhos so na exclusao: cada consulta
    -- fica no seu ramo.
    if tg_op = 'INSERT' then
      for r in select to_jsonb(t) as j from novos t loop
        perform public._aud_gravar(v_org, v_origem, tg_table_name, v_op, v_chave, r.j, v_ignorar, v_mascara);
      end loop;
    else
      for r in select to_jsonb(t) as j from velhos t loop
        perform public._aud_gravar(v_org, v_origem, tg_table_name, v_op, v_chave, r.j, v_ignorar, v_mascara);
      end loop;
    end if;
  end if;

  if random() < 0.02 then
    delete from public.auditoria where em < now() - interval '180 days';
  end if;
  return null;
end;
$fn$;

-- Um gatilho por evento (tabela de transicao so aceita um evento por gatilho).
do $do$
declare
  t record;
begin
  for t in
    select * from (values
      ('acampantes', 'id'), ('equipantes', 'id'), ('escalas', 'id'),
      ('chamada_escala', 'escala_id'), ('disponibilidade_extra', 'equipante_id,area'),
      ('configuracoes', 'id'), ('cupons', 'id'), ('pagamentos', 'id'),
      ('limites_areas', 'id'), ('limites_igrejas', 'id'), ('atuacoes_areas', 'id'),
      ('igrejas_parceiras', 'id'), ('igrejas_extras', 'id'),
      ('organizadores_auth', 'id'), ('solicitacoes_senha', 'id')
    ) as v(tabela, chave)
  loop
    execute format('drop trigger if exists auditoria_i on public.%I', t.tabela);
    execute format('drop trigger if exists auditoria_u on public.%I', t.tabela);
    execute format('drop trigger if exists auditoria_d on public.%I', t.tabela);
    execute format('create trigger auditoria_i after insert on public.%I referencing new table as novos '
                   'for each statement execute function public._auditar(%L)', t.tabela, t.chave);
    execute format('create trigger auditoria_u after update on public.%I referencing old table as velhos new table as novos '
                   'for each statement execute function public._auditar(%L)', t.tabela, t.chave);
    execute format('create trigger auditoria_d after delete on public.%I referencing old table as velhos '
                   'for each statement execute function public._auditar(%L)', t.tabela, t.chave);
  end loop;
end;
$do$;

-- Leitura: so a conta Desenvolvedores (para as outras, null).
create or replace function public.auditoria_listar(
  p_antes       bigint default null,
  p_organizador text default null,
  p_tabela      text default null,
  p_busca       text default null,
  p_limite      int default 50)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $fn$
declare
  v_lim   int := least(greatest(coalesce(p_limite, 50), 1), 200);
  v_itens jsonb;
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
begin
  if lower(coalesce(public._nome_organizador_logado(), '')) <> 'desenvolvedores' then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc), '[]'::jsonb) into v_itens
    from (
      select * from public.auditoria x
       where (p_antes is null or x.id < p_antes)
         and (p_organizador is null or x.organizador = p_organizador)
         and (p_tabela is null or x.tabela = p_tabela)
         and (v_busca is null
              or x.registro ilike '%' || v_busca || '%'
              or x.mudancas::text ilike '%' || v_busca || '%'
              or x.origem ilike '%' || v_busca || '%')
       order by x.id desc
       limit v_lim + 1
    ) a;

  return jsonb_build_object(
    'itens', case when jsonb_array_length(v_itens) > v_lim then v_itens - v_lim else v_itens end,
    'tem_mais', jsonb_array_length(v_itens) > v_lim,
    'organizadores', (select coalesce(jsonb_agg(distinct organizador), '[]'::jsonb) from public.auditoria),
    'total', (select count(*) from public.auditoria));
end;
$fn$;

revoke all on function public._aud_valor(jsonb) from public, anon, authenticated;
revoke all on function public._aud_rotulo(text, jsonb) from public, anon, authenticated;
revoke all on function public._aud_gravar(text, text, text, text, text[], jsonb, text[], text[]) from public, anon, authenticated;
revoke all on function public._auditar() from public, anon, authenticated;
revoke all on function public.auditoria_listar(bigint, text, text, text, int) from public, anon;
grant execute on function public.auditoria_listar(bigint, text, text, text, int) to authenticated;
