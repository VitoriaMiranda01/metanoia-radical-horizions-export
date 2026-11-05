-- Ocorrencias anteriores (05/11/2026, Patrick).
--
-- Pessoas com quem ja houve problema na portaria: ao digitar o CPF recebem um
-- comunicado e so seguem depois de escrever "Declaro que estou ciente". O
-- comunicado se repete em N edicoes (padrao 2). Organizadores e o Apoio da
-- portaria veem um asterisco vermelho no nome, com o texto e as declaracoes.
--
-- Os CPFs NAO ficam neste arquivo: sao cadastrados pelo modulo em Configuracoes
-- (a lista inicial do oficial foi gravada direto no banco).
--
-- Aparece quando: edicao atual >= a_partir_edicao, ainda nao declarou nesta
-- edicao, declaracoes < repeticoes, e (chegou a reuniao de inscricao OU as
-- inscricoes estao ligadas). Sem data e fechado (logo depois da virada), nao
-- aparece, para nao gastar uma repeticao antes da hora.

create table if not exists public.ocorrencias_pessoas (
  id uuid primary key default gen_random_uuid(),
  cpf text not null unique check (cpf ~ '^\d{11}$'),
  nome text not null,
  texto text not null,
  repeticoes int not null default 2 check (repeticoes between 0 and 20),
  a_partir_edicao int not null,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.ocorrencias_ciencias (
  id bigint generated always as identity primary key,
  ocorrencia_id uuid not null references public.ocorrencias_pessoas(id) on delete cascade,
  edicao int not null,
  declarado_em timestamptz not null default now(),
  unique (ocorrencia_id, edicao)
);

alter table public.ocorrencias_pessoas enable row level security;
alter table public.ocorrencias_ciencias enable row level security;
revoke all on public.ocorrencias_pessoas from public, anon, authenticated;
revoke all on public.ocorrencias_ciencias from public, anon, authenticated;

-- Caixa nova na janela de Permissoes.
create or replace function public._permissoes_organizador_validas()
returns text[]
language sql
immutable
as $function$
  select array['gerenciar_inscricoes', 'inscricao_manual', 'aprovacao_equipe',
               'geracao_escala', 'responsavel_reuniao', 'troca_diaria',
               'lancamento_escala', 'pagamentos', 'ocorrencias'];
$function$;

-- Eduardo ja entra com o modulo (pedido do Patrick).
update public.organizadores_auth
   set permissoes = array_append(coalesce(permissoes, '{}'), 'ocorrencias')
 where nome ilike 'Eduardo'
   and not ('ocorrencias' = any(coalesce(permissoes, '{}')));

create or replace function public._cpf_digitos(p_cpf text)
returns text
language sql
immutable
as $function$
  select regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
$function$;

-- A linha da ocorrencia cujo comunicado esta valendo para este CPF, ou nada.
create or replace function public._ocorrencia_pendente(p_cpf text)
returns public.ocorrencias_pessoas
language sql
stable
security definer
set search_path to 'public'
as $function$
  select o.*
    from public.ocorrencias_pessoas o
    cross join lateral (select c.edicao_numero, c.reuniao_inscricao_em,
                               c.inscricoes_equipantes, c.inscricoes_acampantes
                          from public.configuracoes c limit 1) c
   where o.cpf = public._cpf_digitos(p_cpf)
     and c.edicao_numero >= o.a_partir_edicao
     and (select count(*) from public.ocorrencias_ciencias s where s.ocorrencia_id = o.id) < o.repeticoes
     and not exists (select 1 from public.ocorrencias_ciencias s
                      where s.ocorrencia_id = o.id and s.edicao = c.edicao_numero)
     and (c.reuniao_inscricao_em <= (now() at time zone 'America/Sao_Paulo')::date
          or c.inscricoes_equipantes is true
          or c.inscricoes_acampantes is true)
   limit 1;
$function$;
revoke all on function public._ocorrencia_pendente(text) from public, anon, authenticated;
revoke all on function public._cpf_digitos(text) from public, anon, authenticated;

-- Publico: so responde sobre o CPF digitado.
create or replace function public.comunicado_do_cpf(p_cpf text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v public.ocorrencias_pessoas;
begin
  v := public._ocorrencia_pendente(p_cpf);
  if v.id is null then
    return jsonb_build_object('pendente', false);
  end if;
  return jsonb_build_object('pendente', true, 'texto', v.texto);
end;
$function$;

create or replace function public.comunicado_declarar(p_cpf text, p_frase text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v public.ocorrencias_pessoas;
  v_frase text;
begin
  v_frase := rtrim(lower(btrim(regexp_replace(coalesce(p_frase, ''), '\s+', ' ', 'g'))), '.');
  if v_frase <> 'declaro que estou ciente' then
    return jsonb_build_object('ok', false, 'erro', 'Escreva exatamente: Declaro que estou ciente');
  end if;
  v := public._ocorrencia_pendente(p_cpf);
  if v.id is null then
    return jsonb_build_object('ok', true);
  end if;
  insert into public.ocorrencias_ciencias (ocorrencia_id, edicao)
  values (v.id, (select c.edicao_numero from public.configuracoes c limit 1))
  on conflict (ocorrencia_id, edicao) do nothing;
  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.comunicado_do_cpf(text) from public;
revoke all on function public.comunicado_declarar(text, text) from public;
grant execute on function public.comunicado_do_cpf(text) to anon, authenticated;
grant execute on function public.comunicado_declarar(text, text) to anon, authenticated;

-- Asterisco: organizadores (nao parceiros) e Apoio da portaria. Devolve os ids
-- das fichas, sem CPF: a portaria nao recebe CPF de ninguem.
create or replace function public.ocorrencias_marcas()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not (public.eh_organizador() or public._portaria_logada() is not null) then
    return jsonb_build_object('ok', false, 'marcas', '[]'::jsonb);
  end if;
  return jsonb_build_object('ok', true, 'marcas', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id,
             'nome', o.nome,
             'texto', o.texto,
             'repeticoes', o.repeticoes,
             'ciencias', coalesce((
               select jsonb_agg(jsonb_build_object('edicao', s.edicao, 'em', s.declarado_em) order by s.declarado_em)
                 from public.ocorrencias_ciencias s where s.ocorrencia_id = o.id), '[]'::jsonb),
             'fichas', coalesce((
               select jsonb_agg(f.id) from (
                 select e.id from public.equipantes e where public._cpf_digitos(e.cpf) = o.cpf
                 union all
                 select a.id from public.acampantes a where public._cpf_digitos(a.cpf) = o.cpf
               ) f), '[]'::jsonb))
           order by o.nome)
      from public.ocorrencias_pessoas o), '[]'::jsonb));
