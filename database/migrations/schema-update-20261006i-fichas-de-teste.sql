-- ---------------------------------------------------------------------------
-- Fichas de teste (Patrick, 06/10/2026).
--
-- A Raquel (e os desenvolvedores) testam na mao o fluxo de verdade --
-- cadastro, aprovacao, escala provisoria, revelar a area, PIX real do Sicoob
-- -- sem encostar nos participantes nem nos numeros oficiais.
--
--   * equipantes.teste / acampantes.teste: a ficha nasce de teste quando e
--     feita pelo link de cadastro de teste (chave de liberacoes_teste).
--     Ninguem consegue marcar uma ficha como teste pelo formulario.
--   * Ficha de teste NAO aparece em tela nenhuma (RLS) e NAO conta em nada:
--     metricas, vagas de igreja e de area, aprovacoes das igrejas, geracao e
--     lancamento da escala, chamada, relacao dos lideres reais, avisos.
--     Quem cuida delas e o painel "Ambiente de teste" (so Raquel e
--     Desenvolvedores), pelas funcoes teste_* abaixo.
--   * Escala de teste: configuracoes.escala_teste_em. Com ela preenchida, a
--     escala conta como lancada SO para as fichas de teste; para todo o resto
--     continua como estiver (hoje: nao lancada).
--   * O PIX e o real, no valor cheio (decisao do Patrick): o dinheiro cai com
--     a Raquel, que e o financeiro.
--
-- As funcoes que ja existiam sao ajustadas no lugar (_patch): cada trecho
-- trocado precisa aparecer o numero exato de vezes esperado, senao a
-- migracao para inteira.
-- ---------------------------------------------------------------------------

-- 1. A marca --------------------------------------------------------------
alter table public.equipantes add column if not exists teste boolean not null default false;
alter table public.acampantes add column if not exists teste boolean not null default false;
alter table public.configuracoes add column if not exists escala_teste_em timestamptz;

-- Quem monta a linha inteira a partir de um JSON (jsonb_populate_record)
-- manda teste = null; o padrao e "nao e teste".
create or replace function public._teste_padrao()
returns trigger
language plpgsql
set search_path to 'public'
as $fn$
begin
  new.teste := coalesce(new.teste, false);
  return new;
end;
$fn$;

drop trigger if exists teste_padrao on public.equipantes;
create trigger teste_padrao before insert or update of teste on public.equipantes
  for each row execute function public._teste_padrao();
drop trigger if exists teste_padrao on public.acampantes;
create trigger teste_padrao before insert or update of teste on public.acampantes
  for each row execute function public._teste_padrao();

