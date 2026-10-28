-- ---------------------------------------------------------------------------
-- Mensagem para ausentes e sem chamada: so AVISA o limite, nao trava
-- (28/10/2026, Patrick). Mais de uma pessoa usa o login de Desenvolvedores,
-- cada uma com o proprio WhatsApp: a conta por login nao e a conta por numero.
-- A tela mostra quantas a conta ja mandou em 24h e avisa depois de 40.
-- ---------------------------------------------------------------------------

create or replace function public.chamada_registrar_mensagem(p_escala_id uuid, p_tipo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := auth.uid();
begin
  if not public._gere_escala() or v_org is null then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  if p_tipo is null or p_tipo not in ('ausente', 'sem') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de mensagem inválido.');
  end if;
  if not exists (select 1 from public.escalas
                  where id = p_escala_id and area_alocada <> 'Não será escalado') then
    return jsonb_build_object('ok', false, 'erro', 'Essa pessoa não está mais na escala.');
  end if;

  insert into public.chamada_mensagens (escala_id, organizador_id, enviado_por, tipo)
  values (p_escala_id, v_org, public._nome_organizador_logado(), p_tipo);

  return jsonb_build_object('ok', true, 'envios', public._mensagens_do_organizador(v_org));
end;
$$;
revoke all on function public.chamada_registrar_mensagem(uuid, text) from public, anon;
grant execute on function public.chamada_registrar_mensagem(uuid, text) to authenticated;
