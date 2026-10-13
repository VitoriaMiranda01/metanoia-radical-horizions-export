-- ---------------------------------------------------------------------------
-- Todo Guia tambem fica na Recepção Sítio (Patrick, 13/10/2026: "Todos os
-- guias são escalados para a recepção sitio isso é uma regra").
--
--  * Entrou no Guia (qualquer caminho: Alocar, pre-cadastro, lote, mover,
--    fixar...) -> ganha uma linha na Recepção Sítio como "Fila / Confronto",
--    marcada incluido_por = 'Regra: Guia'. Nao conta limite (e regra).
--    Se a pessoa ja estava na Recepção, a linha dela fica como esta.
--  * Saiu do Guia (tirar, mover para outra area, limpar) -> a linha que a
--    regra criou sai junto. Linha que a pessoa ja tinha antes fica.
--  * Cor nos dois sentidos: mudou a cor no Guia, muda na Recepção; mudou na
--    Recepção, muda no Guia. Se a atuacao dele na Recepção nao usa cor
--    (Celular / Mesa), a sincronia para ali.
--    Mudou a atuacao na Recepção para uma que usa cor: herda a cor do Guia.
--  * limpar_area('Recepção Sítio') nao tira quem e Guia.
--  * Os Guias que ja estao escalados entram agora na Recepção Sítio.
-- ---------------------------------------------------------------------------

create or replace function public._regra_guia_recepcao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c_guia  constant text := 'Guia';
  c_rec   constant text := 'Recepção Sítio';
  c_marca constant text := 'Regra: Guia';
  v_cor   text;
begin
  -- Saiu do Guia: a linha que a regra criou na Recepção sai junto.
  if tg_op in ('DELETE', 'UPDATE') and old.area_alocada = c_guia
     and (tg_op = 'DELETE' or new.area_alocada is distinct from c_guia) then
    delete from public.escalas r
     where r.equipante_id = old.equipante_id
       and r.area_alocada = c_rec
       and r.incluido_por = c_marca;
  end if;

  if tg_op = 'DELETE' then
    return null;
  end if;

  -- Entrou no Guia: tambem fica na Recepção Sítio, na Fila / Confronto.
  if new.area_alocada = c_guia
     and (tg_op = 'INSERT' or old.area_alocada is distinct from c_guia) then
    insert into public.escalas (equipante_id, area_alocada, atuacao, cor, incluido_por)
    values (new.equipante_id, c_rec, 'Fila / Confronto', new.cor, c_marca)
    on conflict (equipante_id, area_alocada) do nothing;

    -- Ja estava na Recepção com cor e chegou ao Guia sem cor: o Guia herda.
    if new.cor is null then
      select r.cor into v_cor
        from public.escalas r
        left join public.atuacoes_areas a on a.area_nome = c_rec and a.atuacao = r.atuacao
       where r.equipante_id = new.equipante_id and r.area_alocada = c_rec
         and not coalesce(a.sem_cor, false);
      if v_cor is not null then
        update public.escalas set cor = v_cor where id = new.id;
      end if;
      return null;
    end if;
  end if;

  -- Recepção mudou de atuacao (ex.: Celular / Mesa -> Fila / Confronto) e
  -- ficou sem cor: herda a cor do Guia em vez de apagar a do Guia.
  -- O mesmo vale para quem entra na Recepção sem cor ja sendo Guia.
  if new.area_alocada = c_rec and new.cor is null
     and (tg_op = 'INSERT' or new.atuacao is distinct from old.atuacao
          or new.area_alocada is distinct from old.area_alocada) then
    select g.cor into v_cor from public.escalas g
     where g.equipante_id = new.equipante_id and g.area_alocada = c_guia;
    if v_cor is not null and not coalesce((select a.sem_cor from public.atuacoes_areas a
                          where a.area_nome = c_rec and a.atuacao = new.atuacao), false) then
      update public.escalas set cor = v_cor where id = new.id;
    end if;
    return null;
  end if;

  -- Cor nos dois sentidos.
  if tg_op = 'UPDATE' and new.cor is not distinct from old.cor
     and new.area_alocada is not distinct from old.area_alocada then
    return null;
  end if;

  if new.area_alocada = c_guia then
    update public.escalas r set cor = new.cor
     where r.equipante_id = new.equipante_id
       and r.area_alocada = c_rec
       and r.cor is distinct from new.cor
       and not coalesce((select a.sem_cor from public.atuacoes_areas a
                          where a.area_nome = c_rec and a.atuacao = r.atuacao), false);
  elsif new.area_alocada = c_rec
     and not coalesce((select a.sem_cor from public.atuacoes_areas a
                        where a.area_nome = c_rec and a.atuacao = new.atuacao), false) then
    update public.escalas g set cor = new.cor
     where g.equipante_id = new.equipante_id
       and g.area_alocada = c_guia
       and g.cor is distinct from new.cor;
  end if;

  return null;
end;
$function$;

revoke all on function public._regra_guia_recepcao() from public, anon, authenticated;

drop trigger if exists regra_guia_recepcao on public.escalas;
create trigger regra_guia_recepcao
  after insert or update of area_alocada, cor, atuacao or delete on public.escalas
  for each row execute function public._regra_guia_recepcao();

create or replace function public.limpar_area(p_area text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_area   text := public._area_canonica(p_area);
  v_ids    uuid[];
  v_fila   int;
  v_guias  int := 0;
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro',
      'Só Desenvolvedores, Raquel e Dudu podem limpar uma área.');
  end if;
  if (select escala_lancada_em from public.configuracoes limit 1) is not null then
    return jsonb_build_object('ok', false, 'erro',
      'A escala provisória já foi lançada: não dá mais para limpar a área de uma vez. Tire as pessoas uma a uma.');
  end if;
  if v_area is null then
    return jsonb_build_object('ok', false, 'erro', 'Área não informada.');
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  -- Regra dos Guias: quem e Guia continua na Recepção Sítio.
  if v_area = 'Recepção Sítio' then
    select count(*) into v_guias
      from public.escalas e
     where e.area_alocada = v_area
       and exists (select 1 from public.escalas g
                    where g.equipante_id = e.equipante_id and g.area_alocada = 'Guia');
  end if;

  with apagados as (
    delete from public.escalas e
     where e.area_alocada = v_area
       and not (v_area = 'Recepção Sítio'
                and exists (select 1 from public.escalas g
                             where g.equipante_id = e.equipante_id and g.area_alocada = 'Guia'))
    returning e.equipante_id
  )
  select coalesce(array_agg(equipante_id), '{}') into v_ids from apagados;

  with voltaram as (
    update public.equipantes q set scale_status = 'pendente'
     where q.id = any(v_ids)
       and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
    returning q.id
  )
  select count(*) into v_fila from voltaram;

  return jsonb_build_object('ok', true, 'area', v_area,
                            'removidos', coalesce(array_length(v_ids, 1), 0),
                            'voltaram_fila', v_fila,
                            'guias_mantidos', v_guias);
end;
$function$;

-- Os Guias que ja estao escalados entram agora na Recepção Sítio.
insert into public.escalas (equipante_id, area_alocada, atuacao, cor, incluido_por)
select g.equipante_id, 'Recepção Sítio', 'Fila / Confronto', g.cor, 'Regra: Guia'
  from public.escalas g
 where g.area_alocada = 'Guia'
on conflict (equipante_id, area_alocada) do nothing;
