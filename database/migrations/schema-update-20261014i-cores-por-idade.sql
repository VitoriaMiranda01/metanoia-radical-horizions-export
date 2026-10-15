-- ---------------------------------------------------------------------------
-- Cores equilibradas tambem por idade (14/10/2026, Patrick).
--
-- _distribuir_cores(area, ids, teto): da cor as escalas `ids` da area,
-- tratando as demais como fixas (lideres, quem ja tem cor, atuacao sem cor).
-- Guloso: por sexo, do mais velho para o mais novo; cada um vai para a cor com
-- menos gente do mesmo sexo, depois menos gente no total, depois a menor soma
-- de idades -- assim quantidade, homens/mulheres e media de idade ficam
-- parecidos em todas as cores. teto = maximo por cor (Pastor Invisível: 3).
--
-- distribuir_cores_area(area, refazer):
--   refazer = false -> so quem esta sem cor (o botao "Distribuir cores");
--   refazer = true  -> todos, menos lider e atuacao sem cor.
--
-- Alocar automatico: Invisível, Marcador e Pastor Invisível entram sem cor e,
-- no fim, as cores de quem entrou sao distribuidas por esta mesma regra.
-- ---------------------------------------------------------------------------

create or replace function public._distribuir_cores(p_area text, p_ids uuid[], p_max integer default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  r     record;
  v_cor text;
  v_n   int := 0;
begin
  drop table if exists pg_temp._cores_dist;
  create temp table _cores_dist on commit drop as
    select e.id, q.sexo,
           coalesce(extract(year from age(current_date, q.data_nascimento))::numeric, 0) as idade,
           case when e.id = any(p_ids) then null else e.cor end as cor,
           e.cor as cor_antes,
           e.id = any(p_ids) as livre
      from public.escalas e join public.equipantes q on q.id = e.equipante_id
     where e.area_alocada = p_area;

  for r in select id, sexo, idade from _cores_dist where livre
            order by sexo nulls last, idade desc, random() loop
    select c.cor into v_cor
      from unnest(array['Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho']) as c(cor)
     where p_max is null or (select count(*) from _cores_dist d where d.cor = c.cor) < p_max
     order by (select count(*) from _cores_dist d where d.cor = c.cor and d.sexo is not distinct from r.sexo),
              (select count(*) from _cores_dist d where d.cor = c.cor),
              (select coalesce(sum(d.idade), 0) from _cores_dist d where d.cor = c.cor),
              random()
     limit 1;
    update _cores_dist set cor = v_cor where id = r.id;
  end loop;

  -- Grava so o que mudou (uma linha por vez: a auditoria guarda cada pessoa).
  for r in select id, cor from _cores_dist where livre and cor is distinct from cor_antes loop
    update public.escalas set cor = r.cor where id = r.id;
    v_n := v_n + 1;
  end loop;
  drop table if exists pg_temp._cores_dist;
  return v_n;
end;
$fn$;

drop function if exists public.distribuir_cores_area(text);
create or replace function public.distribuir_cores_area(p_area text, p_refazer boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_ids uuid[];
  v_n   int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem distribuir as cores.');
  end if;
  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));
  select coalesce(array_agg(e.id), '{}') into v_ids
    from public.escalas e
   where e.area_alocada = p_area
     and (p_refazer or e.cor is null)
     -- Lider (ex.: lider geral) e atuacao sem cor ficam como estao.
     and not exists (select 1 from public.atuacoes_areas a
                      where a.area_nome = e.area_alocada and a.atuacao = e.atuacao
                        and (a.eh_lider or a.sem_cor));
  v_n := public._distribuir_cores(p_area, v_ids,
           case when p_area = 'Pastor Invisível'
                then greatest(1, ceil(coalesce((select limite_maximo from public.limites_areas
                                                 where area_nome = p_area), 15) / 5.0)::int) end);
  return jsonb_build_object('ok', true, 'coloridos', v_n);
end;
$fn$;

