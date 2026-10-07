-- ---------------------------------------------------------------------------
-- Equipantes confirmados (Patrick, 07/10/2026)
--
-- Gerenciar Inscricoes ganhou o quadro "Equipantes confirmados" e o "Total da
-- edicao" (acampantes + equipantes confirmados). Confirmado e quem a chamada da
-- reuniao de escala confirmou:
--   * marcado presente pelo lider (chamada_escala.presente), ou
--   * ausente que a organizacao decidiu manter na area (mantido_em).
-- So contam as areas da escala (fora "Não será escalado") e a chamada da area
-- em que a pessoa esta hoje (mesmo criterio de situacao_escala). Pessoa em
-- duas areas conta uma vez.
--
-- chamada_escala nao tem politica de leitura para o navegador; por isso a
-- contagem vem desta funcao, so para organizadores (para os outros: null).
-- ---------------------------------------------------------------------------

create or replace function public.equipantes_confirmados()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select case when public.eh_organizador() then (
    select count(distinct s.equipante_id)::int
      from public.escalas s
      join public.chamada_escala c on c.escala_id = s.id and c.area = s.area_alocada
     where s.area_alocada <> 'Não será escalado'
       and (c.presente or c.mantido_em is not null)
  ) end;
$fn$;

revoke all on function public.equipantes_confirmados() from public, anon;
grant execute on function public.equipantes_confirmados() to authenticated;
