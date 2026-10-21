-- Fotografia ganha 3 atuacoes (21/10/2026, Patrick): Vídeomaker, Equipe de
-- trabalho sítio e Equipe trabalho de trilha. A cor continua na coluna propria
-- (nao e atuacao). Ordem da lista: Líder primeiro, o resto em ordem alfabetica.
-- Apoio segue como atuacao padrao (eh_padrao), so muda de posicao.

do $mig$
begin
  if not exists (select 1 from public.limites_areas where area_nome = 'Fotografia') then
    raise exception 'area Fotografia nao existe';
  end if;

  insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider, sem_cor)
  select 'Fotografia', n, 900 + row_number() over (), false, false, false
    from unnest(array['Vídeomaker', 'Equipe de trabalho sítio', 'Equipe trabalho de trilha']) as n
   where not exists (select 1 from public.atuacoes_areas
                      where area_nome = 'Fotografia' and atuacao = n);

  -- Reordena em duas etapas (ordem + 1000 antes) para nao esbarrar em chave unica.
  update public.atuacoes_areas set ordem = ordem + 1000 where area_nome = 'Fotografia';

  update public.atuacoes_areas a
     set ordem = r.nova
    from (select atuacao,
                 row_number() over (order by (not eh_lider), lower(atuacao)) as nova
            from public.atuacoes_areas
           where area_nome = 'Fotografia') r
   where a.area_nome = 'Fotografia' and a.atuacao = r.atuacao;
end
$mig$;