end;
$function$;
revoke all on function public.ocorrencias_marcas() from public, anon;
grant execute on function public.ocorrencias_marcas() to authenticated;

-- Modulo em Configuracoes: Desenvolvedores e quem tem a caixa.
create or replace function public.ocorrencias_listar()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.org_pode('ocorrencias') then
    return jsonb_build_object('ok', false, 'erro', 'Você não tem permissão para este módulo.');
  end if;
  return jsonb_build_object('ok', true,
    'edicao', (select c.edicao_numero from public.configuracoes c limit 1),
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'cpf', o.cpf, 'nome', o.nome, 'texto', o.texto,
               'repeticoes', o.repeticoes, 'a_partir_edicao', o.a_partir_edicao,
               'criado_por', o.criado_por, 'criado_em', o.criado_em,
               'tem_ficha', exists (select 1 from public.equipantes e where public._cpf_digitos(e.cpf) = o.cpf)
                         or exists (select 1 from public.acampantes a where public._cpf_digitos(a.cpf) = o.cpf),
               'ciencias', coalesce((
                 select jsonb_agg(jsonb_build_object('edicao', s.edicao, 'em', s.declarado_em) order by s.declarado_em)
                   from public.ocorrencias_ciencias s where s.ocorrencia_id = o.id), '[]'::jsonb))
             order by o.nome)
        from public.ocorrencias_pessoas o), '[]'::jsonb));
