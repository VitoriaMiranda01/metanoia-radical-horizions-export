-- ---------------------------------------------------------------------------
-- Desfaz as "fichas de teste" (20261006i). Patrick, 06/10/2026: "não ficou
-- bom" -- o teste vai ser num ambiente separado, de ponta a ponta.
--
-- Volta cada funcao ajustada ao texto de antes (o mesmo _patch, ao
-- contrario), as politicas de acesso como eram, apaga as funcoes do painel
-- e as colunas novas. A ficha "Raquel Gomes da Silva" volta a ser comum
-- (continua escalada em Logistica, como antes).
-- ---------------------------------------------------------------------------

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

-- 1. Funcoes de volta ao que eram ------------------------------------------
select pg_temp._patch('public.contadores_do_menu()',
  $$select count(*) from public.equipantes where lower(coalesce(status, '')) = 'pendente' and not teste$$,
  $$select count(*) from public.equipantes where lower(coalesce(status, '')) = 'pendente'$$);
select pg_temp._patch('public.contadores_do_menu()',
  $$where p.status in ('pago', 'divergente')
           and not coalesce(a.teste, e.teste, false)$$,
  $$where p.status in ('pago', 'divergente')$$);
select pg_temp._patch('public.ocupacao_igrejas()',
  $$where a.admin_responsavel is not null and a.admin_responsavel <> '' and not a.teste$$,
  $$where a.admin_responsavel is not null and a.admin_responsavel <> ''$$);
select pg_temp._patch('public._acampantes_verificar_limite_igreja()',
  $$IF NEW.teste OR NEW.admin_responsavel IS NULL OR NEW.admin_responsavel = '' THEN$$,
  $$IF NEW.admin_responsavel IS NULL OR NEW.admin_responsavel = '' THEN$$);
select pg_temp._patch('public._acampantes_verificar_limite_igreja()',
  $$WHERE admin_responsavel = NEW.admin_responsavel AND NOT teste;$$,
  $$WHERE admin_responsavel = NEW.admin_responsavel;$$);
select pg_temp._patch('public.relatorio_igrejas()',
  $$where e.tipo = 'equipante' and coalesce(e.inscrito, false) and not e.teste$$,
  $$where e.tipo = 'equipante' and coalesce(e.inscrito, false)$$, 2);
select pg_temp._patch('public.relatorio_igrejas()',
  $$from public.acampantes a
               where not a.teste
               group by 1$$,
  $$from public.acampantes a
               group by 1$$);
select pg_temp._patch('public.outras_igrejas()',
  $$where e.tipo = 'equipante' and not e.teste
       and coalesce(btrim(e.igreja_outra), '') <> ''$$,
  $$where e.tipo = 'equipante'
       and coalesce(btrim(e.igreja_outra), '') <> ''$$);
