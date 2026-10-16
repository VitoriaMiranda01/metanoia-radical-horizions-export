-- 16/10/2026 (Patrick)
--
-- 1) A surpresa volta: toda vez que a escala provisoria ou a oficial e
--    desfeita, ninguem conta mais como "ja viu a area" -- no proximo
--    lancamento todo mundo tem de novo o "Ver qual area fui escalado".
--    Feito por gatilho em configuracoes, para valer em qualquer caminho que
--    desfaca o lancamento.
--
-- 2) chamada_mapa(): a chamada de todo mundo, para a tabela da Geracao de
--    Escalas mostrar o icone (presenca confirmada / ausente / nao
--    registrada). A mesma tabela chamada_escala que o lider, o responsavel
--    pela reuniao e a janela da area usam -- um lugar so, todos conversam.

create or replace function public._surpresa_volta_ao_desfazer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (old.escala_lancada_em is not null and new.escala_lancada_em is null)
     or (old.escala_oficial_em is not null and new.escala_oficial_em is null) then
    update public.equipantes set area_vista_em = null where area_vista_em is not null;
  end if;
  return null;
end;
$$;

drop trigger if exists surpresa_volta_ao_desfazer on public.configuracoes;
create trigger surpresa_volta_ao_desfazer
  after update of escala_lancada_em, escala_oficial_em on public.configuracoes
  for each row execute function public._surpresa_volta_ao_desfazer();

-- { escala_id: [presente, marcado_por] } -- so as marcacoes da area atual
-- (quem trocou de area depois da chamada volta a "nao registrada").
create or replace function public.chamada_mapa()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_organizador() then
    return '{}'::jsonb;
  end if;
  return (select coalesce(jsonb_object_agg(c.escala_id, jsonb_build_array(c.presente, c.marcado_por)), '{}'::jsonb)
            from public.chamada_escala c
            join public.escalas s on s.id = c.escala_id and s.area_alocada = c.area);
end;
$$;

grant execute on function public.chamada_mapa() to authenticated;
