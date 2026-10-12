-- ---------------------------------------------------------------------------
-- Vinculos entre acampantes para os GRUPOS DE TRILHA (Patrick, 12/10/2026).
--
-- Quem monta os grupos separa quem vem junto (conjuge, amigo, parente): cada um
-- em um grupo diferente. A troca de grupo e estrategica. O vinculo e cadastrado
-- uma vez e vale para os dois ("Jorge <-> Gilson, amigo"); a tela mostra em que
-- grupo o outro esta e AVISA quando os dois ficam no mesmo -- nao bloqueia:
-- com 5 grupos e 6 amigos, alguem fica junto.
--
-- Regras:
--  * So organizadores (eh_organizador). As tabelas ficam fechadas; tudo passa
--    pelas funcoes abaixo.
--  * So acampantes. Equipante nao tem vinculo.
--  * tipo e o que B e de A ("B e PAI / MÃE de A"). A tela espelha para o outro
--    lado (pai/mae <-> filho/filha, tio <-> sobrinho, avo <-> neto).
--  * O que o acampante escreveu na inscricao ("Vai com: Gilson Campos") vira
--    SUGESTAO na tela; vira vinculo so quando um organizador confirma
--    (origem_acampante = quem escreveu). A sugestao pode ser ignorada (e
--    desfeita depois).
--  * Apagar o acampante (ou virar a edicao) apaga os vinculos dele junto.
--  * Sorteio da inscricao: evita o grupo de quem tem exatamente o nome citado
--    (e de quem ja citou o nome de quem esta se inscrevendo).
-- ---------------------------------------------------------------------------

create table if not exists public.acampantes_vinculos (
  id               uuid primary key default gen_random_uuid(),
  acampante_a      uuid not null references public.acampantes(id) on delete cascade,
  acampante_b      uuid not null references public.acampantes(id) on delete cascade,
  tipo             text not null,
  observacao       text,
  origem_acampante uuid references public.acampantes(id) on delete set null,
  criado_por       text,
  criado_em        timestamptz not null default now(),
  constraint acampantes_vinculos_dois_diferentes check (acampante_a <> acampante_b),
  constraint acampantes_vinculos_tipo check (tipo in (
    'CONJUGE', 'PAI / MÃE', 'FILHO / FILHA', 'IRMÃO / IRMÃ', 'AVÔ / AVÓ', 'NETO / NETA',
    'TIO / TIA', 'SOBRINHO / SOBRINHA', 'PRIMO / PRIMA', 'AMIGO / AMIGA',
    'COLEGA DE TRABALHO', 'COLEGA DE ESCOLA', 'VIZINHO / VIZINHA', 'OUTRO'))
);
create unique index if not exists acampantes_vinculos_par_idx
  on public.acampantes_vinculos (least(acampante_a, acampante_b), greatest(acampante_a, acampante_b));
create index if not exists acampantes_vinculos_b_idx on public.acampantes_vinculos (acampante_b);

create table if not exists public.acampantes_sugestoes_ignoradas (
  acampante_id  uuid primary key references public.acampantes(id) on delete cascade,
  ignorado_por  text,
  ignorado_em   timestamptz not null default now()
);

alter table public.acampantes_vinculos            enable row level security;
alter table public.acampantes_sugestoes_ignoradas enable row level security;
revoke all on public.acampantes_vinculos            from anon, authenticated;
revoke all on public.acampantes_sugestoes_ignoradas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ler tudo de uma vez (a tela cruza com a lista de acampantes que ja tem).
-- ---------------------------------------------------------------------------
create or replace function public.vinculos_acampantes()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador() then
    raise exception 'Só organizadores veem os vínculos dos acampantes.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'vinculos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'a', v.acampante_a, 'b', v.acampante_b, 'tipo', v.tipo,
        'observacao', v.observacao, 'origem', v.origem_acampante,
        'criado_por', v.criado_por, 'criado_em', v.criado_em) order by v.criado_em)
      from public.acampantes_vinculos v), '[]'::jsonb),
    'ignoradas', coalesce((
      select jsonb_agg(i.acampante_id) from public.acampantes_sugestoes_ignoradas i), '[]'::jsonb)
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Criar (ou atualizar, se o par ja existe) um vinculo.
-- ---------------------------------------------------------------------------
create or replace function public.salvar_vinculo_acampantes(
  p_a uuid, p_b uuid, p_tipo text, p_observacao text default null, p_origem uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_id   uuid;
  v_novo boolean;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores cadastram vínculos.');
  end if;
  if p_a is null or p_b is null or p_a = p_b then
    return jsonb_build_object('ok', false, 'erro', 'Escolha duas pessoas diferentes.');
  end if;
  if (select count(*) from public.acampantes where id in (p_a, p_b)) <> 2 then
    return jsonb_build_object('ok', false, 'erro', 'Acampante não encontrado (a inscrição pode ter sido apagada).');
  end if;
  if p_origem is not null and p_origem not in (p_a, p_b) then
    p_origem := null;
  end if;

  select id into v_id from public.acampantes_vinculos
   where least(acampante_a, acampante_b) = least(p_a, p_b)
     and greatest(acampante_a, acampante_b) = greatest(p_a, p_b);
  v_novo := v_id is null;

  if v_novo then
    insert into public.acampantes_vinculos (acampante_a, acampante_b, tipo, observacao, origem_acampante, criado_por)
    values (p_a, p_b, p_tipo, nullif(trim(p_observacao), ''), p_origem, public._nome_organizador_logado())
    returning id into v_id;
  else
    -- O par ja existe: grava o tipo do jeito que veio agora (A e B nesta ordem).
    update public.acampantes_vinculos
       set acampante_a = p_a, acampante_b = p_b, tipo = p_tipo,
           observacao = coalesce(nullif(trim(p_observacao), ''), observacao),
           origem_acampante = coalesce(p_origem, origem_acampante)
     where id = v_id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'novo', v_novo);