end;
$function$;

create or replace function public.ocorrencia_salvar(
  p_id uuid, p_cpf text, p_nome text, p_texto text, p_repeticoes int, p_a_partir_edicao int)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cpf text := public._cpf_digitos(p_cpf);
  v_nome text := btrim(coalesce(p_nome, ''));
  v_texto text := btrim(coalesce(p_texto, ''));
  v_quem text := public._nome_organizador_logado();
begin
  if not public.org_pode('ocorrencias') then
    return jsonb_build_object('ok', false, 'erro', 'Você não tem permissão para este módulo.');
  end if;
  if not public._cpf_valido(v_cpf) then
    return jsonb_build_object('ok', false, 'erro', 'CPF inválido.');
  end if;
  if length(v_nome) < 3 then
    return jsonb_build_object('ok', false, 'erro', 'Informe o nome da pessoa.');
  end if;
  if length(v_texto) < 20 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o texto do comunicado.');
  end if;
  if p_repeticoes is null or p_repeticoes not between 0 and 20 then
    return jsonb_build_object('ok', false, 'erro', 'O número de repetições vai de 0 a 20.');
  end if;
  if p_a_partir_edicao is null or p_a_partir_edicao < 1 then
    return jsonb_build_object('ok', false, 'erro', 'Informe a partir de qual edição vale.');
  end if;
  if exists (select 1 from public.ocorrencias_pessoas o
              where o.cpf = v_cpf and o.id is distinct from p_id) then
    return jsonb_build_object('ok', false, 'erro', 'Este CPF já está na lista.');
  end if;

  if p_id is null then
    insert into public.ocorrencias_pessoas
      (cpf, nome, texto, repeticoes, a_partir_edicao, criado_por, atualizado_por)
    values (v_cpf, v_nome, v_texto, p_repeticoes, p_a_partir_edicao, v_quem, v_quem);
  else
    update public.ocorrencias_pessoas set
      cpf = v_cpf, nome = v_nome, texto = v_texto, repeticoes = p_repeticoes,
      a_partir_edicao = p_a_partir_edicao, atualizado_por = v_quem, atualizado_em = now()
     where id = p_id;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Registro não encontrado.');
    end if;
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.ocorrencia_excluir(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.org_pode('ocorrencias') then
    return jsonb_build_object('ok', false, 'erro', 'Você não tem permissão para este módulo.');
  end if;
  delete from public.ocorrencias_pessoas where id = p_id;
  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.ocorrencias_listar() from public, anon;
revoke all on function public.ocorrencia_salvar(uuid, text, text, text, int, int) from public, anon;
revoke all on function public.ocorrencia_excluir(uuid) from public, anon;
grant execute on function public.ocorrencias_listar() to authenticated;
grant execute on function public.ocorrencia_salvar(uuid, text, text, text, int, int) to authenticated;
grant execute on function public.ocorrencia_excluir(uuid) to authenticated;

-- O servidor tambem barra: sem declarar, nao cria inscricao por nenhum caminho
-- publico (acampante, equipante e So Domingo, com ou sem chave de teste).
do $patch$
declare
  v_def text := pg_get_functiondef('public.criar_inscricao(text, jsonb, text)'::regprocedure);
  v_ancora text := $a$  v_nome := btrim(coalesce(p_dados ->> 'nome', ''));$a$;
  v_novo text := $n$  if (public._ocorrencia_pendente(p_dados ->> 'cpf')).id is not null then
    raise exception 'COMUNICADO_PENDENTE';
  end if;

$n$;
begin
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'trecho não encontrado em criar_inscricao';
  end if;
  execute replace(v_def, v_ancora, v_novo || v_ancora);
end;
$patch$;
