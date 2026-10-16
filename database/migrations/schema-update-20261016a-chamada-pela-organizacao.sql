-- Chamada pela organizacao (16/10/2026, Patrick)
--
-- No quadro "Chamada da reuniao de escala", cada area abre a lista dela e a
-- organizacao marca presente/ausente (inclusive por cima do que o lider
-- marcou) e troca atuacao e cor. Atuacao e cor usam as funcoes que ja
-- existem (definir_atuacao_alocacao, definir_cor_alocacao), que ficam na
-- auditoria. Mesma permissao do quadro: Desenvolvedores, Raquel e Dudu.

create or replace function public.chamada_da_area(p_area text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;

  return jsonb_build_object('ok', true,
    'area', p_area,
    'com_cor', public._area_com_cor(p_area),
    'atuacoes', (select coalesce(jsonb_agg(jsonb_build_object(
                   'atuacao', a.atuacao, 'eh_lider', a.eh_lider, 'sem_cor', coalesce(a.sem_cor, false))
                   order by a.ordem), '[]'::jsonb)
                   from public.atuacoes_areas a where a.area_nome = p_area),
    'membros', (select coalesce(jsonb_agg(jsonb_build_object(
                  'escala_id', s.id, 'equipante_id', q.id, 'nome', q.nome,
                  'igreja', q.igreja, 'igreja_outra', q.igreja_outra, 'whatsapp', q.whatsapp,
                  'atuacao', s.atuacao, 'cor', s.cor,
                  'eh_lider', public._eh_lider(s.area_alocada, s.atuacao),
                  'presente', c.presente, 'marcado_por', c.marcado_por, 'marcado_em', c.marcado_em,
                  'pendencias', public._pendencias_relacao(q.id))
                  order by q.nome), '[]'::jsonb)
                  from public.escalas s
                  join public.equipantes q on q.id = s.equipante_id
                  left join public.chamada_escala c on c.escala_id = s.id and c.area = s.area_alocada
                 where s.area_alocada = p_area));
end;
$$;

create or replace function public.organizador_marcar_presenca(p_escala_id uuid, p_presente boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_area text;
  v_nome text;
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  if (select escala_lancada_em from public.configuracoes limit 1) is null then
    return jsonb_build_object('ok', false, 'erro', 'A escala provisória ainda não foi lançada.');
  end if;

  select area_alocada into v_area from public.escalas where id = p_escala_id;
  if v_area is null then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está mais na escala.');
  end if;
  v_nome := coalesce(public._nome_organizador_logado(), 'organização') || ' (organização)';

  if p_presente is null then
    delete from public.chamada_escala where escala_id = p_escala_id;
  else
    insert into public.chamada_escala (escala_id, area, presente, marcado_por, marcado_em)
    values (p_escala_id, v_area, p_presente, v_nome, now())
    on conflict (escala_id) do update
      set area = excluded.area,
          presente = excluded.presente,
          marcado_por = excluded.marcado_por,
          marcado_em = excluded.marcado_em,
          mantido_em  = case when chamada_escala.presente = excluded.presente
                              and chamada_escala.area = excluded.area
                             then chamada_escala.mantido_em end,
          mantido_por = case when chamada_escala.presente = excluded.presente
                              and chamada_escala.area = excluded.area
                             then chamada_escala.mantido_por end,
          convite_enviado_em = case when excluded.presente
                                    and chamada_escala.area = excluded.area
                                    then chamada_escala.convite_enviado_em end;
  end if;

  return jsonb_build_object('ok', true, 'marcado_por', v_nome);
end;
$$;

grant execute on function public.chamada_da_area(text), public.organizador_marcar_presenca(uuid, boolean) to authenticated;
