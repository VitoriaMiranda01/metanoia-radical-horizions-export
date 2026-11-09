-- =============================================================================
-- 20261109a -- Aprovacao: lista dos menores rapida (09/11/2026)
-- =============================================================================
-- Problema: menores_da_aprovacao() levava ~12 s para o organizador. O banco
-- corta consulta de usuario logado em 8 s (statement_timeout do papel
-- authenticated), entao a chamada estourava, o site reenviava 3 vezes e a tela
-- de Aprovacao ficava parada esperando.
--
-- Causa: para CADA menor que precisa de acompanhante, _acompanhante_do_menor
-- chamava _acompanhante_candidatos, que normalizava o nome dos ~700 inscritos
-- de novo (e a CTE "nivelado" era lida duas vezes). ~440 ms por menor x 26.
--
-- Solucao: _acompanhantes_dos_menores(ids) faz a mesma busca para VARIOS
-- menores de uma vez, normalizando os nomes dos inscritos uma unica vez.
-- A regra de casar o acompanhante (niveis 3/2/1, ate 10 candidatos, "menor"
-- em cada um, escolhido manualmente vence) e a mesma de
-- _acompanhante_candidatos + _acompanhante_do_menor (20261105a/b/c).
-- _acompanhante_do_menor passa a chamar a funcao nova com um id so -- a regra
-- fica num lugar so. _acompanhante_candidatos fica como estava (nao e mais
-- usada por ninguem, mas nao custa nada mante-la).
-- =============================================================================

create or replace function public._acompanhantes_dos_menores(p_ids uuid[])
returns table(menor_id uuid, acompanhante jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  with base as materialized (
    select c.id, c.nome, c.igreja, c.status, c.data_nascimento,
           public._nome_normalizado(c.nome) as cn
      from public.equipantes c
     where c.tipo = 'equipante' and coalesce(c.inscrito, false)
  ), basew as materialized (
    select b.*,
           array(select w from unnest(string_to_array(b.cn, ' ')) w
                  where w <> '' and w not in ('de', 'da', 'do', 'dos', 'das', 'e')) as cws
      from base b
  ), alvo as materialized (
    select m.id as menor_id, m.acompanhante_equipante_id, m.acompanhante_nome,
           case when nullif(btrim(coalesce(m.acompanhante_nome, '')), '') is not null
                then public._nome_normalizado(m.acompanhante_nome) end as n
      from public.equipantes m
     where m.id = any(p_ids)
  ), pal as (
    select a.menor_id, a.n,
           array(select w from unnest(string_to_array(a.n, ' ')) w
                  where w <> '' and w not in ('de', 'da', 'do', 'dos', 'das', 'e')) as ws
      from alvo a
     where a.n is not null
  ), niv as materialized (
    select p.menor_id, c.id, c.nome, c.igreja, c.status, c.data_nascimento,
           case
             when c.cn = p.n then 3
             when cardinality(p.ws) >= 2 and cardinality(c.cws) >= 2 and (p.ws <@ c.cws or c.cws <@ p.ws) then 2
             when cardinality(p.ws) >= 2 and cardinality(c.cws) >= 2
                  and c.cws[1] = p.ws[1] and c.cws[cardinality(c.cws)] = p.ws[cardinality(p.ws)] then 1
           end as nivel
      from pal p
      join basew c on c.id <> p.menor_id
  ), melhor as (
    select x.menor_id, max(x.nivel) as nivel from niv x group by x.menor_id
  ), top as (
    select x.*, row_number() over (partition by x.menor_id order by x.nome, x.id) as rn
      from niv x
      join melhor mx on mx.menor_id = x.menor_id and x.nivel = mx.nivel
  ), cands as (
    select t.menor_id,
           jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'igreja', t.igreja, 'status', t.status,
                                        'menor', public._recepcao_menor(t.data_nascimento))
                     order by t.nome, t.id) as lista,
           count(*) as n
      from top t
     where t.rn <= 10
     group by t.menor_id
  )
  select a.menor_id,
         jsonb_build_object(
           'situacao', case
             when z.pessoa is not null and (z.pessoa ->> 'menor')::boolean then 'menor'
             when z.pessoa is not null then 'encontrado'
             when nullif(btrim(coalesce(a.acompanhante_nome, '')), '') is null then 'sem_nome'
             when coalesce(k.n, 0) > 1 then 'varios'
             else 'nao_encontrado' end,
           'escolhido', e.esc is not null,
           'pessoa', z.pessoa,
           'candidatos', coalesce(k.lista, '[]'::jsonb))
    from alvo a
    left join lateral (
      select jsonb_build_object('id', c.id, 'nome', c.nome, 'igreja', c.igreja, 'status', c.status,
                                'menor', public._recepcao_menor(c.data_nascimento)) as esc
        from base c
       where a.acompanhante_equipante_id is not null and c.id = a.acompanhante_equipante_id
    ) e on true
    left join cands k on k.menor_id = a.menor_id
    cross join lateral (
      select coalesce(e.esc, case when k.n = 1 then k.lista -> 0 end) as pessoa
    ) z;
