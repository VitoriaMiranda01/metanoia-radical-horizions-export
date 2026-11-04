-- ---------------------------------------------------------------------------
-- Acampante que clica em "Entrar no grupo do WhatsApp" na inscricao (botao de
-- 04/11/2026, 20261104d) passa a contar como "convite enviado" na tela de
-- Pagamentos (pedido do Patrick, 04/11/2026). So conta o clique.
--
-- Mesma prova do grupo_acampantes_link: acampante PAGO, por CPF ou txid do
-- PIX. Grava em grupo_whatsapp_enviado com enviado_por = 'Link da inscrição'.
-- O primeiro registro fica (on conflict do nothing). A auditoria nao registra
-- (nao ha organizador logado).
-- ---------------------------------------------------------------------------
create or replace function public.grupo_acampantes_abriu(p_cpf text default null, p_txid text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_id uuid;
begin
  if length(v_cpf) = 11 then
    select a.id into v_id from public.acampantes a
     where regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g') = v_cpf
       and lower(coalesce(a.status_pagamento, '')) in ('pago', 'confirmado', 'completed')
     limit 1;
  end if;
  if v_id is null and nullif(btrim(coalesce(p_txid, '')), '') is not null then
    select a.id into v_id from public.pix_sicoob p
      join public.acampantes a on a.id = p.inscricao_id
     where p.sicoob_id = p_txid
       and p.inscricao_tipo = 'acampante'
       and lower(coalesce(a.status_pagamento, '')) in ('pago', 'confirmado', 'completed')
     limit 1;
  end if;
  if v_id is null then
    return jsonb_build_object('ok', false);
  end if;
  insert into public.grupo_whatsapp_enviado (acampante_id, enviado_por)
  values (v_id, 'Link da inscrição')
  on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function public.grupo_acampantes_abriu(text, text) from public;
grant execute on function public.grupo_acampantes_abriu(text, text) to anon, authenticated;
