-- 28/10/2026 -- Lider marca os fixos 📌 da sua area (pedido do Patrick, logo
-- depois de lancar a escala oficial).
--
-- Decisoes do Patrick:
--  - e a MESMA marca da geracao de escala (equipantes_areas_fixas): a Raquel
--    e o Dudu veem o 📌 e o Alocar automatico respeita na proxima edicao;
--  - so o LIDER da area (o responsavel pela reuniao nao marca nem ve);
--  - o lider tira qualquer 📌 da sua area, inclusive os da organizacao;
--  - so marca: nao aloca ninguem (a pessoa ja esta na equipe dele);
--  - so depois da escala oficial lancada; a marca fica salva (atravessa as
--    edicoes, como a do organizador).
--
-- "Lider" = escalado como lider na area (_equipes_do com escala_lider). O
-- lider da Recepcao Igreja nao marca nas outras quatro areas do modulo.
-- So marca quem e DA AREA dele (Marcadores na Invisivel e Perseguidos na
-- Selva tem o lider deles). marcado_por = "<nome> (líder)".

create or replace function pg_temp._patch(p regprocedure, de text, para text, vezes int)
returns void language plpgsql as $p$
declare d text := pg_get_functiondef(p); n int;
begin
  n := (length(d) - length(replace(d, de, ''))) / length(de);
  if n <> vezes then
    raise exception 'patch em %: esperava % ocorrencia(s) de [%], achei %', p, vezes, de, n;
  end if;
  execute replace(d, de, para);
end;
$p$;

-- Relacao: a equipe diz se o lider pode marcar; cada membro diz se e fixo ----
select pg_temp._patch('public.relacao_lider(uuid,text,text,date)'::regprocedure,
  $$           'pode_trocar_cor', e.area = 'Fotografia' or public._area_trilha(e.area),$$,
  $$           'pode_trocar_cor', e.area = 'Fotografia' or public._area_trilha(e.area),
           'pode_fixar', e.papel = 'lider' and e.escala_lider is not null
                         and (select c0.escala_oficial_em is not null from public.configuracoes c0 limit 1),$$, 1);

select pg_temp._patch('public.relacao_lider(uuid,text,text,date)'::regprocedure,
  $$                      'eh_lider', public._eh_lider(s.area_alocada, s.atuacao),$$,
  $$                      'eh_lider', public._eh_lider(s.area_alocada, s.atuacao),
                      'fixo', exists (select 1 from public.equipantes_areas_fixas f
                                       where f.equipante_id = q.id and f.area = s.area_alocada),
                      'fixo_por', (select f.marcado_por from public.equipantes_areas_fixas f
                                    where f.equipante_id = q.id and f.area = s.area_alocada),$$, 1);

-- Assinatura: o 📌 marcado em outro aparelho aparece sozinho ----------------
select pg_temp._patch('public._assinatura_relacao(uuid)'::regprocedure,
  $$|| coalesce(c.presente::text, '-') || ','$$,
  $$|| coalesce(c.presente::text, '-') || ','
                                           || (exists (select 1 from public.equipantes_areas_fixas f
                                                        where f.equipante_id = s.equipante_id and f.area = s.area_alocada))::text || ','$$, 1);

-- Marcar / desmarcar ----------------------------------------------------------
create or replace function public.lider_marcar_fixo(p_id uuid, p_cpf text, p_nome text, p_nascimento date,
                                                    p_escala_id uuid, p_fixo boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  s public.escalas;
  v_era boolean;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if not exists (select 1 from public.configuracoes c where c.escala_oficial_em is not null) then
    return jsonb_build_object('ok', false, 'erro', 'O 📌 fixo só pode ser marcado depois da escala oficial.');
  end if;
  select * into s from public.escalas where id = p_escala_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está mais na escala.');
  end if;
  if not exists (select 1 from public._equipes_do(p_id) e
                  where e.papel = 'lider' and e.escala_lider is not null
                    and e.area = s.area_alocada
                    and public._na_equipe_de(e.area, e.cor, s.id)) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder da área marca quem é fixo nela.');
  end if;

  v_era := exists (select 1 from public.equipantes_areas_fixas f
                    where f.equipante_id = s.equipante_id and f.area = s.area_alocada);
  if v_era = coalesce(p_fixo, false) then
    return jsonb_build_object('ok', true, 'fixo', v_era);
  end if;

  if coalesce(p_fixo, false) then
    insert into public.equipantes_areas_fixas (equipante_id, area, marcado_por)
    values (s.equipante_id, s.area_alocada, (v_auth->>'nome') || ' (líder)')
    on conflict (equipante_id, area) do nothing;
  else
    delete from public.equipantes_areas_fixas
     where equipante_id = s.equipante_id and area = s.area_alocada;
  end if;

  insert into public.alteracoes_lider (escala_id, equipante_id, area, campo, de, para, por)
  values (s.id, s.equipante_id, s.area_alocada, 'fixo',
          case when v_era then 'sim' else 'não' end,
          case when p_fixo then 'sim' else 'não' end,
          v_auth->>'nome');

  return jsonb_build_object('ok', true, 'fixo', coalesce(p_fixo, false));
end;
$fn$;

revoke all on function public.lider_marcar_fixo(uuid, text, text, date, uuid, boolean) from public;
grant execute on function public.lider_marcar_fixo(uuid, text, text, date, uuid, boolean) to anon, authenticated;
