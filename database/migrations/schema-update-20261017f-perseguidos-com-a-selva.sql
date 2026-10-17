-- Perseguidos com a liderança da Selva; aviso de "com quem se reunir";
-- Oração Itinerante como atuação da Cristolândia (17/10/2026, Patrick).
--
--  1) Perseguidos fazem parte da equipe da Selva para a chamada e a relacao do
--     lider (igual aos Marcadores com a Invisivel): o lider da Selva ve os
--     Perseguidos (com etiqueta), marca a presenca e manda o convite do grupo.
--  2) Perseguidos nao viram "equipe sem lider" no painel de responsaveis pela
--     reuniao (a reuniao deles e a da Selva), como os Marcadores.
--  3) situacao_inscricao devolve 'reuniao_com': com que lideranca a pessoa se
--     reune na Leitura de Escala (Marcador -> Invisível, Perseguidos -> Selva).
--     So depois que ela ja viu a propria area (nao estraga a surpresa).
--  4) Cristolândia ganha a atuacao "Oração Itinerante": quem faz a oracao e
--     definido pela lideranca da Cristolândia.

create or replace function public._na_equipe_de(p_area text, p_cor text, p_escala uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.escalas s
     where s.id = p_escala
       and (s.area_alocada = p_area
            or (p_area = 'Invisível' and s.area_alocada = 'Marcador')
            or (p_area = 'Selva' and s.area_alocada = 'Perseguidos'))
       and (not public._area_com_cor(p_area) or p_cor is null or s.cor is null or s.cor = p_cor));
$$;

do $mig$
declare
  v text;
begin
  -- (2) painel de responsaveis
  v := pg_get_functiondef('public.responsaveis_reuniao_painel()'::regprocedure);
  if position($a$('Não será escalado', 'Marcador')$a$ in v) = 0 then
    raise exception 'trecho do painel nao encontrado';
  end if;
  v := replace(v, $a$('Não será escalado', 'Marcador')$a$, $a$('Não será escalado', 'Marcador', 'Perseguidos')$a$);
  execute v;

  -- (3) situacao_inscricao: reuniao_com
  v := pg_get_functiondef('public.situacao_inscricao(text,uuid,text,text,date)'::regprocedure);
  if position($a$    'area_vista', (select area_vista_em is not null from public.equipantes where id = p_id),$a$ in v) = 0 then
    raise exception 'trecho da situacao nao encontrado';
  end if;
  v := replace(v,
    $a$    'area_vista', (select area_vista_em is not null from public.equipantes where id = p_id),$a$,
    $b$    'area_vista', (select area_vista_em is not null from public.equipantes where id = p_id),
    'reuniao_com', case when v_lancada is not null
                          and (select area_vista_em is not null from public.equipantes where id = p_id)
                        then (select coalesce(jsonb_agg(distinct jsonb_build_object('area', s.area_alocada,
                                       'com', case s.area_alocada when 'Marcador' then 'Invisível'
                                                                  when 'Perseguidos' then 'Selva' end)), '[]'::jsonb)
                                from public.escalas s
                               where s.equipante_id = p_id and s.area_alocada in ('Marcador', 'Perseguidos'))
                        else '[]'::jsonb end,$b$);
  execute v;
end
$mig$;

-- (4) Oração Itinerante na Cristolândia
insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider, sem_cor)
select 'Cristolândia', 'Oração Itinerante',
       (select coalesce(max(ordem), 0) + 1 from public.atuacoes_areas where area_nome = 'Cristolândia'),
       false, false, false
 where not exists (select 1 from public.atuacoes_areas
                    where area_nome = 'Cristolândia' and atuacao = 'Oração Itinerante');
