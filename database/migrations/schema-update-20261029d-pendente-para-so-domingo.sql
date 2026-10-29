-- 20261029d -- Organizador move uma inscrição PENDENTE para "Só Domingo" (Patrick, 29/10/2026)
--
-- Regra combinada:
--   * Quem se inscreveu normalmente e depois avisou que só vai no domingo é
--     passado para "Só Domingo" pelo organizador, na aba Aprovações.
--   * Só inscrição de equipante com status PENDENTE. Aprovada e rejeitada não
--     se mexem por aqui (decisão do Patrick).
--   * Marca so_domingo e apaga as 3 áreas e a área extra (como a inscrição de
--     domingo nasce). Continua pendente: a igreja aprova como qualquer outra e,
--     aprovada, vai para "Vão somente no domingo" com os 50%.
--   * Desfazer ("Voltar para todos os dias"), também só pendente: tira a marca;
--     as áreas não voltam -- a pessoa escolhe de novo no acompanhamento
--     (aparece como pendência "areas").
--   * Recusa se a pessoa tem linha em `escalas`, se já pagou ou se tem PIX
--     aberto (o valor da cobrança mudaria no meio do caminho).

create or replace function public.definir_so_domingo_pendente(p_id uuid, p_so_domingo boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  e public.equipantes;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if p_so_domingo is null then
    return jsonb_build_object('ok', false, 'erro', 'Escolha inválida.');
  end if;

  select * into e from public.equipantes where id = p_id and tipo = 'equipante' for update;
  if e.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if coalesce(e.status, '') <> 'pendente' then
    return jsonb_build_object('ok', false, 'erro', 'Só dá para mudar inscrições pendentes.');
  end if;
  if coalesce(e.so_domingo, false) = p_so_domingo then
    return jsonb_build_object('ok', false, 'erro',
      case when p_so_domingo then 'Esta inscrição já é Só Domingo.'
           else 'Esta inscrição já é para todos os dias.' end);
  end if;
  if lower(coalesce(e.status_pagamento, '')) in ('pago', 'confirmado', 'completed') then
    return jsonb_build_object('ok', false, 'erro',
      'Esta pessoa já pagou: a mudança alteraria o valor. Fale com a tesouraria antes.');
  end if;
  if exists (select 1 from public.pix_sicoob x
              where x.inscricao_tipo = 'equipante' and x.inscricao_id = p_id
                and x.status = 'pendente' and x.desfeito_em is null
                and (x.expires_at is null or x.expires_at > now())) then
    return jsonb_build_object('ok', false, 'erro',
      'Esta pessoa tem um PIX aberto. Espere a cobrança vencer (30 min) e tente de novo.');
  end if;
  if p_so_domingo and exists (select 1 from public.escalas s where s.equipante_id = p_id) then
    return jsonb_build_object('ok', false, 'erro',
      'Esta pessoa já está numa área da escala. Tire-a da escala antes de mover para Só Domingo.');
  end if;

  if p_so_domingo then
    update public.equipantes set
      so_domingo           = true,
      area_trabalho_opcao1 = null,
      area_trabalho_opcao2 = null,
      area_trabalho_opcao3 = null,
      area_trabalho_extra  = null
    where id = p_id;
  else
    update public.equipantes set so_domingo = false where id = p_id;
  end if;

  return jsonb_build_object('ok', true, 'so_domingo', p_so_domingo);
end;
$function$;
revoke execute on function public.definir_so_domingo_pendente(uuid, boolean) from public, anon;
grant execute on function public.definir_so_domingo_pendente(uuid, boolean) to authenticated;
