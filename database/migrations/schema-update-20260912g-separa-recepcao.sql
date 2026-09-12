-- ---------------------------------------------------------------------------
-- Separa "Recepção" em "Recepção Igreja" e "Recepção Sítio"
--
-- Pedido do Patrick em 12/09/2026. A escala oficial (edicoes 33/35/36) trata
-- as duas como areas distintas, e sao mesmo trabalhos diferentes:
--
--   Recepção Igreja -- na igreja, antes de sair. Mesa de cracha.
--                      2 pessoas nas 3 edicoes -> teto 4.
--                      Atuacoes: Mesa crachá masculino / feminino.
--
--   Recepção Sítio  -- na chegada ao sitio. 36, 34 e 34 pessoas -> teto 38.
--                      Atuacoes: Fila / Confronto (75 nas 3 edicoes somadas)
--                      e Celular / Mesa (28).
--
-- Ate aqui existia uma "Recepção" so, com as 4 atuacoes juntas e teto 40.
-- No formulario do equipante viram duas opcoes separadas.
-- ---------------------------------------------------------------------------

insert into public.limites_areas (area_nome, limite_maximo, somente_organizador)
values ('Recepção Igreja', 4, false),
       ('Recepção Sítio', 38, false)
on conflict (area_nome) do update
  set limite_maximo       = excluded.limite_maximo,
      somente_organizador = excluded.somente_organizador,
      updated_at          = now();

with dados(area, lista) as (values
  ('Recepção Igreja', array['Mesa crachá masculino','Mesa crachá feminino']),
  ('Recepção Sítio',  array['Fila / Confronto','Celular / Mesa'])
)
insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider)
select d.area, t.atuacao, t.ord, t.ord = 1, t.atuacao ilike '%líder%'
  from dados d, unnest(d.lista) with ordinality as t(atuacao, ord)
on conflict (area_nome, atuacao) do update
  set ordem = excluded.ordem, eh_padrao = excluded.eh_padrao, eh_lider = excluded.eh_lider;

-- Quem estivesse na "Recepção" antiga vai para a do sitio, que e a grande
-- (38 das 42 vagas somadas). Hoje nao ha nenhuma linha -- e no-op.
update public.escalas set area_alocada = 'Recepção Sítio' where area_alocada = 'Recepção';
update public.equipantes set area_trabalho_opcao1 = 'Recepção Sítio' where area_trabalho_opcao1 = 'Recepção';
update public.equipantes set area_trabalho_opcao2 = 'Recepção Sítio' where area_trabalho_opcao2 = 'Recepção';
update public.equipantes set area_trabalho_opcao3 = 'Recepção Sítio' where area_trabalho_opcao3 = 'Recepção';

delete from public.atuacoes_areas where area_nome = 'Recepção';
delete from public.limites_areas  where area_nome = 'Recepção';

-- _area_canonica passa a traduzir a "Recepção" antiga, caso ela ainda
-- apareca de algum lugar (uma aba do site aberta ha muito tempo, um dado
-- importado de fora).
create or replace function public._area_canonica(p_area text)
returns text
language sql immutable
set search_path to 'public'
as $fn$
  select case btrim(coalesce(p_area, ''))
    when 'Fotografia (necessário possuir equipamento próprio)' then 'Fotografia'
    when 'Hospital (cena teatral)'                             then 'Hospital (Cena teatral)'
    when 'Oração itinerante'                                   then 'Oração Itinerante'
    when 'Pastor enforcado'                                    then 'Pastor Enforcado'
    when 'Primeiros socorros – Saúde'                          then 'Primeiros socorros - Saúde'
    when 'Recepção'                                            then 'Recepção Sítio'
    else nullif(btrim(coalesce(p_area, '')), '')
  end;
$fn$;
revoke all on function public._area_canonica(text) from public, anon, authenticated;