exception when check_violation then
  return jsonb_build_object('ok', false, 'erro', 'Tipo de vínculo inválido.');
end;
$fn$;

create or replace function public.excluir_vinculo_acampantes(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores excluem vínculos.');
  end if;
  delete from public.acampantes_vinculos where id = p_id;
  return jsonb_build_object('ok', true, 'excluido', found);
end;
$fn$;

-- p_ignorar = true esconde a sugestao da inscricao; false a traz de volta.
create or replace function public.ignorar_sugestao_vinculo(p_acampante uuid, p_ignorar boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores mexem nas sugestões.');
  end if;
  if p_ignorar then
    insert into public.acampantes_sugestoes_ignoradas (acampante_id, ignorado_por)
    select id, public._nome_organizador_logado() from public.acampantes where id = p_acampante
    on conflict (acampante_id) do nothing;
  else
    delete from public.acampantes_sugestoes_ignoradas where acampante_id = p_acampante;
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.vinculos_acampantes()                                   from public, anon;
revoke all on function public.salvar_vinculo_acampantes(uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.excluir_vinculo_acampantes(uuid)                         from public, anon;
revoke all on function public.ignorar_sugestao_vinculo(uuid, boolean)                  from public, anon;
grant execute on function public.vinculos_acampantes()                                   to authenticated;
grant execute on function public.salvar_vinculo_acampantes(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.excluir_vinculo_acampantes(uuid)                         to authenticated;
grant execute on function public.ignorar_sugestao_vinculo(uuid, boolean)                  to authenticated;

-- ---------------------------------------------------------------------------
-- Sorteio do grupo na inscricao: antes de equilibrar pastores e sexo, evita o
-- grupo de quem foi citado pelo nome (comparado sem acento, caixa, pontuacao
-- e "de/da/do/dos/das/e") e de quem citou o nome de quem esta se inscrevendo.
-- ---------------------------------------------------------------------------
create or replace function public._nome_comparavel(p text)
returns text
language sql
immutable
set search_path to 'public'
as $fn$
  select nullif(trim(regexp_replace(
           regexp_replace(
             ' ' || regexp_replace(
               lower(translate(coalesce(p, ''),
                 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
                 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
               '[^a-z]+', ' ', 'g') || ' ',
             ' (de|da|do|dos|das|e)(?= )', '', 'g'),
           ' +', ' ', 'g')), '');
$fn$;

drop function if exists public._escolher_grupo_trailha(text, text);

create or replace function public._escolher_grupo_trailha(
  p_sexo text, p_cargo_igreja text default null, p_nome text default null, p_conhecido text default null)
returns text
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select g.nome
  from (values ('Vermelho'),('Amarelo'),('Verde'),('Azul'),('Roxo')) as g(nome)
  left join public.acampantes a
    on a.grupo_trailha = g.nome
  group by g.nome
  order by
    count(a.id) filter (
      where (public._nome_comparavel(p_conhecido) is not null
             and public._nome_comparavel(a.nome) = public._nome_comparavel(p_conhecido))
         or (public._nome_comparavel(p_nome) is not null
             and a.conhecido_no_projeto is distinct from 'NÃO TENHO'
             and public._nome_comparavel(a.nome_familiar_conhecido) = public._nome_comparavel(p_nome))
    ) asc,
    count(a.id) filter (
      where p_cargo_igreja in ('PASTOR(A)', 'PASTOR(A) AUXILIAR')
        and a.cargo_igreja in ('PASTOR(A)', 'PASTOR(A) AUXILIAR')
    ) asc,
    count(a.id) filter (where a.sexo is not distinct from p_sexo) asc,
    g.nome asc
  limit 1;
$fn$;

revoke all on function public._escolher_grupo_trailha(text, text, text, text) from public, anon, authenticated;
revoke all on function public._nome_comparavel(text) from public, anon, authenticated;

-- criar_inscricao passa o nome e o "vai com" para o sorteio.
create or replace function pg_temp._patch(p regprocedure, de text, para text, vezes int)
returns void language plpgsql as $p$
declare d text := pg_get_functiondef(p); n int;
begin
  n := (length(d) - length(replace(d, de, ''))) / length(de);
  if n <> vezes then
    raise exception 'patch em %: esperava % ocorrencia(s) de [%], achei %', p, vezes, de, n;
  end if;
  execute replace(d, de, para);
end;
$p$;

select pg_temp._patch(
  'public.criar_inscricao(text,jsonb,text)'::regprocedure,
  'public._escolher_grupo_trailha(v_a.sexo, v_a.cargo_igreja)',
  'public._escolher_grupo_trailha(v_a.sexo, v_a.cargo_igreja, v_a.nome,' || chr(10)
    || '    case when v_a.conhecido_no_projeto is distinct from ''NÃO TENHO'' then v_a.nome_familiar_conhecido end)',
  1);
