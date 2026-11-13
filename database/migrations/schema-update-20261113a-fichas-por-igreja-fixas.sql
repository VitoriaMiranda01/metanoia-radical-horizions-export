-- Fichas de acampante por igreja, com "fixo" (13/11/2026, Patrick)
--
--   * Cada igreja cadastrada tem um numero de fichas liberadas
--     (limites_igrejas.limite_maximo). Sem numero = 0: o formulario publico
--     nao aceita acampante dela. O "limite padrao geral"
--     (configuracoes.limite_acampantes_por_igreja) deixa de valer -- a coluna
--     fica, sem uso.
--   * RADICAL 36 (quem ja foi acampante): 100 fichas, fixo. O que nao e
--     igreja cadastrada so tem limite se houver linha.
--   * Organizador logado inscreve mesmo sem ficha (so o publico trava).
--   * limites_igrejas.fixo: a virada de edicao zera (apaga) as linhas que nao
--     sao fixas; as fixas atravessam. O desfazer da virada traz de volta
--     (limites_igrejas entra nas tabelas copiadas inteiras).
--   * Aprovar solicitacao de fichas SUBSTITUI o numero (antes somava). Igreja
--     fixa continua fixa com o numero novo.
--   * Editar/cadastrar igreja: fichas e fixo pela RPC salvar_fichas_igreja;
--     cadastrar_igreja deixa de exigir o limite.
--   * Vale ja nesta edicao: todas as igrejas zeradas, menos o ultimo pedido
--     aprovado de cada uma.

-- 1. Coluna fixo + 0 permitido -----------------------------------------------
alter table public.limites_igrejas add column if not exists fixo boolean not null default false;

