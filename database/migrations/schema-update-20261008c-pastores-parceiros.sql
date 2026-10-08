-- ---------------------------------------------------------------------------
-- Pastores Parceiros (Patrick, 08/10/2026)
--
-- Quadro em Configuracoes, embaixo de "Todas as igrejas cadastradas": todos
-- os pastores de cada igreja (pode haver varios por igreja; por ora ninguem e
-- marcado como principal). Os dados vem da planilha do formulario
-- "Registro de Igrejas/Pastor responsavel" -- a importacao e feita depois,
-- quando a planilha fechar (decisao do Patrick) -- e o quadro edita e
-- acrescenta pastores.
--
--  * igreja_id aponta para igrejas_parceiras.id (nao para o codigo, que pode
--    ser editado). Pode ficar vazio: resposta da planilha cuja igreja nao foi
--    reconhecida entra "a vincular" e guarda o que a pessoa escreveu em
--    igreja_digitada.
--  * CPF (opcional) nao se repete entre pastores ativos -- e por ele que a
--    importacao sabe quem ja entrou.
--  * Remover nao apaga: marca removido_em/removido_por (fica no historico).
--  * So organizador le e grava, pelas funcoes abaixo; a tabela nao tem
--    politica de acesso direto.
-- ---------------------------------------------------------------------------

create table if not exists public.pastores_parceiros (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  cpf             text,
  telefone        text,
  igreja_id       uuid references public.igrejas_parceiras(id) on delete set null,
  igreja_digitada text,
  origem          text not null default 'tela',
  respondido_em   timestamptz,
  criado_em       timestamptz not null default now(),
  criado_por      text,
  atualizado_em   timestamptz,
  atualizado_por  text,
  removido_em     timestamptz,
  removido_por    text
);

alter table public.pastores_parceiros enable row level security;
revoke all on table public.pastores_parceiros from anon, authenticated;

create unique index if not exists pastores_parceiros_cpf_ativo
  on public.pastores_parceiros (cpf) where cpf is not null and removido_em is null;
create index if not exists pastores_parceiros_igreja on public.pastores_parceiros (igreja_id);

do $g$
begin
  if not exists (select 1 from pg_trigger where tgname = 'auditoria_i' and tgrelid = 'public.pastores_parceiros'::regclass) then
    create trigger auditoria_i after insert on public.pastores_parceiros
      referencing new table as novos for each statement execute function public._auditar('id');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'auditoria_u' and tgrelid = 'public.pastores_parceiros'::regclass) then
    create trigger auditoria_u after update on public.pastores_parceiros
      referencing old table as velhos new table as novos for each statement execute function public._auditar('id');
  end if;
end
$g$;

-- Lista do quadro ------------------------------------------------------------------
create or replace function public.pastores_listar()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;

  return jsonb_build_object('ok', true, 'pastores', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'nome', p.nome, 'cpf', p.cpf, 'telefone', p.telefone,
             'igreja_id', p.igreja_id,
             'igreja_codigo', i.codigo, 'igreja_nome', i.nome,
             'igreja_digitada', p.igreja_digitada,
             'origem', p.origem, 'respondido_em', p.respondido_em,
             'criado_em', p.criado_em, 'criado_por', p.criado_por,
             'atualizado_em', p.atualizado_em, 'atualizado_por', p.atualizado_por)
           order by (i.codigo is null) desc, case when i.codigo ~ '^\d+$' then i.codigo::int end, p.nome)
      from public.pastores_parceiros p
      left join public.igrejas_parceiras i on i.id = p.igreja_id
     where p.removido_em is null), '[]'::jsonb));
end;
$fn$;

revoke all on function public.pastores_listar() from public, anon;
grant execute on function public.pastores_listar() to authenticated;

-- Adicionar (p_id null) ou editar ----------------------------------------------------
create or replace function public.salvar_pastor(p_id uuid, p_nome text, p_cpf text, p_telefone text, p_igreja_codigo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_nome   text := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  v_cpf    text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_tel    text := nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), '');
  v_igreja public.igrejas_parceiras%rowtype;
  v_quem   text := coalesce(public._nome_organizador_logado(), 'organizador');
  v_outro  text;
  v_id     uuid;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores podem cadastrar pastores.');
  end if;

  if length(v_nome) < 3 or length(v_nome) > 100 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o nome do pastor (de 3 a 100 caracteres).');
  end if;
  if v_cpf is not null and (length(v_cpf) <> 11 or not public._cpf_valido(v_cpf)) then
    return jsonb_build_object('ok', false, 'erro', 'CPF inválido. Confira os 11 dígitos ou deixe em branco.');
  end if;
  if v_tel is not null and (length(v_tel) < 10 or length(v_tel) > 13) then
    return jsonb_build_object('ok', false, 'erro', 'Telefone inválido. Use o DDD e o número (10 ou 11 dígitos).');
  end if;

  select * into v_igreja from public.igrejas_parceiras
   where codigo = btrim(coalesce(p_igreja_codigo, '')) and na_lista;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Escolha a igreja do pastor.');
  end if;

  if v_cpf is not null then
    select p.nome into v_outro from public.pastores_parceiros p
     where p.cpf = v_cpf and p.removido_em is null and p.id is distinct from p_id
     limit 1;
    if v_outro is not null then
      return jsonb_build_object('ok', false, 'erro', format('Este CPF já está cadastrado (%s).', v_outro));
    end if;
  end if;

  if p_id is null then
    insert into public.pastores_parceiros (nome, cpf, telefone, igreja_id, origem, criado_por)
    values (v_nome, v_cpf, v_tel, v_igreja.id, 'tela', v_quem)
    returning id into v_id;
  else
    update public.pastores_parceiros set
      nome = v_nome, cpf = v_cpf, telefone = v_tel, igreja_id = v_igreja.id,
      atualizado_em = now(), atualizado_por = v_quem
     where id = p_id and removido_em is null
    returning id into v_id;
    if v_id is null then
      return jsonb_build_object('ok', false, 'erro', 'Pastor não encontrado. Atualize a lista e tente de novo.');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'nome', v_nome,
                            'igreja', v_igreja.codigo || ' - ' || v_igreja.nome);
end;
$fn$;

revoke all on function public.salvar_pastor(uuid, text, text, text, text) from public, anon;
grant execute on function public.salvar_pastor(uuid, text, text, text, text) to authenticated;

-- Remover (fica no historico) ---------------------------------------------------------
create or replace function public.remover_pastor(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_nome text;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores podem remover pastores.');
  end if;

  update public.pastores_parceiros
     set removido_em = now(), removido_por = coalesce(public._nome_organizador_logado(), 'organizador')
   where id = p_id and removido_em is null
  returning nome into v_nome;
  if v_nome is null then
    return jsonb_build_object('ok', false, 'erro', 'Pastor não encontrado.');
  end if;

  return jsonb_build_object('ok', true, 'nome', v_nome);
end;
$fn$;

revoke all on function public.remover_pastor(uuid) from public, anon;
grant execute on function public.remover_pastor(uuid) to authenticated;