create or replace function public._equipante_teste(p_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $fn$
  select coalesce((select q.teste from public.equipantes q where q.id = p_id), false);
$fn$;

create or replace function public._acampante_teste(p_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $fn$
  select coalesce((select a.teste from public.acampantes a where a.id = p_id), false);
$fn$;

-- Quem enxerga e mexe nas fichas de teste: Raquel e Desenvolvedores.
create or replace function public._ve_teste()
returns boolean
language sql stable security definer
set search_path to 'public'
as $fn$
  select lower(coalesce(public._nome_organizador_logado(), '')) in ('raquel', 'desenvolvedores');
$fn$;

-- A escala esta lancada PARA ESTA PESSOA? A oficial vale para todos; a de
-- teste, so para ficha de teste.
create or replace function public._escala_lancada_para(p_id uuid)
returns timestamptz
language sql stable security definer
set search_path to 'public'
as $fn$
  select coalesce(c.escala_lancada_em,
                  case when public._equipante_teste(p_id) then c.escala_teste_em end)
    from public.configuracoes c
   limit 1;
$fn$;

-- 2. Telas: ficha de teste some das leituras diretas (RLS) -----------------
drop policy if exists "organizador faz tudo" on public.equipantes;
create policy "organizador faz tudo" on public.equipantes
  for all to authenticated
  using (eh_organizador() and not teste)
  with check (eh_organizador() and not teste);

drop policy if exists "parceiro ve so a propria igreja" on public.equipantes;
create policy "parceiro ve so a propria igreja" on public.equipantes
  for select to authenticated
  using (eh_parceiro() and not teste and igreja is not null and igreja like (jwt_igreja() || ' - %'));

drop policy if exists "organizador faz tudo" on public.acampantes;
create policy "organizador faz tudo" on public.acampantes
  for all to authenticated
  using (eh_organizador() and not teste)
  with check (eh_organizador() and not teste);

drop policy if exists "organizador le" on public.escalas;
create policy "organizador le" on public.escalas
  for select to authenticated
  using (eh_organizador() and not public._equipante_teste(equipante_id));
drop policy if exists "organizador inclui" on public.escalas;
create policy "organizador inclui" on public.escalas
  for insert to authenticated
  with check (eh_organizador() and not public._equipante_teste(equipante_id));
drop policy if exists "gestao da escala altera" on public.escalas;
create policy "gestao da escala altera" on public.escalas
  for update to authenticated
  using (eh_organizador() and pode_gerir_escala() and not public._equipante_teste(equipante_id))
  with check (eh_organizador() and pode_gerir_escala() and not public._equipante_teste(equipante_id));
drop policy if exists "gestao da escala apaga" on public.escalas;
create policy "gestao da escala apaga" on public.escalas
  for delete to authenticated
  using (eh_organizador() and pode_gerir_escala() and not public._equipante_teste(equipante_id));

drop policy if exists "organizador le cobrancas" on public.pix_sicoob;
create policy "organizador le cobrancas" on public.pix_sicoob
  for select to authenticated
  using (eh_organizador()
         and not (case when inscricao_tipo = 'equipante' then public._equipante_teste(inscricao_id)
                       else public._acampante_teste(inscricao_id) end));

-- 3. Contas e listas do banco: ficha de teste nao entra -------------------
create or replace function pg_temp._patch(p_fn regprocedure, p_de text, p_para text, p_vezes int default 1)
returns void
language plpgsql
as $fn$
declare
  d text := pg_get_functiondef(p_fn);
  n int := (length(d) - length(replace(d, p_de, ''))) / length(p_de);
begin
  if n <> p_vezes then
    raise exception 'patch %: esperava % ocorrencia(s) de [%], achou %', p_fn, p_vezes, left(p_de, 80), n;
  end if;
  execute replace(d, p_de, p_para);
end;
$fn$;

-- Menu (aprovacoes pendentes e PIX travados)
select pg_temp._patch('public.contadores_do_menu()',
  $$select count(*) from public.equipantes where lower(coalesce(status, '')) = 'pendente'$$,
  $$select count(*) from public.equipantes where lower(coalesce(status, '')) = 'pendente' and not teste$$);
select pg_temp._patch('public.contadores_do_menu()',
  $$where p.status in ('pago', 'divergente')$$,
  $$where p.status in ('pago', 'divergente')
           and not coalesce(a.teste, e.teste, false)$$);

-- Vagas por igreja (acampantes)
select pg_temp._patch('public.ocupacao_igrejas()',
  $$where a.admin_responsavel is not null and a.admin_responsavel <> ''$$,
  $$where a.admin_responsavel is not null and a.admin_responsavel <> '' and not a.teste$$);
select pg_temp._patch('public._acampantes_verificar_limite_igreja()',
  $$IF NEW.admin_responsavel IS NULL OR NEW.admin_responsavel = '' THEN$$,
  $$IF NEW.teste OR NEW.admin_responsavel IS NULL OR NEW.admin_responsavel = '' THEN$$);
select pg_temp._patch('public._acampantes_verificar_limite_igreja()',
  $$WHERE admin_responsavel = NEW.admin_responsavel;$$,
  $$WHERE admin_responsavel = NEW.admin_responsavel AND NOT teste;$$);

-- Relatorio e lista de igrejas
select pg_temp._patch('public.relatorio_igrejas()',
  $$where e.tipo = 'equipante' and coalesce(e.inscrito, false)$$,
  $$where e.tipo = 'equipante' and coalesce(e.inscrito, false) and not e.teste$$, 2);
select pg_temp._patch('public.relatorio_igrejas()',
  $$from public.acampantes a
               group by 1$$,
  $$from public.acampantes a
               where not a.teste
               group by 1$$);
select pg_temp._patch('public.outras_igrejas()',
  $$where e.tipo = 'equipante'
       and coalesce(btrim(e.igreja_outra), '') <> ''$$,
  $$where e.tipo = 'equipante' and not e.teste
       and coalesce(btrim(e.igreja_outra), '') <> ''$$);
select pg_temp._patch('public.outras_igrejas()',
  $$(select count(*) from public.equipantes e
             where upper($$,
  $$(select count(*) from public.equipantes e
             where not e.teste and upper($$);

-- Avisos do sino (acampantes)
select pg_temp._patch('public.camisas_pendentes()',
  $$where upper(btrim(coalesce(a.tamanho_camisa, ''))) not in$$,
  $$where not a.teste and upper(btrim(coalesce(a.tamanho_camisa, ''))) not in$$);
select pg_temp._patch('public.contatos_emergencia_pendentes()',
  $$where cardinality(t.problemas) > 0;$$,
  $$where cardinality(t.problemas) > 0
    and not public._acampante_teste(t.id);$$);
select pg_temp._patch('public.telefones_acampantes_pendentes()',
  $$where cardinality(t.campos) > 0;$$,
  $$where cardinality(t.campos) > 0
    and not public._acampante_teste(t.id);$$);

-- Menores (conferencia de autorizacao) e disponibilidade extra
select pg_temp._patch('public.menores_para_conferencia()',
  $$where e.tipo = 'equipante'
       and coalesce(e.inscrito, false)$$,
  $$where e.tipo = 'equipante' and not e.teste
       and coalesce(e.inscrito, false)$$);
select pg_temp._patch('public.disponibilidades_extra()',
  $$where e.tipo = 'equipante'
      and coalesce(btrim(e.area_trabalho_extra), '') <> ''$$,
  $$where e.tipo = 'equipante' and not e.teste
      and coalesce(btrim(e.area_trabalho_extra), '') <> ''$$);

-- Escala: vagas das areas, geracao, lancamento, situacao e chamada
select pg_temp._patch('public._equipante_area_tem_vaga(text,text)',
  $$FROM escalas WHERE area_alocada = v_area;$$,
  $$FROM escalas WHERE area_alocada = v_area AND NOT public._equipante_teste(equipante_id);$$);
select pg_temp._patch('public._equipante_area_tem_vaga(text,text)',
  $$WHERE e.area_alocada = v_area AND eq.sexo = p_sexo;$$,
  $$WHERE e.area_alocada = v_area AND eq.sexo = p_sexo AND NOT eq.teste;$$);
select pg_temp._patch('public._area_com_mais_vaga(text)',
  $$(select count(*) from public.escalas e where e.area_alocada = l.area_nome)$$,
  $$(select count(*) from public.escalas e where e.area_alocada = l.area_nome
                and not public._equipante_teste(e.equipante_id))$$);
select pg_temp._patch('public.alocar_fila_automaticamente()',
  $$q.tipo = 'equipante'$$, $$q.tipo = 'equipante' and not q.teste$$, 3);
select pg_temp._patch('public.lancar_escala()',
  $$q.tipo = 'equipante'$$, $$q.tipo = 'equipante' and not q.teste$$);
select pg_temp._patch('public.lancar_escala()',
  $$where e.area_alocada <> 'Não será escalado';$$,
  $$where e.area_alocada <> 'Não será escalado'
     and not public._equipante_teste(e.equipante_id);$$);
select pg_temp._patch('public.lancar_escala_oficial()',
  $$q.tipo = 'equipante'$$, $$q.tipo = 'equipante' and not q.teste$$);
select pg_temp._patch('public.situacao_escala()',
  $$q.tipo = 'equipante'$$, $$q.tipo = 'equipante' and not q.teste$$);
select pg_temp._patch('public.situacao_escala()',
  $$from public.escalas e where e.area_alocada <> 'Não será escalado';$$,
  $$from public.escalas e where e.area_alocada <> 'Não será escalado'
       and not public._equipante_teste(e.equipante_id);$$);
select pg_temp._patch('public.situacao_escala()',
  $$select e.equipante_id from public.escalas e
     group by e.equipante_id$$,
  $$select e.equipante_id from public.escalas e
     where not public._equipante_teste(e.equipante_id)
     group by e.equipante_id$$);
select pg_temp._patch('public.situacao_escala()',
  $$select count(*) into v_participacoes from public.escalas;$$,
  $$select count(*) into v_participacoes from public.escalas
   where not public._equipante_teste(equipante_id);$$);
select pg_temp._patch('public.situacao_escala()',
  $$where s.area_alocada <> 'Não será escalado';

  select count(distinct s.equipante_id) into v_lideres
    from public.escalas s where public._eh_lider(s.area_alocada, s.atuacao);$$,
  $$where s.area_alocada <> 'Não será escalado'
     and not public._equipante_teste(s.equipante_id);

  select count(distinct s.equipante_id) into v_lideres
    from public.escalas s where public._eh_lider(s.area_alocada, s.atuacao)
     and not public._equipante_teste(s.equipante_id);$$);
select pg_temp._patch('public.chamada_da_escala()',
  $$join public.equipantes q on q.id = s.equipante_id
       where $$,
  $$join public.equipantes q on q.id = s.equipante_id
       where not q.teste and $$, 3);
select pg_temp._patch('public.chamada_da_escala()',
  $$where s.area_alocada <> 'Não será escalado'
           group by s.area_alocada$$,
  $$where s.area_alocada <> 'Não será escalado'
             and not public._equipante_teste(s.equipante_id)
           group by s.area_alocada$$);

-- Relacao do lider: lider de verdade nao ve ficha de teste na equipe.
select pg_temp._patch('public.relacao_lider(uuid,text,text,date)',
  $$where public._na_equipe(l.id, s.id))$$,
  $$where public._na_equipe(l.id, s.id)
                and (not q.teste or public._equipante_teste(p_id)))$$);

-- 4. Escala de teste: lancada para a ficha de teste -----------------------
select pg_temp._patch('public.situacao_inscricao(text,uuid,text,text,date)',
  $$select c.escala_lancada_em, c.escala_oficial_em into v_lancada, v_oficial
    from public.configuracoes c limit 1;$$,
  $$select c.escala_lancada_em, c.escala_oficial_em into v_lancada, v_oficial
    from public.configuracoes c limit 1;
  v_lancada := public._escala_lancada_para(p_id);$$);
select pg_temp._patch('public._equipante_pode_pagar(uuid)',
  $$if (select escala_lancada_em from public.configuracoes limit 1) is null$$,
  $$if public._escala_lancada_para(p_id) is null$$);
select pg_temp._patch('public.revelar_area(uuid,text,text,date)',
  $$if (select escala_lancada_em from public.configuracoes limit 1) is null then$$,
  $$if public._escala_lancada_para(p_id) is null then$$);
select pg_temp._patch('public._lider_autenticado(uuid,text,text,date)',
  $$if (select escala_lancada_em from public.configuracoes limit 1) is null then$$,
  $$if public._escala_lancada_para(p_id) is null then$$);

-- 5. Cadastro: o link de teste faz ficha de teste -------------------------
select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
  $$  v_edicao  int;
begin$$,
  $$  v_edicao  int;
  v_teste   boolean := false;
begin$$);
select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
  $$    raise exception 'INSCRICOES_FECHADAS';
  end if;$$,
  $$    raise exception 'INSCRICOES_FECHADAS';
  end if;

  -- Link de cadastro de teste (painel "Ambiente de teste"): a ficha nasce
  -- de teste, separada de tudo o que e oficial.
  v_teste := p_chave is not null and public.liberacao_valida(p_chave, p_tipo);$$);
select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
  $$    if v_atual.id is not null then
      if coalesce(v_atual.inscrito, false) then$$,
  $$    -- Ficha de teste nunca reaproveita a ficha de alguem de verdade.
    if v_atual.id is not null and v_teste then
      raise exception 'TESTE_CPF_EXISTENTE';
    end if;

    if v_atual.id is not null then
      if coalesce(v_atual.inscrito, false) then$$);
select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
  $$    insert into public.equipantes select (v_e).*;$$,
  $$    v_e.teste := v_teste;
    insert into public.equipantes select (v_e).*;$$);
