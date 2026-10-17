-- Definir a atuacao de uma pessoa numa area pelo par (equipante, area)
-- (17/10/2026). A busca "Onde alguem esta escalado" move/acrescenta a pessoa e
-- precisa gravar a atuacao escolhida; ao acrescentar, o id da linha de escalas
-- ainda nao e conhecido pela tela. Reaproveita definir_atuacao_alocacao (mesma
-- conferencia: organizador, atuacao pertence a area, atuacao sem cor limpa a cor).

create or replace function public.definir_atuacao_na_area(p_equipante_id uuid, p_area text, p_atuacao text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_escala uuid;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem mudar a atuação.');
  end if;
  select e.id into v_escala
    from public.escalas e
   where e.equipante_id = p_equipante_id
     and e.area_alocada = coalesce(public._area_canonica(p_area), p_area)
   limit 1;
  if v_escala is null then
    return jsonb_build_object('ok', false, 'erro', 'Alocação não encontrada.');
  end if;
  return public.definir_atuacao_alocacao(v_escala, p_atuacao);
end;
$$;

revoke all on function public.definir_atuacao_na_area(uuid, text, text) from public, anon;
grant execute on function public.definir_atuacao_na_area(uuid, text, text) to authenticated;