do $$
declare r record;
begin
  for r in select c.conname from pg_constraint c
            where c.conrelid = 'public.limites_igrejas'::regclass and c.contype = 'c'
              and pg_get_constraintdef(c.oid) ilike '%limite_maximo%' loop
    execute format('alter table public.limites_igrejas drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.limites_igrejas
  add constraint limites_igrejas_fichas_validas check (limite_maximo between 0 and 1000);

-- 2. Vale JA nesta edicao (Patrick: so havia 1 acampante inscrito) ----------
--    Todas as igrejas cadastradas voltam a 0; quem ja teve pedido de fichas
--    aprovado nesta edicao fica com o ultimo numero aprovado (a aprovacao
--    agora substitui). RADICAL 36 (ex-acampantes): 100 fichas, fixo.
delete from public.limites_igrejas l
 where exists (select 1 from public.igrejas_parceiras i where i.codigo || ' - ' || i.nome = l.igreja);

insert into public.limites_igrejas (igreja, limite_maximo)
select distinct on (s.igreja) s.igreja, s.quantidade_aprovada
  from public.solicitacoes_fichas s
 where s.status = 'aprovada' and s.quantidade_aprovada is not null
   and s.numero_edicao is not distinct from (select c.edicao_numero from public.configuracoes c limit 1)
   and exists (select 1 from public.igrejas_parceiras i where i.codigo || ' - ' || i.nome = s.igreja)
 order by s.igreja, s.decidido_em desc
on conflict (igreja) do nothing;

insert into public.limites_igrejas (igreja, limite_maximo, fixo)
values ('RADICAL 36', 100, true)
on conflict (igreja) do update set limite_maximo = 100, fixo = true,
                                   updated_at = timezone('utc'::text, now());

-- "NNN - RADICAL 38" e afins (igreja cadastrada para quem ja foi acampante):
-- 100 fichas, fixo.
insert into public.limites_igrejas (igreja, limite_maximo, fixo)
select i.codigo || ' - ' || i.nome, 100, true
  from public.igrejas_parceiras i
 where i.nome ~ '^RADICAL \d+$'
on conflict (igreja) do update set limite_maximo = 100, fixo = true,
                                   updated_at = timezone('utc'::text, now());

-- 3. Trava do cadastro de acampante -----------------------------------------
do $$
declare
  v_def  text := pg_get_functiondef('public._acampantes_verificar_limite_igreja()'::regprocedure);
  v_novo text;
begin
  v_novo := regexp_replace(v_def,
    'IF NOT FOUND THEN\s+SELECT limite_acampantes_por_igreja INTO v_limite\s+FROM configuracoes\s+LIMIT 1;\s+END IF;',
    E'IF NOT FOUND THEN\n'
    || E'    -- 13/11/2026: igreja cadastrada sem numero = 0 fichas; o que nao e\n'
    || E'    -- igreja e nao tem linha fica sem limite.\n'
    || E'    v_limite := CASE WHEN EXISTS (SELECT 1 FROM igrejas_parceiras i\n'
    || E'                                   WHERE i.codigo || '' - '' || i.nome = NEW.admin_responsavel)\n'
    || E'                     THEN 0 ELSE NULL END;\n'
    || E'  END IF;\n\n'
    || E'  -- Organizador logado inscreve mesmo sem ficha (13/11/2026).\n'
    || E'  IF public.eh_organizador() THEN\n'
    || E'    RETURN NEW;\n'
    || E'  END IF;');
  if v_novo = v_def then
    raise exception 'trecho não encontrado em _acampantes_verificar_limite_igreja';
  end if;
  execute v_novo;
end $$;

-- 4. Quadro das igrejas: fichas, fixo e inscritos ----------------------------
do $$
declare
  v_def  text := pg_get_functiondef('public.igrejas_cadastro()'::regprocedure);
  v_alvo text := $a$'limite', l.limite_maximo,$a$;
begin
  if position(v_alvo in v_def) = 0 then
    raise exception 'trecho não encontrado em igrejas_cadastro';
  end if;
  execute replace(v_def, v_alvo,
    $b$'limite', coalesce(l.limite_maximo, 0),
               'fichas_fixas', coalesce(l.fixo, false),
               'inscritos', (select count(*) from public.acampantes a
                              where a.admin_responsavel = i.codigo || ' - ' || i.nome),$b$);
end $$;

-- 5. Cadastrar igreja sem limite obrigatorio ---------------------------------
do $$
declare
  v_def  text := pg_get_functiondef('public.cadastrar_igreja(text,text,text,integer)'::regprocedure);
  v_novo text := v_def;
  v_t1   text := $a$  if p_limite is null or p_limite < 1 or p_limite > 1000 then
    return jsonb_build_object('ok', false, 'erro', 'Informe o limite de inscrições (de 1 a 1000).');
  end if;$a$;
  v_t2   text := $a$insert into public.limites_igrejas (igreja, limite_maximo) values (v_full, p_limite)$a$;
  v_t3   text := $a$'limite', p_limite);$a$;
begin
  if position(v_t1 in v_novo) = 0 or position(v_t2 in v_novo) = 0 or position(v_t3 in v_novo) = 0 then
    raise exception 'trecho não encontrado em cadastrar_igreja';
  end if;
  v_novo := replace(v_novo, v_t1, $b$  if p_limite is not null and (p_limite < 0 or p_limite > 1000) then
    return jsonb_build_object('ok', false, 'erro', 'Fichas liberadas: de 0 a 1000.');
  end if;$b$);
  v_novo := replace(v_novo, v_t2,
    $b$insert into public.limites_igrejas (igreja, limite_maximo) select v_full, p_limite where p_limite is not null$b$);
  v_novo := replace(v_novo, v_t3, $b$'limite', coalesce(p_limite, 0));$b$);
  execute v_novo;
end $$;