select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
  $$  insert into public.acampantes select (v_a).*;$$,
  $$  v_a.teste := v_teste;
  insert into public.acampantes select (v_a).*;$$);

-- 6. Painel "Ambiente de teste" (Raquel e Desenvolvedores) -----------------
create or replace function public.teste_painel()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $fn$
begin
  if not public._ve_teste() then
    return null;
  end if;

  return jsonb_build_object(
    'perfil', lower(public._nome_organizador_logado()),
    'escala_teste_em', (select escala_teste_em from public.configuracoes limit 1),
    'escala_lancada_em', (select escala_lancada_em from public.configuracoes limit 1),
    'links', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'chave', l.chave, 'tipo', l.tipo, 'nota', l.nota,
               'criada_em', l.criada_em, 'expira_em', l.expira_em)
             order by l.criada_em desc), '[]'::jsonb)
        from public.liberacoes_teste l
       where l.expira_em > now()),
    'equipantes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', q.id, 'nome', q.nome, 'cpf', q.cpf, 'whatsapp', q.whatsapp,
               'data_nascimento', q.data_nascimento, 'nacionalidade', q.nacionalidade,
               'igreja', q.igreja, 'status', q.status,
               'status_pagamento', q.status_pagamento, 'metodo_pagamento', q.metodo_pagamento,
               'area_vista', q.area_vista_em is not null,
               'escalas', (select coalesce(jsonb_agg(jsonb_build_object(
                             'area', s.area_alocada, 'atuacao', s.atuacao,
                             'eh_lider', public._eh_lider(s.area_alocada, s.atuacao))
                             order by s.created_at), '[]'::jsonb)
                             from public.escalas s where s.equipante_id = q.id))
             order by q.nome), '[]'::jsonb)
        from public.equipantes q
       where q.teste),
    'acampantes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', a.id, 'nome', a.nome, 'cpf', a.cpf, 'whatsapp', a.whatsapp,
               'data_nascimento', a.data_nascimento, 'nacionalidade', a.nacionalidade,
               'igreja', a.admin_responsavel,
               'status_pagamento', a.status_pagamento, 'metodo_pagamento', a.metodo_pagamento)
             order by a.nome), '[]'::jsonb)
        from public.acampantes a
       where a.teste),
    'areas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'area', l.area_nome,
               'atuacoes', (select coalesce(jsonb_agg(jsonb_build_object(
                              'atuacao', t.atuacao, 'eh_lider', t.eh_lider) order by t.ordem), '[]'::jsonb)
                              from public.atuacoes_areas t where t.area_nome = l.area_nome))
             order by l.area_nome), '[]'::jsonb)
        from public.limites_areas l
       where l.area_nome <> 'Disponível para qualquer área'));
