-- ---------------------------------------------------------------------------
-- Infiltrados nos VINCULOS desde a escala provisoria (Patrick, 23/10/2026).
--
-- Antes os infiltrados so chegavam a tela depois da escala OFICIAL (para os
-- grupos e os onibus) e, por isso, nao dava para cadastrar vinculo com eles
-- antes dela. Agora infiltrados_nos_grupos() devolve tambem 'para_vinculos':
-- todo equipante escalado em Infiltrados (com ou sem cor) assim que a escala
-- PROVISORIA e lancada. Grupos de trilha e onibus nao mudam: 'infiltrados'
-- continua vazio ate a oficial (sigilo).
--
-- O banco ja aceitava o vinculo (_pode_ter_vinculo, 20261012b): so faltava a
-- tela receber a lista. Se a pessoa sair de Infiltrados antes da oficial, o
-- vinculo fica guardado mas some da tela (nao entra na lista).
-- ---------------------------------------------------------------------------

create or replace function public.infiltrados_nos_grupos()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_oficial    boolean;
  v_provisoria boolean;
  v_vinculos   jsonb;
begin
  if not public.eh_organizador() then
    raise exception 'Só organizadores veem os infiltrados.' using errcode = '42501';
  end if;

  select c.escala_oficial_em is not null, c.escala_lancada_em is not null
    into v_oficial, v_provisoria
    from public.configuracoes c limit 1;

  v_vinculos := case when coalesce(v_provisoria, false) or coalesce(v_oficial, false) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'escala_id', s.id, 'nome', e.nome, 'sexo', e.sexo, 'cpf', e.cpf,
        'whatsapp', coalesce(nullif(e.whatsapp, ''), e.telefone), 'nacionalidade', e.nacionalidade,
        'igreja', e.igreja, 'cor', s.cor) order by e.nome)
      from public.escalas s
      join public.equipantes e on e.id = s.equipante_id
      where s.area_alocada = 'Infiltrados'), '[]'::jsonb)
    else '[]'::jsonb end;

  if not coalesce(v_oficial, false) then
    return jsonb_build_object('oficial', false, 'infiltrados', '[]'::jsonb, 'sem_cor', 0,
                              'para_vinculos', v_vinculos);
  end if;

  return jsonb_build_object(
    'oficial', true,
    'infiltrados', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'escala_id', s.id, 'nome', e.nome, 'sexo', e.sexo, 'cpf', e.cpf,
        'whatsapp', coalesce(nullif(e.whatsapp, ''), e.telefone), 'nacionalidade', e.nacionalidade,
        'igreja', e.igreja, 'cor', s.cor) order by e.nome)
      from public.escalas s
      join public.equipantes e on e.id = s.equipante_id
      where s.area_alocada = 'Infiltrados' and s.cor is not null), '[]'::jsonb),
    'sem_cor', (select count(*) from public.escalas s
                 where s.area_alocada = 'Infiltrados' and s.cor is null),
    'para_vinculos', v_vinculos
  );
end;
$fn$;

revoke all on function public.infiltrados_nos_grupos() from public, anon;
grant execute on function public.infiltrados_nos_grupos() to authenticated;
