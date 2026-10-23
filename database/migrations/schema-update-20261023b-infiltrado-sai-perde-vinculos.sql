-- ---------------------------------------------------------------------------
-- Quem sai de Infiltrados perde os vinculos (Patrick, 23/10/2026).
--
-- Desde 20261023a o infiltrado entra nos vinculos ja na escala provisoria.
-- Se a escala dele sai de "Infiltrados" (troca de area, Nao sera escalado,
-- removido da escala), os vinculos dele sao apagados -- a nao ser que ele
-- continue podendo ter vinculo (outra linha em Infiltrados).
-- Acampante que desiste ja perde os vinculos (desistir_acampante, 20261020a).
-- ---------------------------------------------------------------------------

create or replace function public._infiltrado_sai_perde_vinculos()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if old.area_alocada is distinct from 'Infiltrados' then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.area_alocada is not distinct from 'Infiltrados'
     and new.equipante_id = old.equipante_id then
    return null;
  end if;
  if not public._pode_ter_vinculo(old.equipante_id) then
    delete from public.acampantes_vinculos
     where acampante_a = old.equipante_id or acampante_b = old.equipante_id;
  end if;
  return null;
end;
$fn$;
revoke all on function public._infiltrado_sai_perde_vinculos() from public, anon, authenticated;

drop trigger if exists infiltrado_sai_perde_vinculos on public.escalas;
create trigger infiltrado_sai_perde_vinculos
  after delete or update of area_alocada, equipante_id on public.escalas
  for each row execute function public._infiltrado_sai_perde_vinculos();
