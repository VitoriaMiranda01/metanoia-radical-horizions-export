-- Presenca automatica na chamada para DDD 22 e 24 (Patrick, 28/10/2026).
--
-- Quem mora em outra cidade (WhatsApp com DDD 22 ou 24) ja entra PRESENTE na
-- chamada da reuniao de escala, sem ninguem marcar. Vale so para equipante
-- escalado (fora "Não será escalado") e so depois de lancada a provisoria
-- (antes disso a area ainda e surpresa e a presenca libera o grupo).
--
-- A presenca fica gravada em chamada_escala como as outras, com
-- marcado_por = 'Automático · mora em outra cidade (DDD 22/24)'. Assim todas as
-- telas, contas, exportacoes e o grupo de WhatsApp ja enxergam como presente.
--   - O lider (ou a organizacao) marca AUSENTE: vale a marcacao dele.
--   - Tirou a marcacao (nem presente nem ausente): volta a presenca automatica.
--   - Trocou de area: a presenca automatica acompanha (menos se a pessoa tinha
--     sido marcada ausente a mao -- essa decisao nao e desfeita sozinha).
--   - Trocou o WhatsApp para outro DDD: a presenca automatica sai.
-- Nada de marcacao manual e sobrescrito.

-- 1. DDD 22 ou 24 (com ou sem o 55 na frente).
create or replace function public._ddd_outra_cidade(p_whatsapp text)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select case
           when length(d) in (10, 11) then left(d, 2) in ('22', '24')
           when length(d) in (12, 13) and left(d, 2) = '55' then substr(d, 3, 2) in ('22', '24')
           else false
         end
    from (select regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g') as d) x;
$$;

create or replace function public._marca_presenca_automatica()
returns text
language sql
immutable
set search_path to 'public'
as $$ select 'Automático · mora em outra cidade (DDD 22/24)'::text $$;

-- 2. Acerta a presenca automatica de uma participacao.
create or replace function public._presenca_automatica(p_escala_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_area text;
  v_whatsapp text;
  v_quer boolean;
  c record;
begin
  select s.area_alocada, e.whatsapp into v_area, v_whatsapp
    from public.escalas s
    join public.equipantes e on e.id = s.equipante_id
   where s.id = p_escala_id;
  if not found then
    return;
  end if;

  v_quer := v_area is not null
            and v_area <> 'Não será escalado'
            and (select escala_lancada_em from public.configuracoes limit 1) is not null
            and public._ddd_outra_cidade(v_whatsapp);

  select * into c from public.chamada_escala where escala_id = p_escala_id;

  if v_quer then
    if c.escala_id is null
       or (c.area is distinct from v_area
           and (c.marcado_por = public._marca_presenca_automatica() or c.presente)) then
      insert into public.chamada_escala (escala_id, area, presente, marcado_por, marcado_em)
      values (p_escala_id, v_area, true, public._marca_presenca_automatica(), now())
      on conflict (escala_id) do update
        set area = excluded.area,
            presente = true,
            marcado_por = excluded.marcado_por,
            marcado_em = excluded.marcado_em,
            mantido_em = null,
            mantido_por = null,
            convite_enviado_em = case when chamada_escala.area = excluded.area
                                      then chamada_escala.convite_enviado_em end;
    end if;
  elsif c.escala_id is not null and c.marcado_por = public._marca_presenca_automatica() then
    delete from public.chamada_escala where escala_id = p_escala_id;
  end if;
end;
$$;

revoke all on function public._ddd_outra_cidade(text) from public, anon, authenticated;
revoke all on function public._marca_presenca_automatica() from public, anon, authenticated;
revoke all on function public._presenca_automatica(uuid) from public, anon, authenticated;

-- 3. Gatilhos: entrou/trocou de area, trocou o WhatsApp, lancou a provisoria.
create or replace function public._tg_presenca_automatica_escala()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public._presenca_automatica(new.id);
  return null;
end;
$$;

create or replace function public._tg_presenca_automatica_whatsapp()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public._presenca_automatica(s.id) from public.escalas s where s.equipante_id = new.id;
  return null;
end;
$$;

create or replace function public._tg_presenca_automatica_lancamento()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public._presenca_automatica(s.id) from public.escalas s;
  return null;
end;
$$;

revoke all on function public._tg_presenca_automatica_escala() from public, anon, authenticated;
revoke all on function public._tg_presenca_automatica_whatsapp() from public, anon, authenticated;
revoke all on function public._tg_presenca_automatica_lancamento() from public, anon, authenticated;

drop trigger if exists presenca_automatica on public.escalas;
create trigger presenca_automatica
  after insert or update of area_alocada, equipante_id on public.escalas
  for each row execute function public._tg_presenca_automatica_escala();

drop trigger if exists presenca_automatica on public.equipantes;
create trigger presenca_automatica
  after update of whatsapp on public.equipantes
  for each row when (old.whatsapp is distinct from new.whatsapp)
  execute function public._tg_presenca_automatica_whatsapp();

drop trigger if exists presenca_automatica on public.configuracoes;
create trigger presenca_automatica
  after update of escala_lancada_em on public.configuracoes
  for each row when (old.escala_lancada_em is null and new.escala_lancada_em is not null)
  execute function public._tg_presenca_automatica_lancamento();

-- 4. Tirar a marcacao (presente = null) volta para a presenca automatica.
do $$
declare
  v_fn text;
  v_def text;
  v_old text := 'delete from public.chamada_escala where escala_id = p_escala_id;';
begin
  foreach v_fn in array array['public.lider_marcar_presenca', 'public.organizador_marcar_presenca'] loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p where p.oid = v_fn::regproc;
    if position(v_old in v_def) = 0 then
      raise exception 'trecho não encontrado em %', v_fn;
    end if;
    execute replace(v_def, v_old, v_old || E'\n    perform public._presenca_automatica(p_escala_id);');
  end loop;
end $$;

-- 5. Quem ja esta escalado hoje.
select public._presenca_automatica(s.id) from public.escalas s;
