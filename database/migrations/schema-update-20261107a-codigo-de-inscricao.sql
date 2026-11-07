-- Codigo de inscricao do equipante (07/11/2026, Patrick).
--
-- Quem sabia que as inscricoes abrem as 16h do dia da reuniao ficava em casa e
-- se inscrevia sem ir a reuniao, passando na frente de quem estava la. Agora o
-- equipante (todos os dias) so se inscreve com um codigo que a organizacao
-- passa na hora: na reuniao, ou para quem esta de plantao, doente, cuidando de
-- alguem etc.
--
-- Regras combinadas:
--  * Obrigatorio para TODO equipante que se inscreve para todos os dias,
--    inclusive quem tem ficha de edicao anterior e mesmo com a chave de teste.
--  * So Domingo nao pede codigo. Acampante nao pede codigo.
--  * Inscricao manual da organizacao (inscricao_manual_equipante) nao passa por
--    aqui: e a propria organizacao que inscreve.
--  * Codigo livre (varias pessoas usam o mesmo), com liga/desliga.
--  * Maiusculas, acentos e espacos nao contam ("Paz 2026" = "paz2026").
--  * Vale so para a edicao em que foi criado: na virada a edicao nova comeca
--    sem codigo, e sem codigo ativo ninguem se inscreve para todos os dias.
--  * Qualquer organizador (nao parceiro) cria, liga/desliga e exclui.
--  * Fica gravado na ficha qual codigo a pessoa usou (equipantes.codigo_inscricao).

create table if not exists public.codigos_inscricao (
  id uuid primary key default gen_random_uuid(),
  edicao int not null,
  codigo text not null check (length(btrim(codigo)) between 3 and 40),
  codigo_norm text not null,
  ativo boolean not null default true,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz not null default now(),
  unique (edicao, codigo_norm)
);
alter table public.codigos_inscricao enable row level security;
revoke all on public.codigos_inscricao from public, anon, authenticated;

-- Coluna nova em equipantes: SEM not null (criar_inscricao usa
-- jsonb_populate_record; ver memoria de 15/10/2026).
alter table public.equipantes add column if not exists codigo_inscricao text;

create or replace function public._codigo_inscricao_norm(p text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select public.unaccent_simples(lower(regexp_replace(coalesce(p, ''), '\s+', '', 'g')));
$function$;
revoke all on function public._codigo_inscricao_norm(text) from public, anon, authenticated;

-- O codigo (como foi cadastrado) se estiver ativo na edicao atual; senao, nulo.
create or replace function public._codigo_inscricao_valido(p_codigo text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select k.codigo
    from public.codigos_inscricao k
   where k.ativo
     and k.edicao = (select c.edicao_numero from public.configuracoes c limit 1)
     and k.codigo_norm = public._codigo_inscricao_norm(p_codigo)
     and public._codigo_inscricao_norm(p_codigo) <> ''
   limit 1;
$function$;
revoke all on function public._codigo_inscricao_valido(text) from public, anon, authenticated;

-- Publico: confere o codigo digitado. Resposta errada demora um pouco, para
-- ninguem ficar chutando codigos em sequencia.
create or replace function public.codigo_inscricao_conferir(p_codigo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v text := public._codigo_inscricao_valido(p_codigo);
begin
  if v is null then
    perform pg_sleep(0.8);
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function public.codigo_inscricao_conferir(text) from public;
grant execute on function public.codigo_inscricao_conferir(text) to anon, authenticated;

-- Modulo em Configuracoes (qualquer organizador).
create or replace function public.codigos_inscricao_listar()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_ed int := (select c.edicao_numero from public.configuracoes c limit 1);
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores.');
  end if;
  return jsonb_build_object('ok', true,
    'edicao', v_ed,
    'codigos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', k.id, 'codigo', k.codigo, 'ativo', k.ativo,
               'criado_por', k.criado_por, 'criado_em', k.criado_em,
               'atualizado_por', k.atualizado_por, 'atualizado_em', k.atualizado_em,
               'usos', (select count(*) from public.equipantes e
                         where e.codigo_inscricao = k.codigo
                           and e.numero_edicao = k.edicao
                           and e.inscrito is true))
             order by k.criado_em)
        from public.codigos_inscricao k
       where k.edicao = v_ed), '[]'::jsonb));
end;
$function$;