select pg_temp._patch('public.outras_igrejas()',
  $$(select count(*) from public.equipantes e
             where not e.teste and upper($$,
  $$(select count(*) from public.equipantes e
             where upper($$);
select pg_temp._patch('public.camisas_pendentes()',
  $$where not a.teste and upper(btrim(coalesce(a.tamanho_camisa, ''))) not in$$,
  $$where upper(btrim(coalesce(a.tamanho_camisa, ''))) not in$$);
select pg_temp._patch('public.contatos_emergencia_pendentes()',
  $$where cardinality(t.problemas) > 0
    and not public._acampante_teste(t.id);$$,
  $$where cardinality(t.problemas) > 0;$$);
select pg_temp._patch('public.telefones_acampantes_pendentes()',
  $$where cardinality(t.campos) > 0
    and not public._acampante_teste(t.id);$$,
  $$where cardinality(t.campos) > 0;$$);
select pg_temp._patch('public.menores_para_conferencia()',
  $$where e.tipo = 'equipante' and not e.teste
       and coalesce(e.inscrito, false)$$,
  $$where e.tipo = 'equipante'
       and coalesce(e.inscrito, false)$$);
select pg_temp._patch('public.disponibilidades_extra()',
  $$where e.tipo = 'equipante' and not e.teste
      and coalesce(btrim(e.area_trabalho_extra), '') <> ''$$,
  $$where e.tipo = 'equipante'
      and coalesce(btrim(e.area_trabalho_extra), '') <> ''$$);
select pg_temp._patch('public._equipante_area_tem_vaga(text,text)',
  $$FROM escalas WHERE area_alocada = v_area AND NOT public._equipante_teste(equipante_id);$$,
  $$FROM escalas WHERE area_alocada = v_area;$$);
select pg_temp._patch('public._equipante_area_tem_vaga(text,text)',
  $$WHERE e.area_alocada = v_area AND eq.sexo = p_sexo AND NOT eq.teste;$$,
  $$WHERE e.area_alocada = v_area AND eq.sexo = p_sexo;$$);
select pg_temp._patch('public._area_com_mais_vaga(text)',
  $$(select count(*) from public.escalas e where e.area_alocada = l.area_nome
                and not public._equipante_teste(e.equipante_id))$$,
  $$(select count(*) from public.escalas e where e.area_alocada = l.area_nome)$$);
select pg_temp._patch('public.alocar_fila_automaticamente()',
  $$q.tipo = 'equipante' and not q.teste$$, $$q.tipo = 'equipante'$$, 3);
select pg_temp._patch('public.lancar_escala()',
  $$q.tipo = 'equipante' and not q.teste$$, $$q.tipo = 'equipante'$$);
select pg_temp._patch('public.lancar_escala()',
  $$where e.area_alocada <> 'Não será escalado'
     and not public._equipante_teste(e.equipante_id);$$,
  $$where e.area_alocada <> 'Não será escalado';$$);
select pg_temp._patch('public.lancar_escala_oficial()',
  $$q.tipo = 'equipante' and not q.teste$$, $$q.tipo = 'equipante'$$);
select pg_temp._patch('public.situacao_escala()',
  $$q.tipo = 'equipante' and not q.teste$$, $$q.tipo = 'equipante'$$);
select pg_temp._patch('public.situacao_escala()',
  $$from public.escalas e where e.area_alocada <> 'Não será escalado'
       and not public._equipante_teste(e.equipante_id);$$,
  $$from public.escalas e where e.area_alocada <> 'Não será escalado';$$);
select pg_temp._patch('public.situacao_escala()',
  $$select e.equipante_id from public.escalas e
     where not public._equipante_teste(e.equipante_id)
     group by e.equipante_id$$,
  $$select e.equipante_id from public.escalas e
     group by e.equipante_id$$);
select pg_temp._patch('public.situacao_escala()',
  $$select count(*) into v_participacoes from public.escalas
   where not public._equipante_teste(equipante_id);$$,
  $$select count(*) into v_participacoes from public.escalas;$$);
select pg_temp._patch('public.situacao_escala()',
  $$where s.area_alocada <> 'Não será escalado'
     and not public._equipante_teste(s.equipante_id);

  select count(distinct s.equipante_id) into v_lideres
    from public.escalas s where public._eh_lider(s.area_alocada, s.atuacao)
     and not public._equipante_teste(s.equipante_id);$$,
  $$where s.area_alocada <> 'Não será escalado';

  select count(distinct s.equipante_id) into v_lideres
    from public.escalas s where public._eh_lider(s.area_alocada, s.atuacao);$$);
select pg_temp._patch('public.chamada_da_escala()',
  $$join public.equipantes q on q.id = s.equipante_id
       where not q.teste and $$,
  $$join public.equipantes q on q.id = s.equipante_id
       where $$, 3);
select pg_temp._patch('public.chamada_da_escala()',
  $$where s.area_alocada <> 'Não será escalado'
             and not public._equipante_teste(s.equipante_id)
           group by s.area_alocada$$,
  $$where s.area_alocada <> 'Não será escalado'
           group by s.area_alocada$$);
select pg_temp._patch('public.relacao_lider(uuid,text,text,date)',
  $$where public._na_equipe(l.id, s.id)
                and (not q.teste or public._equipante_teste(p_id)))$$,
  $$where public._na_equipe(l.id, s.id))$$);
select pg_temp._patch('public.situacao_inscricao(text,uuid,text,text,date)',
  $$select c.escala_lancada_em, c.escala_oficial_em into v_lancada, v_oficial
    from public.configuracoes c limit 1;
  v_lancada := public._escala_lancada_para(p_id);$$,
  $$select c.escala_lancada_em, c.escala_oficial_em into v_lancada, v_oficial
    from public.configuracoes c limit 1;$$);
select pg_temp._patch('public._equipante_pode_pagar(uuid)',
  $$if public._escala_lancada_para(p_id) is null$$,
  $$if (select escala_lancada_em from public.configuracoes limit 1) is null$$);
select pg_temp._patch('public.revelar_area(uuid,text,text,date)',
  $$if public._escala_lancada_para(p_id) is null then$$,
  $$if (select escala_lancada_em from public.configuracoes limit 1) is null then$$);
select pg_temp._patch('public._lider_autenticado(uuid,text,text,date)',
  $$if public._escala_lancada_para(p_id) is null then$$,
  $$if (select escala_lancada_em from public.configuracoes limit 1) is null then$$);
-- criar_inscricao: os usos de v_teste saem antes da declaracao.
select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
  $$  v_a.teste := v_teste;
  insert into public.acampantes select (v_a).*;$$,
  $$  insert into public.acampantes select (v_a).*;$$);

select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
  $$    v_e.teste := v_teste;
    insert into public.equipantes select (v_e).*;$$,
  $$    insert into public.equipantes select (v_e).*;$$);
