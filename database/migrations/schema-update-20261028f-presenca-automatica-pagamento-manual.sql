-- Presenca automatica por pagamento manual (Patrick, 28/10/2026).
--
-- Quem pagou em maos (baixa manual dada pela Raquel ou pela portaria) ja entra
-- PRESENTE na chamada da reuniao de escala, igual a regra do DDD 22/24
-- (20261028e): so equipante escalado (fora "Não será escalado"), so depois de
-- lancada a provisoria, nada de marcacao manual e sobrescrito e o AUSENTE do
-- lider vale.
--   - Desfez o pagamento (e nao e DDD 22/24): a presenca automatica sai.
--   - Pagou depois de ser escalado, ou foi escalado depois de pagar: entra.
-- Pagamento manual = status_pagamento 'confirmado' + metodo_pagamento 'manual'
-- (dinheiro, cartao ou PIX conferido a mao). PIX automatico e isento nao contam.

create or replace function public._marca_presenca_pagamento_manual()
returns text
language sql
immutable
set search_path to 'public'
as $$ select 'Automático · pagamento manual confirmado'::text $$;

create or replace function public._marca_presenca_e_automatica(p_marca text)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select p_marca in (public._marca_presenca_automatica(), public._marca_presenca_pagamento_manual())
$$;

revoke all on function public._marca_presenca_pagamento_manual() from public, anon, authenticated;
revoke all on function public._marca_presenca_e_automatica(text) from public, anon, authenticated;

create or replace function public._presenca_automatica(p_escala_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_area text;
  v_whatsapp text;
  v_pago_manual boolean;
  v_quer boolean;
  v_marca text;
  c record;
begin
  select s.area_alocada, e.whatsapp,
         (e.status_pagamento = 'confirmado' and lower(coalesce(e.metodo_pagamento, '')) = 'manual')
    into v_area, v_whatsapp, v_pago_manual
    from public.escalas s
    join public.equipantes e on e.id = s.equipante_id
   where s.id = p_escala_id;
  if not found then
    return;
  end if;

  v_quer := v_area is not null
            and v_area <> 'Não será escalado'
            and (select escala_lancada_em from public.configuracoes limit 1) is not null
            and (coalesce(v_pago_manual, false) or public._ddd_outra_cidade(v_whatsapp));

  v_marca := case when coalesce(v_pago_manual, false)
                  then public._marca_presenca_pagamento_manual()
                  else public._marca_presenca_automatica() end;

  select * into c from public.chamada_escala where escala_id = p_escala_id;

  if v_quer then
    if c.escala_id is null
       or (c.area is distinct from v_area
           and (public._marca_presenca_e_automatica(c.marcado_por) or c.presente)) then
      insert into public.chamada_escala (escala_id, area, presente, marcado_por, marcado_em)
      values (p_escala_id, v_area, true, v_marca, now())
      on conflict (escala_id) do update
        set area = excluded.area,
            presente = true,
            marcado_por = excluded.marcado_por,
            marcado_em = excluded.marcado_em,
            mantido_em = null,
            mantido_por = null,
            convite_enviado_em = case when chamada_escala.area = excluded.area
                                      then chamada_escala.convite_enviado_em end;
    elsif public._marca_presenca_e_automatica(c.marcado_por) and c.marcado_por is distinct from v_marca then
      update public.chamada_escala set marcado_por = v_marca where escala_id = p_escala_id;
    end if;
  elsif c.escala_id is not null and public._marca_presenca_e_automatica(c.marcado_por) then
    delete from public.chamada_escala where escala_id = p_escala_id;
  end if;
end;
$$;

revoke all on function public._presenca_automatica(uuid) from public, anon, authenticated;

-- Gatilho: a baixa (ou o desfazer) do pagamento reavalia a presenca.
drop trigger if exists presenca_automatica_pagamento on public.equipantes;
create trigger presenca_automatica_pagamento
  after update of status_pagamento, metodo_pagamento on public.equipantes
  for each row
  when (old.status_pagamento is distinct from new.status_pagamento
        or old.metodo_pagamento is distinct from new.metodo_pagamento)
  execute function public._tg_presenca_automatica_whatsapp();

-- Quem ja esta escalado e pago hoje.
select public._presenca_automatica(s.id) from public.escalas s;
