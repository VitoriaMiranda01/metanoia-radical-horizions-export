-- =============================================================================
-- Revelar a area no acompanhamento + correcao do cadastro pela propria pessoa
-- (04/10/2026, ideia do Patrick)
--
-- 1. PENDENCIAS: problemas conhecidos na ficha do equipante, calculados aqui
--    (a tela so mostra):
--      - igreja:   disse que congrega e nao informou a igreja;
--      - telefone: WhatsApp fora do padrao (mesma regra de _telefone_normalizado).
--    situacao_inscricao passa a devolver a lista; a tela abre a janela de
--    "Atencao" ao entrar no acompanhamento, e ela some quando a lista zera.
--
-- 2. corrigir_minha_inscricao: a pessoa (provando ser dona pelo CPF, ou nome
--    e nascimento) completa SO o que esta pendente -- nao troca igreja nem
--    telefone que ja estao certos. Cada correcao fica registrada em
--    equipantes.autocorrecoes. Quem ja esta aprovado continua aprovado.
--
-- 3. revelar_area: depois que a escala e lancada, devolve a(s) area(s) da
--    pessoa -- e recusa enquanto houver pendencia. Registra a primeira vez
--    que ela viu (area_vista_em), para a organizacao saber quem ainda nao viu.
-- =============================================================================

alter table public.equipantes
  add column if not exists area_vista_em timestamptz,
  add column if not exists autocorrecoes jsonb;

comment on column public.equipantes.area_vista_em is
  'Primeira vez que o proprio equipante abriu a revelacao da area no acompanhamento.';
comment on column public.equipantes.autocorrecoes is
  'Correcoes feitas pelo proprio equipante no acompanhamento: [{campo, antes, depois, em}].';


