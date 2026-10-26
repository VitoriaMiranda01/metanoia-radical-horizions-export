-- Crachas da equipe da trilha + infiltrados na recepcao sem escala oficial
-- (26/10/2026, Patrick).
--
-- 1) Recepcao (e onibus, que usam a mesma lista): o infiltrado aparece assim
--    que esta escalado em "Infiltrados" com cor -- nao espera mais a escala
--    OFICIAL. A regra de pagamento continua a mesma (pago, isento ou agendado).
-- 2) Crachas: alem da lista da recepcao, entram TODOS os escalados em
--    Infiltrados, Espirito Santo e Inimigo -- basta estar alocado na area
--    (sem escala oficial e sem regra de pagamento). Os tres saem com o
--    numero 8. A tela mostra a etiqueta da area (so o organizador ve).

create or replace function public._recepcao_participantes()
 returns table (tipo text, id uuid, nome text, sexo text, nascimento date, igreja text, whatsapp text,
                grupo text, pago boolean, termo_inscricao boolean, emergencia_nome text,
                emergencia_telefone text, infiltrado boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select 'acampante', a.id, a.nome, a.sexo, a.data_nascimento, a.igreja, a.whatsapp,
         a.grupo_trailha,
         lower(coalesce(a.status_pagamento, '')) in ('confirmado', 'pago', 'completed'),
         coalesce(a.termo_responsabilidade_aceito, false),
         a.contato_emergencia_nome, a.contato_emergencia_telefone, false
    from public.acampantes a
   where lower(coalesce(a.status_pagamento, '')) in ('confirmado', 'pago', 'completed')
      or exists (select 1 from public.cobrancas_acampantes c where c.acampante_id = a.id and c.status = 'agendado')
  union all
  select distinct on (e.id) 'equipante', e.id, e.nome, e.sexo, e.data_nascimento, e.igreja,
         coalesce(nullif(e.whatsapp, ''), e.telefone),
         s.cor, lower(coalesce(e.status_pagamento, '')) in ('confirmado', 'pago', 'completed'),
         true, e.contato_emergencia_nome, e.contato_emergencia_telefone, true
    from public.escalas s
    join public.equipantes e on e.id = s.equipante_id
   where s.area_alocada = 'Infiltrados'
     and s.cor is not null
     and (lower(coalesce(e.status_pagamento, '')) in ('confirmado', 'pago', 'completed')
          or exists (select 1 from public.cobrancas_equipantes c where c.equipante_id = e.id and c.status = 'agendado'));
$function$;
revoke all on function public._recepcao_participantes() from public, anon, authenticated;

-- Quem ganha cracha: acampantes da recepcao + equipe da trilha (por area).
-- area: null (acampante) | 'Infiltrados' | 'Espírito Santo' | 'Inimigo'.
create or replace function public._crachas_pessoas()
 returns table (tipo text, id uuid, nome text, grupo text, camisa text, area text, escala_id uuid)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select 'acampante', p.id, p.nome, p.grupo, a.tamanho_camisa, null::text, null::uuid
    from public._recepcao_participantes() p
    join public.acampantes a on a.id = p.id
   where p.tipo = 'acampante'
  union all
  select * from (
    select distinct on (e.id) 'equipante', e.id, e.nome, s.cor, null::text, s.area_alocada, s.id
      from public.escalas s
      join public.equipantes e on e.id = s.equipante_id
     where s.area_alocada in ('Infiltrados', 'Espírito Santo', 'Inimigo')
     order by e.id, array_position(array['Infiltrados', 'Espírito Santo', 'Inimigo'], s.area_alocada)
  ) eq;
$function$;
revoke all on function public._crachas_pessoas() from public, anon, authenticated;

create or replace function public.crachas_lista()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores gerenciam os crachás.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'pessoas', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'tipo', p.tipo, 'id', p.id, 'nome', p.nome, 'grupo', p.grupo,
        'area', p.area, 'escala_id', p.escala_id,
        'infiltrado', case when p.area = 'Infiltrados' then true end,
        'camisa', p.camisa,
        'impresso', case when c.id is not null then jsonb_build_object(
          'nome', c.nome, 'grupo', c.grupo, 'numero', c.numero,
          'em', c.impresso_em, 'por', c.impresso_por, 'vezes', c.vezes) end
      )) order by p.nome)
      from public._crachas_pessoas() p
      left join public.crachas_impressos c
        on (p.tipo = 'acampante' and c.acampante_id = p.id) or (p.tipo = 'equipante' and c.equipante_id = p.id)
    ), '[]'::jsonb)
  );
end;
$function$;

-- Marcar impresso: confere contra a lista dos crachas (nao mais so a da recepcao).
do $$
declare
  v_def  text := pg_get_functiondef('public.crachas_marcar_impressos(jsonb)'::regprocedure);
  v_novo text;
begin
  if v_def like '%_crachas_pessoas()%' then return; end if;
  v_novo := replace(v_def,
    $a$or not public._recepcao_participa(x ->> 'tipo', (x ->> 'id')::uuid)) then$a$,
    $a$or not exists (select 1 from public._crachas_pessoas() p where p.tipo = x ->> 'tipo' and p.id = (x ->> 'id')::uuid)) then$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em crachas_marcar_impressos'; end if;
  execute v_novo;
end $$;
