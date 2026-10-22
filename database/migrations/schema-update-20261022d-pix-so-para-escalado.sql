-- Pagamento so para quem esta escalado (22/10/2026, Patrick).
-- A geracao do PIX ja exigia estar escalado (_equipante_pode_pagar). Faltava o
-- PIX gerado ANTES da pessoa sair da escala: ele continuava valido e, pago,
-- confirmava a inscricao. Agora:
--  1) ao sair da escala (Nao sera escalado, removida), o PIX pendente dela vira
--     'cancelado' -- a tela do PIX avisa;
--  2) se o dinheiro cair mesmo assim (PIX cancelado, ou pessoa fora da escala),
--     a cobranca vira 'fora_da_escala' e a inscricao NAO e confirmada: aparece em
--     Pagamentos > "Precisam de atencao" para a organizacao avaliar a devolucao.
-- Tudo no banco: vale para o webhook do Sicoob e para o PIX simulado do teste,
-- sem mudar as Edge Functions. Pagamento manual e isencao nao passam por aqui
-- (decisao do organizador; a tela so avisa).

create or replace function public._equipante_na_escala(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.escalas s
                  where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado')
     and not exists (select 1 from public.escalas s
                      where s.equipante_id = p_id and s.area_alocada = 'Não será escalado');
$$;
revoke all on function public._equipante_na_escala(uuid) from public, anon, authenticated;

-- 1) Saiu da escala: cancela o PIX pendente.
create or replace function public._cancelar_pix_fora_da_escala()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := coalesce(new.equipante_id, old.equipante_id);
begin
  if not public._equipante_na_escala(v_id) then
    update public.pix_sicoob set status = 'cancelado', updated_at = now()
     where inscricao_id = v_id and inscricao_tipo = 'equipante' and status = 'pendente';
  end if;
  return null;
end;
$$;
revoke all on function public._cancelar_pix_fora_da_escala() from public, anon, authenticated;

drop trigger if exists cancelar_pix_fora_da_escala on public.escalas;
create trigger cancelar_pix_fora_da_escala
  after insert or update of area_alocada or delete on public.escalas
  for each row execute function public._cancelar_pix_fora_da_escala();

-- 2a) Pagamento de PIX cancelado ou de quem esta fora da escala: segura.
create or replace function public._pix_segura_fora_da_escala()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pago' and old.status is distinct from 'pago'
     and new.inscricao_tipo = 'equipante'
     and (old.status in ('cancelado', 'fora_da_escala')
          or not public._equipante_na_escala(new.inscricao_id)) then
    new.status := 'fora_da_escala';
  end if;
  return new;
end;
$$;
revoke all on function public._pix_segura_fora_da_escala() from public, anon, authenticated;

drop trigger if exists pix_segura_fora_da_escala on public.pix_sicoob;
create trigger pix_segura_fora_da_escala
  before update of status on public.pix_sicoob
  for each row execute function public._pix_segura_fora_da_escala();

-- 2b) A confirmacao da inscricao que viria desse PIX nao acontece.
create or replace function public._inscricao_nao_confirma_pix_fora()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(new.status_pagamento, '')) in ('pago', 'confirmado', 'completed')
     and lower(coalesce(old.status_pagamento, '')) not in ('pago', 'confirmado', 'completed')
     and new.id_transacao_sicoob is not null
     and exists (select 1 from public.pix_sicoob p
                  where p.sicoob_id = new.id_transacao_sicoob and p.status = 'fora_da_escala') then
    new.status_pagamento    := old.status_pagamento;
    new.metodo_pagamento    := old.metodo_pagamento;
    new.id_transacao_sicoob := old.id_transacao_sicoob;
    new.data_pagamento      := old.data_pagamento;
  end if;
  return new;
end;
$$;
revoke all on function public._inscricao_nao_confirma_pix_fora() from public, anon, authenticated;

drop trigger if exists inscricao_nao_confirma_pix_fora on public.equipantes;
create trigger inscricao_nao_confirma_pix_fora
  before update of status_pagamento on public.equipantes
  for each row execute function public._inscricao_nao_confirma_pix_fora();
