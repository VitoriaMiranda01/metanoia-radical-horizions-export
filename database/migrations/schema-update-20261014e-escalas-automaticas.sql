-- ---------------------------------------------------------------------------
-- Marca de "veio do Alocar automatico" (14/10/2026, Patrick).
--
-- O automatico ja guarda o que colocou (lotes_alocacao_automatica_itens, usado
-- no "Desfazer alocação automática"). Esta funcao devolve os ids das escalas
-- que AINDA estao onde o automatico as colocou: quem foi mexido a mao (trocou
-- de area) deixa de ser "automatico". So organizador; os demais recebem vazio.
-- Somente leitura.
-- ---------------------------------------------------------------------------
create or replace function public.escalas_automaticas()
returns uuid[]
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador() then
    return '{}'::uuid[];
  end if;
  return coalesce((
    select array_agg(distinct i.escala_id)
      from public.lotes_alocacao_automatica_itens i
      join public.lotes_alocacao_automatica l on l.id = i.lote_id
      join public.escalas e on e.id = i.escala_id and e.area_alocada = i.area
     where l.desfeito_em is null
  ), '{}'::uuid[]);
end;
$fn$;

revoke all on function public.escalas_automaticas() from public, anon;
grant execute on function public.escalas_automaticas() to authenticated;