-- 6. Salvar fichas e fixo de uma igreja -------------------------------------
create or replace function public.salvar_fichas_igreja(p_codigo text, p_fichas integer, p_fixo boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_full text;
  v_n    integer;
begin
  if not (public.eh_organizador_maximo() or public.org_pode('solicitacoes_fichas')) then
    return jsonb_build_object('ok', false, 'erro', 'Sem permissão para mudar as fichas das igrejas.');
  end if;
  if p_fichas is null or p_fichas < 0 or p_fichas > 1000 then
    return jsonb_build_object('ok', false, 'erro', 'Fichas liberadas: de 0 a 1000.');
  end if;
  select i.codigo || ' - ' || i.nome into v_full
    from public.igrejas_parceiras i
   where i.codigo = btrim(coalesce(p_codigo, '')) and i.codigo ~ '^\d+$'
   limit 1;
  if v_full is null then
    return jsonb_build_object('ok', false, 'erro', 'Igreja não encontrada.');
  end if;

  -- Mesma trava por igreja do cadastro de acampante.
  perform pg_advisory_xact_lock(hashtext(v_full));
  insert into public.limites_igrejas (igreja, limite_maximo, fixo)
  values (v_full, p_fichas, coalesce(p_fixo, false))
  on conflict (igreja) do update set limite_maximo = excluded.limite_maximo,
                                     fixo = excluded.fixo,
                                     updated_at = timezone('utc'::text, now());

  select count(*) into v_n from public.acampantes a where a.admin_responsavel = v_full;
  return jsonb_build_object('ok', true, 'igreja', v_full, 'fichas', p_fichas,
                            'fixo', coalesce(p_fixo, false), 'inscritos', v_n);
end;
$fn$;
revoke all on function public.salvar_fichas_igreja(text, integer, boolean) from public, anon;
grant execute on function public.salvar_fichas_igreja(text, integer, boolean) to authenticated;

-- 7. Situacao da igreja nas solicitacoes: sem numero = 0, com fixo -----------
create or replace function public._fichas_situacao(p_igreja text)
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select jsonb_build_object(
    'limite', coalesce((select l.limite_maximo from public.limites_igrejas l where l.igreja = p_igreja), 0),
    'excecao', exists (select 1 from public.limites_igrejas l where l.igreja = p_igreja),
    'fixo', coalesce((select l.fixo from public.limites_igrejas l where l.igreja = p_igreja), false),
    'ocupadas', (select count(*) from public.acampantes a where a.admin_responsavel = p_igreja));
$$;
revoke all on function public._fichas_situacao(text) from public, anon, authenticated;

-- 8. Aprovar substitui (fixo continua como esta) -----------------------------
do $$
declare
  v_def  text := pg_get_functiondef('public.aprovar_solicitacao_fichas(uuid,integer)'::regprocedure);
  v_t1   text := $a$v_dep   := greatest(coalesce(v_antes, v_ocup), v_ocup) + p_quantidade;$a$;
begin
  if position(v_t1 in v_def) = 0 then
    raise exception 'trecho não encontrado em aprovar_solicitacao_fichas';
  end if;
  -- O upsert (on conflict ... set limite_maximo) nao mexe em fixo.
  execute replace(v_def, v_t1,
    $b$v_dep   := p_quantidade;  -- 13/11/2026: substitui (antes somava)$b$);
end $$;

-- 9. Virada: zera as nao fixas; desfazer traz de volta ------------------------
do $$
declare
  v_def  text := pg_get_functiondef('public._virada_tabelas_substituir()'::regprocedure);
  v_alvo text := $a$'debitos_equipantes', 'acampantes_ja_participaram', 'lgpd_edicoes']) x$a$;
begin
  if v_def like '%''limites_igrejas''%' then return; end if;
  if position(v_alvo in v_def) = 0 then
    raise exception 'trecho não encontrado em _virada_tabelas_substituir';
  end if;
  execute replace(v_def, v_alvo,
    $b$'debitos_equipantes', 'acampantes_ja_participaram', 'lgpd_edicoes',
      'limites_igrejas']) x$b$);
end $$;

do $$
declare
  v_def  text := pg_get_functiondef(
    'public.resetar_para_nova_edicao(integer,date,date,date,date,date)'::regprocedure);
  v_alvo text := E'  perform public._virada_tirar_foto(v_edicao_ant, p_nova_edicao);\n';
begin
  if v_def like '%limites_igrejas where not fixo%' then return; end if;
  if (length(v_def) - length(replace(v_def, v_alvo, ''))) / length(v_alvo) <> 1 then
    raise exception 'trecho não encontrado (ou repetido) em resetar_para_nova_edicao';
  end if;
  execute replace(v_def, v_alvo, v_alvo
    || E'\n  -- Fichas de acampante: as nao fixas voltam a 0 (20261113a).\n'
    || E'  delete from public.limites_igrejas where not fixo;\n');
end $$;