create or replace function public._pendencias_equipante(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e public.equipantes;
  v jsonb := '[]'::jsonb;
  v_estrangeiro boolean;
begin
  select * into e from public.equipantes where id = p_id and tipo = 'equipante';
  if e.id is null then
    return v;
  end if;

  if coalesce(e.esta_afastado, false)
     and nullif(btrim(coalesce(e.igreja, '')), '') is null then
    v := v || jsonb_build_array(jsonb_build_object('tipo', 'igreja'));
  end if;

  v_estrangeiro := nullif(regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g'), '') is null;
  if public._telefone_normalizado(e.whatsapp, false, v_estrangeiro) is null then
    v := v || jsonb_build_array(jsonb_build_object(
      'tipo', 'telefone', 'valor', coalesce(e.whatsapp, ''), 'estrangeiro', v_estrangeiro));
  end if;

  return v;
end;
$$;


create or replace function public.corrigir_minha_inscricao(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date,
  p_igreja text default null, p_igreja_outra text default null, p_whatsapp text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.equipantes;
  v_pend jsonb;
  v_log jsonb := coalesce((select autocorrecoes from public.equipantes where id = p_id), '[]'::jsonb);
  v_igreja text := btrim(coalesce(p_igreja, ''));
  v_outra text := upper(regexp_replace(btrim(coalesce(p_igreja_outra, '')), '\s+', ' ', 'g'));
  v_tel text;
  v_mudou boolean := false;
begin
  if not public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;

  select * into e from public.equipantes where id = p_id and tipo = 'equipante';
  if e.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  v_pend := public._pendencias_equipante(p_id);

  -- Igreja: so se estiver faltando.
  if v_pend @> '[{"tipo":"igreja"}]' and v_igreja <> '' then
    if length(v_igreja) > 150 then
      return jsonb_build_object('ok', false, 'erro', 'Nome da igreja muito longo.');
    end if;
    if upper(v_igreja) = 'OUTRA' and length(v_outra) < 3 then
      return jsonb_build_object('ok', false, 'erro', 'Escreva o nome da sua igreja.');
    end if;
    update public.equipantes
       set igreja = v_igreja,
           igreja_outra = case when upper(v_igreja) = 'OUTRA' then v_outra else null end
     where id = p_id;
    v_log := v_log || jsonb_build_array(jsonb_build_object(
      'campo', 'igreja', 'antes', e.igreja,
      'depois', v_igreja || case when upper(v_igreja) = 'OUTRA' then ' — ' || v_outra else '' end,
      'em', now()));
    v_mudou := true;
  end if;

  -- WhatsApp: so se estiver fora do padrao.
  if v_pend @> '[{"tipo":"telefone"}]' and btrim(coalesce(p_whatsapp, '')) <> '' then
    v_tel := public._telefone_normalizado(p_whatsapp, false,
               nullif(regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g'), '') is null);
    if v_tel is null then
      return jsonb_build_object('ok', false, 'erro',
        'Confira o WhatsApp: precisa ter DDD e o número completo, ex.: (21) 99999-9999.');
    end if;
    update public.equipantes set whatsapp = v_tel where id = p_id;
    v_log := v_log || jsonb_build_array(jsonb_build_object(
      'campo', 'whatsapp', 'antes', e.whatsapp, 'depois', v_tel, 'em', now()));
    v_mudou := true;
  end if;

  if v_mudou then
    update public.equipantes set autocorrecoes = v_log where id = p_id;
  end if;

  return jsonb_build_object('ok', true, 'pendencias', public._pendencias_equipante(p_id));
end;
$$;


create or replace function public.revelar_area(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org boolean := public.eh_organizador();
  v_pend jsonb;
  v_areas jsonb;
  v_fora boolean;
begin
  if not (v_org or public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome, p_nascimento)) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;

  if (select escala_lancada_em from public.configuracoes limit 1) is null then
    return jsonb_build_object('ok', false, 'erro', 'A escala ainda não foi divulgada.');
  end if;

  -- Primeiro corrige, depois ve a area (pedido do Patrick).
  v_pend := public._pendencias_equipante(p_id);
  if jsonb_array_length(v_pend) > 0 and not v_org then
    return jsonb_build_object('ok', false, 'pendencias', v_pend);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
             'area', s.area_alocada, 'atuacao', s.atuacao, 'cor', s.cor)
             order by s.created_at) filter (where s.area_alocada <> 'Não será escalado'), '[]'::jsonb),
         coalesce(bool_or(s.area_alocada = 'Não será escalado'), false)
    into v_areas, v_fora
    from public.escalas s
   where s.equipante_id = p_id;

  if jsonb_array_length(v_areas) = 0 then
    return jsonb_build_object('ok', true, 'areas', v_areas, 'nao_sera_escalado', v_fora);
  end if;

  -- Organizador olhando a ficha nao conta como "a pessoa viu".
  if not v_org then
    update public.equipantes
       set area_vista_em = coalesce(area_vista_em, now())
     where id = p_id;
  end if;

  return jsonb_build_object('ok', true, 'areas', v_areas, 'nao_sera_escalado', false);
end;
$$;


-- situacao_inscricao passa a contar as pendencias e se a area ja foi vista.
do $m$
declare
  d text;
  ancora constant text := '''nao_sera_escalado'', v_fora,';
begin
  d := pg_get_functiondef('public.situacao_inscricao'::regproc);
  if (length(d) - length(replace(d, ancora, ''))) / length(ancora) <> 1 then
    raise exception 'trecho nao encontrado (ou repetido) em situacao_inscricao';
  end if;
  execute replace(d, ancora, ancora || '
    ''pendencias'', public._pendencias_equipante(p_id),
    ''area_vista'', (select area_vista_em is not null from public.equipantes where id = p_id),');
end;
$m$;


revoke all on function public._pendencias_equipante(uuid) from public, anon, authenticated;
revoke all on function public.corrigir_minha_inscricao(uuid, text, text, date, text, text, text) from public;
revoke all on function public.revelar_area(uuid, text, text, date) from public;
grant execute on function public.corrigir_minha_inscricao(uuid, text, text, date, text, text, text) to anon, authenticated;
grant execute on function public.revelar_area(uuid, text, text, date) to anon, authenticated;