create or replace function public.codigo_inscricao_criar(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_codigo text := btrim(regexp_replace(coalesce(p_codigo, ''), '\s+', ' ', 'g'));
  v_ed int := (select c.edicao_numero from public.configuracoes c limit 1);
  v_quem text := public._nome_organizador_logado();
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores.');
  end if;
  if length(public._codigo_inscricao_norm(v_codigo)) < 3 or length(v_codigo) > 40 then
    return jsonb_build_object('ok', false, 'erro', 'O código precisa ter de 3 a 40 caracteres.');
  end if;
  if exists (select 1 from public.codigos_inscricao k
              where k.edicao = v_ed and k.codigo_norm = public._codigo_inscricao_norm(v_codigo)) then
    return jsonb_build_object('ok', false, 'erro', 'Esse código já existe nesta edição.');
  end if;
  insert into public.codigos_inscricao (edicao, codigo, codigo_norm, criado_por, atualizado_por)
  values (v_ed, v_codigo, public._codigo_inscricao_norm(v_codigo), v_quem, v_quem);
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.codigo_inscricao_ativar(p_id uuid, p_ativo boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores.');
  end if;
  update public.codigos_inscricao
     set ativo = coalesce(p_ativo, false),
         atualizado_por = public._nome_organizador_logado(),
         atualizado_em = now()
   where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Código não encontrado.');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

-- Excluir so se ninguem usou: quem ja usou fica com o registro na ficha, e o
-- codigo precisa continuar na lista. Usado = desligar.
create or replace function public.codigo_inscricao_excluir(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  k public.codigos_inscricao;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores.');
  end if;
  select * into k from public.codigos_inscricao where id = p_id;
  if k.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Código não encontrado.');
  end if;
  if exists (select 1 from public.equipantes e
              where e.codigo_inscricao = k.codigo and e.numero_edicao = k.edicao) then
    return jsonb_build_object('ok', false, 'erro', 'Esse código já foi usado. Desative em vez de excluir.');
  end if;
  delete from public.codigos_inscricao where id = p_id;
  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.codigos_inscricao_listar() from public, anon;
revoke all on function public.codigo_inscricao_criar(text) from public, anon;
revoke all on function public.codigo_inscricao_ativar(uuid, boolean) from public, anon;
revoke all on function public.codigo_inscricao_excluir(uuid) from public, anon;
grant execute on function public.codigos_inscricao_listar() to authenticated;
grant execute on function public.codigo_inscricao_criar(text) to authenticated;
grant execute on function public.codigo_inscricao_ativar(uuid, boolean) to authenticated;
grant execute on function public.codigo_inscricao_excluir(uuid) to authenticated;

-- criar_inscricao: equipante (todos os dias) sem codigo valido nao entra, por
-- nenhum caminho publico, nem com chave de teste. Grava o codigo usado.
do $patch$
declare
  v_def text := pg_get_functiondef('public.criar_inscricao(text, jsonb, text)'::regprocedure);
  v_trocas text[][] := array[
    array[$a$  v_domingo boolean := false;$a$,
          $n$  v_domingo boolean := false;
  v_codigo  text;$n$],
    array[$a$  v_nome := btrim(coalesce(p_dados ->> 'nome', ''));$a$,
          $n$  -- Codigo de inscricao (20261107a): so equipante de todos os dias.
  if p_tipo = 'equipante' and not v_domingo then
    v_codigo := public._codigo_inscricao_valido(p_dados ->> 'codigo_inscricao');
    if v_codigo is null then
      raise exception 'CODIGO_INSCRICAO_INVALIDO';
    end if;
  end if;

  v_nome := btrim(coalesce(p_dados ->> 'nome', ''));$n$],
    array[$a$        so_domingo                   = v_domingo,$a$,
          $n$        so_domingo                   = v_domingo,
        codigo_inscricao             = v_codigo,$n$],
    array[$a$    v_e.so_domingo := v_domingo;$a$,
          $n$    v_e.so_domingo := v_domingo;
    v_e.codigo_inscricao := v_codigo;$n$]
  ];
  i int;
begin
  for i in 1 .. array_length(v_trocas, 1) loop
    if (length(v_def) - length(replace(v_def, v_trocas[i][1], ''))) / length(v_trocas[i][1]) <> 1 then
      raise exception 'trecho % não encontrado em criar_inscricao', i;
    end if;
    v_def := replace(v_def, v_trocas[i][1], v_trocas[i][2]);
  end loop;
  execute v_def;
end;
$patch$;

-- Virada: a ficha que passa para a edicao nova nao carrega o codigo da antiga.
do $patch$
declare
  v_sig regprocedure := (select p.oid::regprocedure from pg_proc p
                           join pg_namespace n on n.oid = p.pronamespace
                          where n.nspname = 'public' and p.proname = 'resetar_para_nova_edicao');
  v_def text := pg_get_functiondef(v_sig);
  v_ancora text := $a$    inscrito_em            = null,$a$;
begin
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'trecho não encontrado em resetar_para_nova_edicao';
  end if;
  execute replace(v_def, v_ancora, v_ancora || E'\n    codigo_inscricao       = null,');
end;
$patch$;