revoke all on function public.distribuir_cores_area(text, boolean) from public, anon;
grant execute on function public.distribuir_cores_area(text, boolean) to authenticated;
revoke all on function public._distribuir_cores(text, uuid[], integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Alocar automatico: as cores saem no fim, pela regra acima.
-- ---------------------------------------------------------------------------
create or replace function public.alocar_fila_automaticamente()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  c_pi       constant text := 'Pastor Invisível';
  v_pessoa   record;
  v_cand     record;
  v_area     text;
  v_destino  text;
  v_cor      text;
  v_vaga     record;
  v_por_opcao int[] := array[0, 0, 0];
  v_coringa  int := 0;
  v_sem_opcao_aloc int := 0;
  v_fora     int := 0;
  v_pastores int := 0;
  v_fixos    int := 0;
  v_fila     uuid[];
  v_areas_fixos text[] := '{}';
  v_passo    int;
  v_sobraram int;
  v_lote     uuid;
  v_escala   uuid;
  v_ordem    text := (select c.escala_ordem from public.configuracoes c limit 1);
  -- Pastor Invisível
  v_pi_alvo  int;
  v_pi_atual int;
  v_pi_f     int;
  v_pi_m     int;
  v_meta_f   int;
  v_meta_m   int;
  v_cap_cor  int;
  v_sexo_alvo text;
  v_pre      jsonb;
  v_rest     jsonb;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas organizadores podem alocar pelas preferências.');
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  insert into public.lotes_alocacao_automatica (feito_por)
  values (public._nome_organizador_logado()) returning id into v_lote;

  -- Passada zero: os fixos (como antes; nao entram no lote).
  select coalesce(array_agg(q.id), '{}') into v_fila
    from public.equipantes q
   where q.tipo = 'equipante'
     and q.status = 'aprovado'
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  for v_pessoa in
    select f.equipante_id as id, f.area, q.sexo
      from public.equipantes_areas_fixas f
      join public.equipantes q on q.id = f.equipante_id
     where f.equipante_id = any(v_fila)
       and exists (select 1 from public.limites_areas l where l.area_nome = f.area)
     order by q.nome, f.marcado_em
  loop
    continue when exists (select 1 from public.escalas e
                           where e.equipante_id = v_pessoa.id and e.area_alocada = v_pessoa.area);
    continue when public._area_especial(v_pessoa.area) and exists (
      select 1 from public.escalas e
       where e.equipante_id = v_pessoa.id and public._area_especial(e.area_alocada));

    select * into v_vaga from public._equipante_area_tem_vaga(v_pessoa.area, v_pessoa.sexo);
    continue when not v_vaga.tem_vaga;

    insert into public.escalas (equipante_id, area_alocada, atuacao)
    values (v_pessoa.id, v_pessoa.area, public._atuacao_padrao(v_pessoa.area));
    update public.equipantes set scale_status = 'ok' where id = v_pessoa.id;

    v_fixos := v_fixos + 1;
    if not v_pessoa.area = any(v_areas_fixos) then
      v_areas_fixos := v_areas_fixos || v_pessoa.area;
    end if;
  end loop;

  -- Pastor Invisível: completa ate o limite, 3 por cor, homens e mulheres
  -- equilibrados. Antes das opcoes: as vagas que os pastores deixam nas areas
  -- comuns ja ficam para a fila.
  select coalesce(l.limite_maximo, 0) into v_pi_alvo from public.limites_areas l where l.area_nome = c_pi;
  v_pi_alvo := coalesce(v_pi_alvo, 0);
  select count(*), count(*) filter (where q.sexo = 'Feminino'), count(*) filter (where q.sexo = 'Masculino')
    into v_pi_atual, v_pi_f, v_pi_m
    from public.escalas e join public.equipantes q on q.id = e.equipante_id
   where e.area_alocada = c_pi;
  v_meta_f  := v_pi_alvo / 2;
  v_meta_m  := v_pi_alvo - v_meta_f;
  v_cap_cor := greatest(1, ceil(v_pi_alvo / 5.0)::int);
  select coalesce(c.cpfs_area_pastor_invisivel, '[]'::jsonb) into v_pre from public.configuracoes c limit 1;
  v_pre := coalesce(v_pre, '[]'::jsonb);

  while v_pi_atual < v_pi_alvo loop
    v_sexo_alvo := case
      when v_pi_f < v_meta_f and (v_pi_m >= v_meta_m or v_pi_f * v_meta_m <= v_pi_m * v_meta_f) then 'Feminino'
      when v_pi_m < v_meta_m then 'Masculino'
      else 'Feminino' end;

    select q.id, q.sexo into v_cand
      from public.equipantes q
     where q.tipo = 'equipante' and q.status = 'aprovado'
       and (upper(btrim(coalesce(q.cargo_igreja, ''))) in ('PASTOR(A)', 'PASTOR(A) AUXILIAR')
            or q.e_pastor is true
            or (regexp_replace(coalesce(q.cpf, ''), '\D', '', 'g') <> ''
                and v_pre ? regexp_replace(coalesce(q.cpf, ''), '\D', '', 'g'))
            or v_pre ? ('id:' || q.id::text))
       and not exists (select 1 from public.escalas e
                        where e.equipante_id = q.id and e.area_alocada in (c_pi, 'Não será escalado'))
       -- Lider em alguma area nao sai de la.
       and not exists (select 1 from public.escalas e
                         join public.atuacoes_areas a on a.area_nome = e.area_alocada and a.atuacao = e.atuacao
                        where e.equipante_id = q.id and a.eh_lider)
       -- Fixo 📌 tambem nao.
       and not exists (select 1 from public.equipantes_areas_fixas f where f.equipante_id = q.id)
       and not public._saiu_a_mao(q.id, c_pi)
     order by ((regexp_replace(coalesce(q.cpf, ''), '\D', '', 'g') <> ''
                and v_pre ? regexp_replace(coalesce(q.cpf, ''), '\D', '', 'g'))
               or v_pre ? ('id:' || q.id::text)) desc,
              (q.sexo is not distinct from v_sexo_alvo) desc,
              (q.sexo is null),
              random()
     limit 1;
    exit when not found;

    -- O que ele tinha (para o Desfazer). A linha da Recepção Sítio criada
    -- pela regra do Guia volta sozinha com o Guia.
    select coalesce(jsonb_agg(jsonb_build_object('area', e.area_alocada, 'atuacao', e.atuacao,
                                                 'cor', e.cor, 'incluido_por', e.incluido_por)), '[]'::jsonb)
      into v_rest
      from public.escalas e
     where e.equipante_id = v_cand.id and coalesce(e.incluido_por, '') <> 'Regra: Guia';

    delete from public.escalas where equipante_id = v_cand.id;

    insert into public.escalas (equipante_id, area_alocada, atuacao)
    values (v_cand.id, c_pi, public._atuacao_padrao(c_pi))
    returning id into v_escala;
    update public.equipantes set scale_status = 'ok' where id = v_cand.id;

    insert into public.lotes_alocacao_automatica_itens (lote_id, escala_id, equipante_id, area, motivo, restaurar)
    values (v_lote, v_escala, v_cand.id, c_pi, 'pastor_invisivel',
            case when v_rest = '[]'::jsonb then null else v_rest end);

    v_pastores := v_pastores + 1;
    v_pi_atual := v_pi_atual + 1;
    if v_cand.sexo = 'Feminino' then v_pi_f := v_pi_f + 1;
    elsif v_cand.sexo = 'Masculino' then v_pi_m := v_pi_m + 1;
    else v_pi_m := v_pi_m + 1;
    end if;
  end loop;

  -- Passadas 1, 2 e 3: a opcao de mesmo numero.
  for v_passo in 1..3 loop
    for v_pessoa in
      select q.id, q.sexo,
             case v_passo
               when 1 then q.area_trabalho_opcao1
               when 2 then q.area_trabalho_opcao2
               else        q.area_trabalho_opcao3
             end as escolha
        from public.equipantes q
       where q.tipo = 'equipante'
         and q.status = 'aprovado'
         and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
       order by case when v_ordem = 'cadastro'
                  then coalesce(q.inscrito_em, q.decidido_em, q.created_at)
                  else coalesce(q.decidido_em, q.created_at)
             end nulls last, q.nome
    loop
      v_area := public._area_canonica(v_pessoa.escolha);
      continue when v_area is null;
      continue when v_area in ('Disponível para qualquer área', 'Fotografia');
      continue when exists (
        select 1 from public.limites_areas l
         where l.area_nome = v_area and l.somente_organizador);
      continue when public._saiu_a_mao(v_pessoa.id, v_area);

      select * into v_vaga from public._equipante_area_tem_vaga(v_area, v_pessoa.sexo);
      continue when not v_vaga.tem_vaga;

      insert into public.escalas (equipante_id, area_alocada, atuacao)
      values (v_pessoa.id, v_area, public._atuacao_padrao(v_area))
      returning id into v_escala;
      update public.equipantes set scale_status = 'ok' where id = v_pessoa.id;

      insert into public.lotes_alocacao_automatica_itens (lote_id, escala_id, equipante_id, area, motivo)
      values (v_lote, v_escala, v_pessoa.id, v_area, 'opcao' || v_passo);

      v_por_opcao[v_passo] := v_por_opcao[v_passo] + 1;
    end loop;
  end loop;

  -- Quem sobrou vai para uma area sorteada com vaga, nesta ordem:
  --   1) marcou "Disponível para qualquer área";
  --   2) nao marcou nenhuma opcao (inscricao manual) -- e como disponivel;
  --   3) as opcoes estavam cheias -- "fora_das_opcoes" (etiqueta na tela).
  for v_pessoa in
    select s.id, s.sexo, s.motivo from (
    select q.id, q.sexo, q.nome,
           case when v_ordem = 'cadastro'
             then coalesce(q.inscrito_em, q.decidido_em, q.created_at)
             else coalesce(q.decidido_em, q.created_at)
           end as quando,
           case
             when 'Disponível para qualquer área' in (
                    coalesce(public._area_canonica(q.area_trabalho_opcao1), ''),
                    coalesce(public._area_canonica(q.area_trabalho_opcao2), ''),
                    coalesce(public._area_canonica(q.area_trabalho_opcao3), '')) then 'disponivel'
             when public._area_canonica(q.area_trabalho_opcao1) is null
              and public._area_canonica(q.area_trabalho_opcao2) is null
              and public._area_canonica(q.area_trabalho_opcao3) is null then 'sem_opcao'
             else 'fora_das_opcoes'
           end as motivo
      from public.equipantes q
     where q.tipo = 'equipante'
       and q.status = 'aprovado'
       and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
    ) s
     order by s.motivo <> 'disponivel', s.motivo <> 'sem_opcao', s.quando nulls last, s.nome
  loop
    v_destino := public._area_aleatoria_com_vaga(v_pessoa.id, v_pessoa.sexo);
    continue when v_destino is null;

    insert into public.escalas (equipante_id, area_alocada, atuacao)
    values (v_pessoa.id, v_destino, public._atuacao_padrao(v_destino))
    returning id into v_escala;
    update public.equipantes set scale_status = 'ok' where id = v_pessoa.id;

    insert into public.lotes_alocacao_automatica_itens (lote_id, escala_id, equipante_id, area, motivo)
    values (v_lote, v_escala, v_pessoa.id, v_destino, v_pessoa.motivo);

    if v_pessoa.motivo = 'disponivel' then v_coringa := v_coringa + 1;
    elsif v_pessoa.motivo = 'sem_opcao' then v_sem_opcao_aloc := v_sem_opcao_aloc + 1;
    else v_fora := v_fora + 1;
    end if;
  end loop;

  -- Cores de quem entrou (Invisível, Marcador, Pastor Invisível): quantidade,
  -- homens/mulheres e idade equilibrados por cor (_distribuir_cores, 14/10/2026).
  for v_area in select unnest(array['Invisível', 'Marcador', c_pi]) loop
    perform public._distribuir_cores(v_area,
      coalesce((select array_agg(i.escala_id) from public.lotes_alocacao_automatica_itens i
                 where i.lote_id = v_lote and i.area = v_area), '{}'),
      case when v_area = c_pi then v_cap_cor end);
  end loop;

  update public.lotes_alocacao_automatica
     set total = (select count(*) from public.lotes_alocacao_automatica_itens where lote_id = v_lote)
   where id = v_lote;
  if not exists (select 1 from public.lotes_alocacao_automatica_itens where lote_id = v_lote) then
    delete from public.lotes_alocacao_automatica where id = v_lote;
    v_lote := null;
  end if;

  select count(*) into v_sobraram
    from public.equipantes q
   where q.tipo = 'equipante'
     and q.status = 'aprovado'
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  return jsonb_build_object(
    'ok', true,
    'alocados',  v_fixos + v_pastores + v_por_opcao[1] + v_por_opcao[2] + v_por_opcao[3]
                 + v_coringa + v_sem_opcao_aloc + v_fora,
    'fixos',     v_fixos,
    'pastores',  v_pastores,
    'opcao1',    v_por_opcao[1],
    'opcao2',    v_por_opcao[2],
    'opcao3',    v_por_opcao[3],
    'coringa',   v_coringa,
    'sem_opcao_alocados', v_sem_opcao_aloc,
    'fora_das_opcoes', v_fora,
    'sobraram',  v_sobraram,
    'sem_opcao', (select count(*) from public.equipantes q
                     where q.tipo = 'equipante' and q.status = 'aprovado'
                       and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
                       and public._area_canonica(q.area_trabalho_opcao1) is null
                       and public._area_canonica(q.area_trabalho_opcao2) is null
                       and public._area_canonica(q.area_trabalho_opcao3) is null),
    'opcoes_cheias', v_sobraram - (select count(*) from public.equipantes q
                     where q.tipo = 'equipante' and q.status = 'aprovado'
                       and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
                       and public._area_canonica(q.area_trabalho_opcao1) is null
                       and public._area_canonica(q.area_trabalho_opcao2) is null
                       and public._area_canonica(q.area_trabalho_opcao3) is null),
    'acima_do_limite', coalesce((
      select jsonb_agg(l.area_nome order by l.area_nome)
        from public.limites_areas l
       where l.area_nome = any(v_areas_fixos)
         and (select count(*) from public.escalas e where e.area_alocada = l.area_nome) > l.limite_maximo
    ), '[]'::jsonb),
    'lote',      v_lote);
end;
$fn$;

revoke all on function public.alocar_fila_automaticamente() from public, anon;
grant execute on function public.alocar_fila_automaticamente() to authenticated;
