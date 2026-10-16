-- 16/10/2026 (Patrick): o responsavel pela reuniao nao fica fixo.
--
-- Toda vez que a escala provisoria ou a oficial e desfeita, as delegacoes
-- ("Responsável pela reunião") voltam ao padrao -- ninguem delegado. Mesmo
-- gatilho que ja devolve a surpresa da area (migration 20261016b).

create or replace function public._surpresa_volta_ao_desfazer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (old.escala_lancada_em is not null and new.escala_lancada_em is null)
     or (old.escala_oficial_em is not null and new.escala_oficial_em is null) then
    update public.equipantes set area_vista_em = null where area_vista_em is not null;
    delete from public.responsaveis_reuniao where id is not null;
  end if;
  return null;
end;
$$;