select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
  $$    -- Ficha de teste nunca reaproveita a ficha de alguem de verdade.
    if v_atual.id is not null and v_teste then
      raise exception 'TESTE_CPF_EXISTENTE';
    end if;

    if v_atual.id is not null then
      if coalesce(v_atual.inscrito, false) then$$,
  $$    if v_atual.id is not null then
      if coalesce(v_atual.inscrito, false) then$$);
select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
  $$    raise exception 'INSCRICOES_FECHADAS';
  end if;

  -- Link de cadastro de teste (painel "Ambiente de teste"): a ficha nasce
  -- de teste, separada de tudo o que e oficial.
  v_teste := p_chave is not null and public.liberacao_valida(p_chave, p_tipo);$$,
  $$    raise exception 'INSCRICOES_FECHADAS';
  end if;$$);
select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
  $$  v_edicao  int;
  v_teste   boolean := false;
begin$$,
  $$  v_edicao  int;
begin$$);

-- 2. Politicas de acesso como eram -----------------------------------------
drop policy if exists "organizador faz tudo" on public.equipantes;
create policy "organizador faz tudo" on public.equipantes
  for all to authenticated using (eh_organizador()) with check (eh_organizador());
drop policy if exists "parceiro ve so a propria igreja" on public.equipantes;
create policy "parceiro ve so a propria igreja" on public.equipantes
  for select to authenticated
  using (eh_parceiro() and igreja is not null and igreja like (jwt_igreja() || ' - %'));
drop policy if exists "organizador faz tudo" on public.acampantes;
create policy "organizador faz tudo" on public.acampantes
  for all to authenticated using (eh_organizador()) with check (eh_organizador());
drop policy if exists "organizador le" on public.escalas;
create policy "organizador le" on public.escalas
  for select to authenticated using (eh_organizador());
drop policy if exists "organizador inclui" on public.escalas;
create policy "organizador inclui" on public.escalas
  for insert to authenticated with check (eh_organizador());
drop policy if exists "gestao da escala altera" on public.escalas;
create policy "gestao da escala altera" on public.escalas
  for update to authenticated
  using (eh_organizador() and pode_gerir_escala())
  with check (eh_organizador() and pode_gerir_escala());
drop policy if exists "gestao da escala apaga" on public.escalas;
create policy "gestao da escala apaga" on public.escalas
  for delete to authenticated using (eh_organizador() and pode_gerir_escala());
drop policy if exists "organizador le cobrancas" on public.pix_sicoob;
create policy "organizador le cobrancas" on public.pix_sicoob
  for select to authenticated using (eh_organizador());

-- 3. Sai o que foi criado --------------------------------------------------
drop function if exists public.teste_painel();
drop function if exists public.teste_gerar_link(text);
drop function if exists public.teste_desativar_link(text);
drop function if exists public.teste_decidir(uuid, text);
drop function if exists public.teste_escalar(uuid, text, text);
drop function if exists public.teste_lancar_escala(boolean);
drop function if exists public.teste_pagamento(text, uuid, boolean);
drop function if exists public.teste_apagar(text, uuid);
drop function if exists public._escala_lancada_para(uuid);
drop function if exists public._ve_teste();
drop function if exists public._equipante_teste(uuid);
drop function if exists public._acampante_teste(uuid);

drop trigger if exists teste_padrao on public.equipantes;
drop trigger if exists teste_padrao on public.acampantes;
drop function if exists public._teste_padrao();

-- Links de cadastro gerados pelo painel (ja estavam desativados).
delete from public.liberacoes_teste where nota like 'Painel de teste:%';

alter table public.equipantes drop column if exists teste;
alter table public.acampantes drop column if exists teste;
alter table public.configuracoes drop column if exists escala_teste_em;
