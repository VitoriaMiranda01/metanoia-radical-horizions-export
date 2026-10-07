-- ---------------------------------------------------------------------------
-- Registro simples de "o convite do grupo de WhatsApp ja foi enviado"
-- (pedido da Raquel, 06/10/2026), na tela de Pagamentos.
--
-- Quem acabou de pagar entra em "Pagos" e a Raquel manda o link do grupo pelo
-- WhatsApp. Para nao ter que rolar a lista procurando ate onde foi, cada
-- clique no botao do WhatsApp (ou a marcacao manual) grava o dia, a hora e
-- quem foi. O primeiro envio fica; cliques seguintes nao mudam a data.
--
-- Qualquer organizador marca e desmarca. Acampante e equipante na mesma
-- tabela (uma coluna de cada, so uma preenchida); apaga junto com a ficha.
-- A auditoria (20261006g) registra.
-- ---------------------------------------------------------------------------

create table if not exists public.grupo_whatsapp_enviado (
  id           bigint generated always as identity primary key,
  acampante_id uuid references public.acampantes(id) on delete cascade,
  equipante_id uuid references public.equipantes(id) on delete cascade,
  enviado_em   timestamptz not null default now(),
  enviado_por  text not null,
  check ((acampante_id is null) <> (equipante_id is null))
);
create unique index if not exists grupo_enviado_acampante_uq
  on public.grupo_whatsapp_enviado (acampante_id) where acampante_id is not null;
create unique index if not exists grupo_enviado_equipante_uq
  on public.grupo_whatsapp_enviado (equipante_id) where equipante_id is not null;
alter table public.grupo_whatsapp_enviado enable row level security;
revoke all on public.grupo_whatsapp_enviado from anon, authenticated;

-- { "<id da ficha>": { "em": ..., "por": "Raquel" } }
create or replace function public.grupo_enviado_listar()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $fn$
begin
  if public._nome_organizador_logado() is null then
    raise exception 'SEM_PERMISSAO';
  end if;
  return coalesce((
    select jsonb_object_agg(coalesce(g.acampante_id, g.equipante_id),
             jsonb_build_object('em', g.enviado_em, 'por', g.enviado_por))
      from public.grupo_whatsapp_enviado g), '{}'::jsonb);
end;
$fn$;

-- Marca uma ou varias fichas como "convite enviado". Quem ja estava marcada
-- fica como estava. Devolve quantas foram marcadas agora.
create or replace function public.grupo_enviado_marcar(p_tipo text, p_ids uuid[])
returns int
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_org text := public._nome_organizador_logado();
  v_n int;
begin
  if v_org is null then
    raise exception 'SEM_PERMISSAO';
  end if;
  if p_tipo not in ('acampante', 'equipante') then
    raise exception 'TIPO_INVALIDO';
  end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then
    return 0;
  end if;
  if array_length(p_ids, 1) > 2000 then
    raise exception 'MUITAS_FICHAS';
  end if;

  if p_tipo = 'acampante' then
    insert into public.grupo_whatsapp_enviado (acampante_id, enviado_por)
    select a.id, v_org from public.acampantes a where a.id = any(p_ids)
    on conflict do nothing;
  else
    insert into public.grupo_whatsapp_enviado (equipante_id, enviado_por)
    select e.id, v_org from public.equipantes e where e.id = any(p_ids)
    on conflict do nothing;
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end;
$fn$;

-- Tira a marca (marcou sem querer, ou vai mandar de novo).
create or replace function public.grupo_enviado_desmarcar(p_tipo text, p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if public._nome_organizador_logado() is null then
    raise exception 'SEM_PERMISSAO';
  end if;
  if p_tipo = 'acampante' then
    delete from public.grupo_whatsapp_enviado where acampante_id = p_id;
  elsif p_tipo = 'equipante' then
    delete from public.grupo_whatsapp_enviado where equipante_id = p_id;
  else
    raise exception 'TIPO_INVALIDO';
  end if;
end;
$fn$;

-- Auditoria: nome da pessoa no registro.
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

select pg_temp._patch('public._aud_rotulo(text,jsonb)',
  $$when 'configuracoes' then 'Configurações'$$,
  $$when 'grupo_whatsapp_enviado' then coalesce(
      (select a.nome from public.acampantes a where a.id::text = j ->> 'acampante_id'),
      (select e.nome from public.equipantes e where e.id::text = j ->> 'equipante_id'))
    when 'configuracoes' then 'Configurações'$$);

drop trigger if exists auditoria_i on public.grupo_whatsapp_enviado;
drop trigger if exists auditoria_d on public.grupo_whatsapp_enviado;
create trigger auditoria_i after insert on public.grupo_whatsapp_enviado referencing new table as novos
  for each statement execute function public._auditar('id');
create trigger auditoria_d after delete on public.grupo_whatsapp_enviado referencing old table as velhos
  for each statement execute function public._auditar('id');

revoke all on function public._aud_rotulo(text, jsonb) from public, anon, authenticated;
revoke all on function public.grupo_enviado_listar() from public, anon;
revoke all on function public.grupo_enviado_marcar(text, uuid[]) from public, anon;
revoke all on function public.grupo_enviado_desmarcar(text, uuid) from public, anon;
grant execute on function public.grupo_enviado_listar() to authenticated;
grant execute on function public.grupo_enviado_marcar(text, uuid[]) to authenticated;
grant execute on function public.grupo_enviado_desmarcar(text, uuid) to authenticated;