end;
$fn$;

create or replace function public.teste_gerar_link(p_tipo text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_chave text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public._ve_teste() then
    raise exception 'SEM_PERMISSAO';
  end if;
  if p_tipo not in ('equipante', 'acampante') then
    raise exception 'TIPO_INVALIDO';
  end if;
  insert into public.liberacoes_teste (chave, tipo, nota, criada_em, expira_em)
  values (v_chave, p_tipo, 'Painel de teste: ' || public._nome_organizador_logado(),
          now(), now() + interval '30 days');
  return v_chave;
end;
$fn$;

create or replace function public.teste_desativar_link(p_chave text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public._ve_teste() then
    raise exception 'SEM_PERMISSAO';
  end if;
  update public.liberacoes_teste set expira_em = now()
   where chave = p_chave and expira_em > now();
end;
$fn$;

-- Aprovacao (no lugar da igreja, que nao enxerga a ficha de teste).
create or replace function public.teste_decidir(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public._ve_teste() then
    raise exception 'SEM_PERMISSAO';
  end if;
  if p_status not in ('aprovado', 'pendente', 'rejeitado') then
    raise exception 'STATUS_INVALIDO';
  end if;
  update public.equipantes
     set status = p_status,
         decidido_por = case when p_status = 'pendente' then null else public._nome_organizador_logado() end,
         decidido_por_tipo = case when p_status = 'pendente' then null else 'organizador' end,
         decidido_em = case when p_status = 'pendente' then null else now() end
   where id = p_id and teste;
  if not found then
    raise exception 'NAO_E_FICHA_DE_TESTE';
  end if;
end;
$fn$;

-- Escala a ficha de teste numa area (ou tira, com p_area nulo). Sempre
-- zera o "ja viu a area", para a animacao aparecer de novo.
create or replace function public.teste_escalar(p_id uuid, p_area text, p_atuacao text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_area text := nullif(btrim(coalesce(p_area, '')), '');
begin
  if not public._ve_teste() then
    raise exception 'SEM_PERMISSAO';
  end if;
  if not exists (select 1 from public.equipantes where id = p_id and teste) then
    raise exception 'NAO_E_FICHA_DE_TESTE';
  end if;
  if v_area is not null and v_area <> 'Não será escalado'
     and not exists (select 1 from public.limites_areas where area_nome = v_area) then
    raise exception 'AREA_INVALIDA';
  end if;

  delete from public.escalas where equipante_id = p_id;
  if v_area is not null then
    insert into public.escalas (equipante_id, area_alocada, atuacao)
    values (p_id, v_area, coalesce(nullif(btrim(coalesce(p_atuacao, '')), ''),
                                   public._atuacao_padrao(v_area)));
  end if;
  update public.equipantes
     set scale_status = case when v_area is null then 'pendente' else 'ok' end,
         area_vista_em = null
   where id = p_id;
end;
$fn$;

create or replace function public.teste_lancar_escala(p_lancar boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public._ve_teste() then
    raise exception 'SEM_PERMISSAO';
  end if;
  update public.configuracoes
     set escala_teste_em = case when p_lancar then now() end
   where id = (select id from public.configuracoes limit 1);
end;
$fn$;

-- Volta o pagamento da ficha de teste para pendente (para pagar de novo) ou
-- confirma na mao.
create or replace function public.teste_pagamento(p_tipo text, p_id uuid, p_pago boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public._ve_teste() then
    raise exception 'SEM_PERMISSAO';
  end if;
  if p_tipo = 'equipante' then
    update public.equipantes
       set status_pagamento = case when p_pago then 'confirmado' else 'pendente' end,
           data_pagamento = case when p_pago then now() end,
           metodo_pagamento = case when p_pago then coalesce(metodo_pagamento, 'manual') else null end
     where id = p_id and teste;
  else
    update public.acampantes
       set status_pagamento = case when p_pago then 'confirmado' else 'pendente' end,
           data_pagamento = case when p_pago then now() end,
           metodo_pagamento = case when p_pago then coalesce(metodo_pagamento, 'manual') else null end
     where id = p_id and teste;
  end if;
  if not found then
    raise exception 'NAO_E_FICHA_DE_TESTE';
  end if;
end;
$fn$;

-- Apaga a ficha de teste e o que e dela (escala, chamada, grupo, cobranca).
-- O registro do PIX fica: houve dinheiro de verdade.
create or replace function public.teste_apagar(p_tipo text, p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public._ve_teste() then
    raise exception 'SEM_PERMISSAO';
  end if;
  if p_tipo = 'equipante' then
    if not exists (select 1 from public.equipantes where id = p_id and teste) then
      raise exception 'NAO_E_FICHA_DE_TESTE';
    end if;
    delete from public.pagamentos where equipante_id = p_id;
    delete from public.equipantes where id = p_id and teste;
  else
    if not exists (select 1 from public.acampantes where id = p_id and teste) then
      raise exception 'NAO_E_FICHA_DE_TESTE';
    end if;
    delete from public.pagamentos where acampante_id = p_id;
    delete from public.acampantes where id = p_id and teste;
  end if;
end;
$fn$;

-- 7. A ficha que a Raquel ja usou para testar passa a ser de teste ---------
update public.equipantes q
   set teste = true
 where q.nome = 'Raquel Gomes da Silva'
   and exists (select 1 from public.escalas s where s.equipante_id = q.id);

-- 8. Permissoes ------------------------------------------------------------
revoke all on function public._teste_padrao() from public, anon, authenticated;
revoke all on function public._equipante_teste(uuid) from public, anon;
revoke all on function public._acampante_teste(uuid) from public, anon;
revoke all on function public._ve_teste() from public, anon;
revoke all on function public._escala_lancada_para(uuid) from public, anon, authenticated;
grant execute on function public._equipante_teste(uuid) to authenticated;
grant execute on function public._acampante_teste(uuid) to authenticated;
grant execute on function public._ve_teste() to authenticated;

revoke all on function public.teste_painel() from public, anon;
revoke all on function public.teste_gerar_link(text) from public, anon;
revoke all on function public.teste_desativar_link(text) from public, anon;
revoke all on function public.teste_decidir(uuid, text) from public, anon;
revoke all on function public.teste_escalar(uuid, text, text) from public, anon;
revoke all on function public.teste_lancar_escala(boolean) from public, anon;
revoke all on function public.teste_pagamento(text, uuid, boolean) from public, anon;
revoke all on function public.teste_apagar(text, uuid) from public, anon;
grant execute on function public.teste_painel() to authenticated;
grant execute on function public.teste_gerar_link(text) to authenticated;
grant execute on function public.teste_desativar_link(text) to authenticated;
grant execute on function public.teste_decidir(uuid, text) to authenticated;
grant execute on function public.teste_escalar(uuid, text, text) to authenticated;
grant execute on function public.teste_lancar_escala(boolean) to authenticated;
grant execute on function public.teste_pagamento(text, uuid, boolean) to authenticated;
grant execute on function public.teste_apagar(text, uuid) to authenticated;
