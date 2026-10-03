-- =============================================================================
-- Limite de tentativas de login (03/10/2026)
--
-- Pedido do Patrick: protecao simples. 10 senhas erradas seguidas (em ate
-- 10 minutos uma da outra) bloqueiam aquele login por 10 minutos. Vale para
-- organizador (pelo nome) e para igreja (pelo codigo).
--
-- Quem conta e a Edge Function "login", com a service_role:
--   login_bloqueado_ate  -> antes de conferir a senha
--   registrar_falha_login -> a cada senha errada (ou usuario inexistente:
--                            conta igual, para nao revelar quais existem)
--   limpar_falhas_login  -> quando a senha confere
--
-- A conta Desenvolvedores ve quem esta bloqueado e pode liberar na hora
-- (logins_bloqueados / liberar_login), nas telas de senhas.
-- =============================================================================

create table if not exists public.login_tentativas (
  tipo          text not null check (tipo in ('organizador', 'igreja')),
  identificador text not null,
  falhas        integer not null default 0,
  ultima_falha  timestamptz,
  bloqueado_ate timestamptz,
  primary key (tipo, identificador)
);

alter table public.login_tentativas enable row level security;
revoke all on public.login_tentativas from public, anon, authenticated;
grant all on public.login_tentativas to service_role;


create or replace function public.login_bloqueado_ate(p_tipo text, p_identificador text)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select bloqueado_ate
    from public.login_tentativas
   where tipo = p_tipo
     and identificador = lower(btrim(coalesce(p_identificador, '')))
     and bloqueado_ate > now();
$$;


-- Devolve o horario do bloqueio quando esta falha completou as 10;
-- null enquanto ainda ha tentativas.
create or replace function public.registrar_falha_login(p_tipo text, p_identificador text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.login_tentativas;
begin
  insert into public.login_tentativas as t (tipo, identificador, falhas, ultima_falha)
  values (p_tipo, lower(btrim(coalesce(p_identificador, ''))), 1, now())
  on conflict (tipo, identificador) do update set
    -- Recomeca a contagem se a ultima falha foi ha mais de 10 minutos ou se
    -- um bloqueio anterior ja venceu.
    falhas = case
               when t.ultima_falha < now() - interval '10 minutes'
                 or (t.bloqueado_ate is not null and t.bloqueado_ate <= now())
               then 1
               else t.falhas + 1
             end,
    ultima_falha = now(),
    bloqueado_ate = case when t.bloqueado_ate > now() then t.bloqueado_ate end
  returning * into v;

  if v.falhas >= 10 and v.bloqueado_ate is null then
    update public.login_tentativas
       set bloqueado_ate = now() + interval '10 minutes'
     where tipo = v.tipo and identificador = v.identificador
    returning * into v;
  end if;

  -- Faxina: tentativas velhas nao servem para nada.
  delete from public.login_tentativas
   where ultima_falha < now() - interval '1 day'
     and (bloqueado_ate is null or bloqueado_ate < now());

  return v.bloqueado_ate;
end;
$$;


create or replace function public.limpar_falhas_login(p_tipo text, p_identificador text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.login_tentativas
   where tipo = p_tipo and identificador = lower(btrim(coalesce(p_identificador, '')));
$$;


-- Para as telas (so a conta Desenvolvedores recebe algo).
create or replace function public.logins_bloqueados()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.eh_organizador_maximo() then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'tipo', t.tipo,
             'identificador', t.identificador,
             'bloqueado_ate', t.bloqueado_ate,
             'falhas', t.falhas
           ) order by t.bloqueado_ate)
      from public.login_tentativas t
     where t.bloqueado_ate > now()
  ), '[]'::jsonb);
end;
$$;


create or replace function public.liberar_login(p_tipo text, p_identificador text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro', 'Só a conta Desenvolvedores pode liberar.');
  end if;

  delete from public.login_tentativas
   where tipo = p_tipo and identificador = lower(btrim(coalesce(p_identificador, '')));
  get diagnostics n = row_count;

  return jsonb_build_object('ok', true, 'liberado', n > 0);
end;
$$;


revoke all on function public.login_bloqueado_ate(text, text) from public, anon, authenticated;
revoke all on function public.registrar_falha_login(text, text) from public, anon, authenticated;
revoke all on function public.limpar_falhas_login(text, text) from public, anon, authenticated;
grant execute on function public.login_bloqueado_ate(text, text) to service_role;
grant execute on function public.registrar_falha_login(text, text) to service_role;
grant execute on function public.limpar_falhas_login(text, text) to service_role;

revoke all on function public.logins_bloqueados() from public, anon, authenticated;
revoke all on function public.liberar_login(text, text) from public, anon, authenticated;
grant execute on function public.logins_bloqueados() to authenticated;
grant execute on function public.liberar_login(text, text) to authenticated;