$$;

revoke all on function public._acompanhantes_dos_menores(uuid[]) from public, anon, authenticated;


-- Um menor so: mesma resposta de antes, agora pela funcao em conjunto.
create or replace function public._acompanhante_do_menor(p_menor uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select x.acompanhante from public._acompanhantes_dos_menores(array[p_menor]) x limit 1;
$$;

revoke all on function public._acompanhante_do_menor(uuid) from public, anon, authenticated;


-- A lista da Aprovacao: o acompanhante de TODOS os menores numa chamada so.
create or replace function public.menores_da_aprovacao()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_org  boolean := public.eh_organizador();
  v_parc boolean := public.eh_parceiro();
  v_cfg  public.configuracoes%rowtype;
  v_quem jsonb;
  v_itens jsonb;
  v_o    record;
  v_ig   public.igrejas_parceiras%rowtype;
begin
  if not (v_org or v_parc) then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores e pastores parceiros.');
  end if;

  select * into v_cfg from public.configuracoes limit 1;

  if v_org then
    select * into v_o from public._organizador_do_cracha();
    v_quem := jsonb_build_object('papel', 'organizador', 'nome', v_o.nome, 'igreja', null);
  else
    select * into v_ig from public.igrejas_parceiras i where i.codigo = public.jwt_igreja() limit 1;
    v_quem := jsonb_build_object('papel', 'parceiro',
      'nome', coalesce(nullif(btrim(coalesce(v_ig.responsavel_nome, '')), ''),
                       (select nullif(btrim(pa.responsavel_nome), '')
                          from public.primeiro_acesso_parceiros pa where pa.codigo = v_ig.codigo)),
      'igreja', v_ig.nome);
  end if;

  with m as materialized (
    select e.id, e.nome, e.sexo, e.status, e.igreja, e.whatsapp, public.idade(e) as idade,
           extract(year from age(coalesce(v_cfg.data_evento_inicio, current_date), e.data_nascimento))::int as idade_no_projeto,
           e.responsavel_nome, e.responsavel_whatsapp, e.acompanhante_nome,
           e.menor_liberado_em, e.menor_liberado_por, e.menor_liberado_por_tipo,
           public._equipante_precisa_acompanhante(e.data_nascimento) as precisa_acompanhante
      from public.equipantes e
     where e.tipo = 'equipante'
       and coalesce(e.inscrito, false)
       and public._recepcao_menor(e.data_nascimento)
       and (v_org or (e.igreja is not null and split_part(e.igreja, ' - ', 1) = any (public.igrejas_do_parceiro())))
  ), ac as (
    select x.menor_id, x.acompanhante
      from public._acompanhantes_dos_menores(
             (select coalesce(array_agg(m2.id), '{}'::uuid[]) from m m2 where m2.precisa_acompanhante)) x
  )
  select coalesce(jsonb_agg(t order by t.nome), '[]'::jsonb) into v_itens
  from (
    select m.*, ac.acompanhante
      from m
      left join ac on ac.menor_id = m.id
  ) t;

  return jsonb_build_object('ok', true, 'itens', v_itens, 'quem', v_quem,
    'edicao', v_cfg.edicao_numero,
    'evento_inicio', v_cfg.data_evento_inicio, 'evento_fim', v_cfg.data_evento_fim);
end;
$function$;
